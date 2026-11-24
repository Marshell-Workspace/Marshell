//! Supervises long-running background processes (dev servers, watchers, headless agent
//! CLIs) separately from interactive PTY terminals.
//!
//! * Each process runs in its own process group, so stopping it also stops its children.
//! * Output is kept in a ring buffer and read by sequence number (no event plumbing).
//! * A crash can auto-restart with exponential backoff, except when the log shows a port
//!   conflict, where retrying would only fail the same way.
//! * `process_list` reports CPU, memory and the ports the process tree is listening on.
//! * `shutdown_all` (called on app exit) kills every group so nothing is orphaned.

use crate::proc_inspect::{self, CpuMemo, ProcessTree};
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::process::Stdio;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWriteExt, BufReader};
use tokio::process::Command;

const MAX_LOG_LINES: usize = 5000;
/// Default cap per output line; structured (JSON-lines) runs raise it so events are not cut.
const DEFAULT_LINE_CHARS: usize = 4000;
const MAX_PROCESSES: usize = 32;
const KILL_GRACE: Duration = Duration::from_secs(3);
/// Crashes in a row before auto-restart gives up.
const MAX_AUTO_RESTARTS: u32 = 3;
/// A run this long is considered healthy, so the crash counter starts over.
const STABLE_RUN: Duration = Duration::from_secs(60);
const BASE_BACKOFF: Duration = if cfg!(test) { Duration::from_millis(40) } else { Duration::from_secs(1) };
/// Waiting for the output pipes to drain after exit; a grandchild can hold them open.
const DRAIN_TIMEOUT: Duration = Duration::from_millis(500);
const CONFLICT_SCAN_LINES: usize = 60;

#[derive(Serialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Running,
    Stopped,
    Exited,
    Crashed,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub seq: u64,
    pub stream: &'static str,
    pub text: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub id: String,
    pub workspace_id: String,
    pub command: String,
    pub cwd: String,
    pub status: Status,
    pub exit_code: Option<i32>,
    pub pid: Option<u32>,
    pub started_at: u64,
    pub restart_on_crash: bool,
    /// Automatic restarts so far.
    pub restarts: u32,
    /// A restart is scheduled after a crash.
    pub restart_pending: bool,
    /// Human-readable diagnosis of the last crash (e.g. a port conflict).
    pub hint: Option<String>,
    /// Ports listened on by the process or anything it started.
    pub ports: Vec<u16>,
    pub cpu_percent: Option<f32>,
    pub memory_mb: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogBatch {
    pub lines: Vec<LogLine>,
    /// Pass back as `after_seq` to receive only newer lines.
    pub next: u64,
}

struct Spec {
    workspace_id: String,
    program: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: String,
    /// Written to the child's stdin, then closed (e.g. a prompt for a headless CLI).
    stdin: Option<String>,
    restart_on_crash: bool,
    max_line_chars: usize,
}

struct Inner {
    pid: Option<u32>,
    status: Status,
    exit_code: Option<i32>,
    stopping: bool,
    generation: u64,
    started_at: u64,
    run_started: Instant,
    next_seq: u64,
    logs: VecDeque<LogLine>,
    restarts: u32,
    consecutive_crashes: u32,
    restart_pending: bool,
    hint: Option<String>,
    memo: CpuMemo,
}

struct Entry {
    id: String,
    spec: Spec,
    inner: Mutex<Inner>,
}

static PROCESSES: OnceLock<Mutex<HashMap<String, Arc<Entry>>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, Arc<Entry>>> {
    PROCESSES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

fn get(id: &str) -> Result<Arc<Entry>, String> {
    registry().lock().unwrap_or_else(|e| e.into_inner()).get(id).cloned().ok_or_else(|| format!("Unknown process: {id}"))
}

fn push_log(entry: &Entry, stream: &'static str, text: String) {
    let mut inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
    let seq = inner.next_seq;
    inner.next_seq += 1;
    if inner.logs.len() >= MAX_LOG_LINES {
        inner.logs.pop_front();
    }
    inner.logs.push_back(LogLine { seq, stream, text });
}

async fn pump<R: AsyncRead + Unpin>(entry: Arc<Entry>, stream: &'static str, reader: R, max_chars: usize) {
    let mut reader = BufReader::new(reader);
    let mut buf = Vec::new();
    loop {
        match reader.fill_buf().await {
            Ok([]) | Err(_) => {
                if !buf.is_empty() {
                    let line: String = String::from_utf8_lossy(&buf).trim_end_matches(['\r', '\n']).chars().take(max_chars).collect();
                    push_log(&entry, stream, line);
                }
                break;
            }
            Ok(chunk) => {
                let newline = chunk.iter().position(|byte| *byte == b'\n');
                let consumed = newline.map_or(chunk.len(), |index| index + 1);
                // Bound allocation before receiving an arbitrarily long record.
                let retained = consumed.min(max_chars.saturating_mul(4).saturating_sub(buf.len()));
                buf.extend_from_slice(&chunk[..retained]);
                reader.consume(consumed);
                if newline.is_none() { continue; }
                let line = String::from_utf8_lossy(&buf);
                let line: String = line.trim_end_matches(['\r', '\n']).chars().take(max_chars).collect();
                push_log(&entry, stream, line);
                buf.clear();
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Diagnosis
// ---------------------------------------------------------------------------

/// The port number in a "port in use" style message, if one is written out.
fn port_in_line(lower: &str) -> Option<u16> {
    let bytes = lower.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let after_colon = bytes[i] == b':';
        let after_word = lower[i..].starts_with("port ");
        if after_colon || after_word {
            let start = i + if after_colon { 1 } else { 5 };
            let digits: String = lower[start..].chars().take_while(|c| c.is_ascii_digit()).collect();
            if (2..=5).contains(&digits.len()) {
                if let Ok(p) = digits.parse::<u16>() {
                    return Some(p);
                }
            }
        }
        i += 1;
    }
    None
}

/// Recognises "address already in use" style failures in recent output.
pub fn detect_port_conflict(lines: &[String]) -> Option<String> {
    for line in lines.iter().rev().take(CONFLICT_SCAN_LINES) {
        let l = line.to_ascii_lowercase();
        let hit = l.contains("eaddrinuse")
            || l.contains("address already in use")
            || (l.contains("port") && (l.contains("already in use") || l.contains("is in use")));
        if hit {
            return Some(match port_in_line(&l) {
                Some(p) => format!("Port {p} is already in use. Stop whatever is using it, or start on a different port."),
                None => "A port is already in use. Stop whatever is using it, or start on a different port.".to_string(),
            });
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Process control
// ---------------------------------------------------------------------------

fn build_command(spec: &Spec) -> Command {
    // Windows ships tools like `pnpm` as `.cmd` shims, which only `cmd /C` resolves.
    #[cfg(windows)]
    let mut cmd = {
        let mut c = Command::new("cmd");
        c.args(["/C", &spec.program]);
        c
    };
    #[cfg(not(windows))]
    let mut cmd = Command::new(&spec.program);
    // GUI launches on macOS have no Homebrew/node-manager PATH. A caller's
    // explicit PATH remains authoritative via envs below.
    cmd.env("PATH", crate::build_merged_path());
    cmd.args(&spec.args)
        .envs(&spec.env)
        .current_dir(&spec.cwd)
        .stdin(if spec.stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    cmd.process_group(0);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

fn signal_group(pid: u32, force: bool) {
    #[cfg(unix)]
    unsafe {
        // Negative pid targets the whole process group created by `process_group(0)`.
        libc::kill(-(pid as i32), if force { libc::SIGKILL } else { libc::SIGTERM });
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(0x08000000)
            .output();
        let _ = force;
    }
}

fn spawn_into(entry: &Arc<Entry>) -> Result<(), String> {
    let mut child = build_command(&entry.spec)
        .spawn()
        .map_err(|e| format!("Could not start `{}`: {e}", entry.spec.program))?;
    let generation = {
        let mut inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.generation += 1;
        inner.pid = child.id();
        inner.status = Status::Running;
        inner.exit_code = None;
        inner.stopping = false;
        inner.restart_pending = false;
        inner.hint = None;
        inner.started_at = now_ms();
        inner.run_started = Instant::now();
        inner.memo = CpuMemo::default();
        inner.generation
    };
    if let (Some(text), Some(mut pipe)) = (entry.spec.stdin.clone(), child.stdin.take()) {
        tokio::spawn(async move {
            // A CLI that exits early closes the pipe; that error is not interesting.
            let _ = pipe.write_all(text.as_bytes()).await;
            let _ = pipe.shutdown().await;
        });
    }
    let out = child.stdout.take().map(|o| tokio::spawn(pump(entry.clone(), "stdout", o, entry.spec.max_line_chars)));
    let err = child.stderr.take().map(|e| tokio::spawn(pump(entry.clone(), "stderr", e, entry.spec.max_line_chars)));

    let entry = entry.clone();
    tokio::spawn(async move {
        let code = child.wait().await.ok().and_then(|s| s.code());
        // Let the final output land before diagnosing the exit.
        for task in [out, err].into_iter().flatten() {
            let _ = tokio::time::timeout(DRAIN_TIMEOUT, task).await;
        }
        let (note, retry_in) = {
            let mut inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
            // A restart may already have replaced this run.
            if inner.generation != generation {
                return;
            }
            inner.pid = None;
            inner.exit_code = code;
            inner.status = if inner.stopping {
                Status::Stopped
            } else if code == Some(0) {
                Status::Exited
            } else {
                Status::Crashed
            };

            let mut retry_in = None;
            if inner.status == Status::Crashed {
                if inner.run_started.elapsed() > STABLE_RUN {
                    inner.consecutive_crashes = 0;
                }
                let recent: Vec<String> = inner.logs.iter().rev().take(CONFLICT_SCAN_LINES).map(|l| l.text.clone()).collect();
                inner.hint = detect_port_conflict(&recent.into_iter().rev().collect::<Vec<_>>());
                // A port conflict fails identically every time; do not loop on it.
                if entry.spec.restart_on_crash && inner.hint.is_none() && inner.consecutive_crashes < MAX_AUTO_RESTARTS {
                    inner.consecutive_crashes += 1;
                    inner.restarts += 1;
                    inner.restart_pending = true;
                    retry_in = Some(BASE_BACKOFF * 2u32.pow(inner.consecutive_crashes - 1));
                }
            } else {
                inner.consecutive_crashes = 0;
            }
            let note = format!(
                "[process {:?} (exit code {}){}]",
                inner.status,
                code.map_or("none".to_string(), |c| c.to_string()),
                match retry_in {
                    Some(d) => format!("; restarting in {:.1}s (attempt {}/{MAX_AUTO_RESTARTS})", d.as_secs_f32(), inner.consecutive_crashes),
                    None if inner.status == Status::Crashed && entry.spec.restart_on_crash && inner.hint.is_none() => "; giving up after repeated crashes".to_string(),
                    None => String::new(),
                }
            );
            (note, retry_in)
        };
        push_log(&entry, "system", note);

        if let Some(delay) = retry_in {
            tokio::time::sleep(delay).await;
            let still_wanted = {
                let inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
                inner.generation == generation && inner.restart_pending
            };
            if still_wanted {
                if let Err(e) = spawn_into(&entry) {
                    push_log(&entry, "system", format!("[restart failed: {e}]"));
                    entry.inner.lock().unwrap_or_else(|e| e.into_inner()).restart_pending = false;
                }
            }
        }
    });
    Ok(())
}

fn request_stop(entry: &Arc<Entry>) {
    let (pid, generation) = {
        let mut inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
        if inner.status == Status::Crashed && inner.restart_pending {
            // Stopping a crashed process that is waiting to restart cancels the restart.
            inner.restart_pending = false;
            inner.status = Status::Stopped;
            drop(inner);
            push_log(entry, "system", "[automatic restart cancelled]".to_string());
            return;
        }
        if inner.status != Status::Running {
            return;
        }
        inner.stopping = true;
        (inner.pid, inner.generation)
    };
    if let Some(pid) = pid {
        signal_group(pid, false);
        let entry = entry.clone();
        tokio::spawn(async move {
            tokio::time::sleep(KILL_GRACE).await;
            let still = {
                let inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
                inner.generation == generation && inner.status == Status::Running
            };
            if still {
                signal_group(pid, true);
            }
        });
    }
}

/// Kills every supervised process group immediately. Called when the app exits.
pub fn shutdown_all() {
    shutdown_where(|_| true);
}

/// Kills the process groups of the entries `select` picks (all of them, on app exit).
fn shutdown_where(select: impl Fn(&Entry) -> bool) {
    let entries: Vec<Arc<Entry>> = registry().lock().unwrap_or_else(|e| e.into_inner()).values().cloned().collect();
    for entry in entries.into_iter().filter(|e| select(e)) {
        let mut inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.stopping = true;
        inner.restart_pending = false;
        if let (Status::Running, Some(pid)) = (inner.status, inner.pid) {
            signal_group(pid, true);
        }
    }
}

/// Root pids of this workspace's running processes (for port detection).
pub fn workspace_pids(workspace_id: &str) -> Vec<u32> {
    registry()
        .lock()
        .unwrap()
        .values()
        .filter(|e| e.spec.workspace_id == workspace_id)
        .filter_map(|e| e.inner.lock().unwrap_or_else(|e| e.into_inner()).pid)
        .collect()
}

fn info(entry: &Entry) -> ProcessInfo {
    let inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
    let mut command = entry.spec.program.clone();
    for a in &entry.spec.args {
        command.push(' ');
        command.push_str(a);
    }
    ProcessInfo {
        id: entry.id.clone(),
        workspace_id: entry.spec.workspace_id.clone(),
        command,
        cwd: entry.spec.cwd.clone(),
        status: inner.status,
        exit_code: inner.exit_code,
        pid: inner.pid,
        started_at: inner.started_at,
        restart_on_crash: entry.spec.restart_on_crash,
        restarts: inner.restarts,
        restart_pending: inner.restart_pending,
        hint: inner.hint.clone(),
        ports: Vec::new(),
        cpu_percent: None,
        memory_mb: None,
    }
}

/// `info` plus live health, using one process-table snapshot for all entries.
fn info_with_health(entry: &Entry, tree: &ProcessTree, ports: &[proc_inspect::ListeningPort]) -> ProcessInfo {
    let mut base = info(entry);
    if let Some(pid) = base.pid {
        let owned = proc_inspect::descendants(tree, &[pid]);
        let mut mine: Vec<u16> = ports.iter().filter(|p| owned.contains(&p.pid)).map(|p| p.port).collect();
        mine.sort_unstable();
        mine.dedup();
        base.ports = mine;
        let mut inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(usage) = proc_inspect::usage_of(tree, pid, &mut inner.memo) {
            base.cpu_percent = usage.cpu_percent;
            base.memory_mb = Some(usage.memory_kb / 1024);
        }
    }
    base
}

/// Validates and starts a supervised process. Must be called inside the async runtime.
#[allow(clippy::too_many_arguments)]
pub(crate) fn start_process(
    id: Option<String>,
    workspace_id: String,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: String,
    stdin: Option<String>,
    restart_on_crash: bool,
) -> Result<String, String> {
    start_process_ext(id, workspace_id, command, args, env, cwd, stdin, restart_on_crash, None)
}

/// `start_process` with a custom per-line character limit (default 4,000).
#[allow(clippy::too_many_arguments)]
pub(crate) fn start_process_ext(
    id: Option<String>,
    workspace_id: String,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: String,
    stdin: Option<String>,
    restart_on_crash: bool,
    max_line_chars: Option<usize>,
) -> Result<String, String> {
    let program = command.trim().to_string();
    if program.is_empty() || program.contains('\0') {
        return Err("Command is empty".to_string());
    }
    if env.keys().any(|k| k.is_empty() || k.contains(['=', '\0'])) {
        return Err("Invalid environment variable name".to_string());
    }
    if !Path::new(&cwd).is_dir() {
        return Err(format!("Working directory does not exist: {cwd}"));
    }
    if registry().lock().unwrap_or_else(|e| e.into_inner()).len() >= MAX_PROCESSES {
        return Err("Too many processes; remove some that have finished".to_string());
    }
    let id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let entry = Arc::new(Entry {
        id: id.clone(),
        spec: Spec { workspace_id, program, args, env, cwd, stdin, restart_on_crash, max_line_chars: max_line_chars.unwrap_or(DEFAULT_LINE_CHARS) },
        inner: Mutex::new(Inner {
            pid: None,
            status: Status::Stopped,
            exit_code: None,
            stopping: false,
            generation: 0,
            started_at: 0,
            run_started: Instant::now(),
            next_seq: 0,
            logs: VecDeque::new(),
            restarts: 0,
            consecutive_crashes: 0,
            restart_pending: false,
            hint: None,
            memo: CpuMemo::default(),
        }),
    });
    spawn_into(&entry)?;
    registry().lock().unwrap_or_else(|e| e.into_inner()).insert(id.clone(), entry);
    Ok(id)
}

#[tauri::command]
pub async fn process_start(
    workspace_id: String,
    command: String,
    args: Vec<String>,
    env: Option<HashMap<String, String>>,
    cwd: String,
    restart_on_crash: Option<bool>,
) -> Result<String, String> {
    start_process(None, workspace_id, command, args, env.unwrap_or_default(), cwd, None, restart_on_crash.unwrap_or(false))
}

#[tauri::command]
pub async fn process_stop(process_id: String) -> Result<(), String> {
    request_stop(&get(&process_id)?);
    Ok(())
}

#[tauri::command]
pub async fn process_restart(process_id: String) -> Result<(), String> {
    let entry = get(&process_id)?;
    request_stop(&entry);
    // Wait for the old run to end (SIGKILL follows after the grace period).
    for _ in 0..((KILL_GRACE.as_millis() as u64 + 3000) / 50) {
        if entry.inner.lock().unwrap_or_else(|e| e.into_inner()).status != Status::Running {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    if entry.inner.lock().unwrap_or_else(|e| e.into_inner()).status == Status::Running {
        return Err("The process did not stop in time".to_string());
    }
    {
        let mut inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.consecutive_crashes = 0;
        inner.restart_pending = false;
    }
    push_log(&entry, "system", "[restarting]".to_string());
    spawn_into(&entry)
}

#[tauri::command]
pub async fn process_list(workspace_id: String) -> Result<Vec<ProcessInfo>, String> {
    let entries: Vec<Arc<Entry>> = registry()
        .lock()
        .unwrap()
        .values()
        .filter(|e| e.spec.workspace_id == workspace_id)
        .cloned()
        .collect();
    if entries.is_empty() {
        return Ok(Vec::new());
    }
    // Reading the process table touches the filesystem / spawns tools: keep it off the runtime.
    tokio::task::spawn_blocking(move || {
        let running = entries.iter().any(|e| e.inner.lock().unwrap_or_else(|e| e.into_inner()).pid.is_some());
        let (tree, ports) = if running {
            (proc_inspect::cached_process_tree(), proc_inspect::cached_listening_ports())
        } else {
            (ProcessTree::new(), Vec::new())
        };
        let mut list: Vec<ProcessInfo> = entries.iter().map(|e| info_with_health(e, &tree, &ports)).collect();
        list.sort_by_key(|p| p.started_at);
        list
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn process_logs(process_id: String, after_seq: Option<u64>) -> Result<LogBatch, String> {
    let entry = get(&process_id)?;
    let inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
    let lines: Vec<LogLine> = inner
        .logs
        .iter()
        .filter(|l| after_seq.map_or(true, |s| l.seq >= s))
        .cloned()
        .collect();
    Ok(LogBatch { lines, next: inner.next_seq })
}

/// Forgets a finished process and its logs.
#[tauri::command]
pub async fn process_remove(process_id: String) -> Result<(), String> {
    let entry = get(&process_id)?;
    {
        let mut inner = entry.inner.lock().unwrap_or_else(|e| e.into_inner());
        if inner.status == Status::Running {
            return Err("Stop the process before removing it".to_string());
        }
        inner.restart_pending = false;
    }
    registry().lock().unwrap_or_else(|e| e.into_inner()).remove(&process_id);
    Ok(())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[tokio::test]
    async fn child_processes_receive_gui_path_and_keep_explicit_overrides() {
        for custom_path in [None, Some("/configured tools/bin")] {
            let env = custom_path.map(|path| HashMap::from([("PATH".into(), path.into())])).unwrap_or_default();
            let id = start_process(None, "ws-gui-path".into(), "/bin/sh".into(), vec!["-c".into(), "printf '%s\\n' \"$PATH\"".into()], env, "/tmp".into(), None, false).unwrap();
            wait_for(&id, Status::Exited).await;
            let logs = process_logs(id.clone(), None).await.unwrap();
            let path = &logs.lines.iter().find(|line| line.stream == "stdout").unwrap().text;
            if let Some(expected) = custom_path {
                assert_eq!(path, expected);
            } else {
                assert!(std::env::split_paths(path).any(|entry| entry == Path::new("/opt/homebrew/bin")));
                assert!(std::env::split_paths(path).any(|entry| entry == Path::new("/usr/local/bin")));
            }
            process_remove(id).await.unwrap();
        }
    }

    async fn wait_until<F: Fn(&ProcessInfo) -> bool>(id: &str, what: &str, ok: F) -> ProcessInfo {
        for _ in 0..200 {
            let info = info(&get(id).unwrap());
            if ok(&info) {
                return info;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("process never reached: {what}");
    }

    async fn wait_for(id: &str, want: Status) -> ProcessInfo {
        wait_until(id, &format!("{want:?}"), |i| i.status == want).await
    }

    fn sh(script: &str) -> (String, Vec<String>) {
        ("sh".into(), vec!["-c".into(), script.into()])
    }

    fn start(ws: &str, script: &str, restart: bool) -> String {
        let (cmd, args) = sh(script);
        start_process(None, ws.into(), cmd, args, HashMap::new(), "/tmp".into(), None, restart).unwrap()
    }

    #[tokio::test]
    async fn captures_logs_stops_group_and_restarts() {
        let (cmd, args) = sh("echo hello; echo oops >&2; sleep 30 & wait");
        let id = process_start("ws".into(), cmd, args, None, "/tmp".into(), None).await.unwrap();
        tokio::time::sleep(Duration::from_millis(300)).await;

        let logs = process_logs(id.clone(), None).await.unwrap();
        assert!(logs.lines.iter().any(|l| l.stream == "stdout" && l.text == "hello"));
        assert!(logs.lines.iter().any(|l| l.stream == "stderr" && l.text == "oops"));
        let none = process_logs(id.clone(), Some(logs.next)).await.unwrap();
        assert!(none.lines.is_empty());

        assert_eq!(process_list("ws".into()).await.unwrap().len(), 1);
        assert!(process_list("other".into()).await.unwrap().is_empty());
        assert!(process_remove(id.clone()).await.is_err(), "cannot remove a running process");

        process_restart(id.clone()).await.unwrap();
        wait_for(&id, Status::Running).await;
        process_stop(id.clone()).await.unwrap();
        wait_for(&id, Status::Stopped).await;
        process_remove(id).await.unwrap();
    }

    #[tokio::test]
    async fn long_lines_are_cut_at_the_default_limit_but_not_when_raised() {
        let script = "head -c 9000 /dev/zero | tr '\\0' 'x'; echo";
        let (cmd, args) = sh(script);
        let short = start_process(None, "ws-long".into(), cmd.clone(), args.clone(), HashMap::new(), "/tmp".into(), None, false).unwrap();
        let long = start_process_ext(None, "ws-long".into(), cmd, args, HashMap::new(), "/tmp".into(), None, false, Some(20_000)).unwrap();
        wait_for(&short, Status::Exited).await;
        wait_for(&long, Status::Exited).await;
        let longest = |id: String| async move {
            process_logs(id, None).await.unwrap().lines.iter().filter(|l| l.stream == "stdout").map(|l| l.text.len()).max().unwrap()
        };
        assert_eq!(longest(short).await, DEFAULT_LINE_CHARS);
        assert_eq!(longest(long).await, 9000);
    }

    #[tokio::test]
    async fn feeds_stdin_then_closes_it() {
        let id = start_process(None, "ws3".into(), "sh".into(), vec!["-c".into(), "cat".into()], HashMap::new(), "/tmp".into(), Some("prompt text\n".into()), false).unwrap();
        // `cat` only exits once stdin is closed, so reaching Exited proves the close.
        wait_for(&id, Status::Exited).await;
        let logs = process_logs(id, None).await.unwrap();
        assert!(logs.lines.iter().any(|l| l.text == "prompt text"));
    }

    #[tokio::test]
    async fn distinguishes_crash_from_clean_exit_and_validates_input() {
        let crashed = start("ws2", "exit 3", false);
        assert_eq!(wait_for(&crashed, Status::Crashed).await.exit_code, Some(3));
        assert_eq!(info(&get(&crashed).unwrap()).restarts, 0, "no restart unless asked");

        let clean = start("ws2", "exit 0", true);
        wait_for(&clean, Status::Exited).await;
        assert_eq!(info(&get(&clean).unwrap()).restarts, 0, "a clean exit is never restarted");

        assert!(start_process(None, "ws2".into(), " ".into(), vec![], HashMap::new(), "/tmp".into(), None, false).is_err());
        assert!(start_process(None, "ws2".into(), "sh".into(), vec![], HashMap::new(), "/no/such/dir".into(), None, false).is_err());
        let bad_env = HashMap::from([("A=B".to_string(), "x".to_string())]);
        assert!(start_process(None, "ws2".into(), "sh".into(), vec![], bad_env, "/tmp".into(), None, false).is_err());
    }

    #[tokio::test]
    async fn auto_restarts_a_crash_a_bounded_number_of_times() {
        let id = start("ws-restart", "echo boom >&2; exit 1", true);
        // Gives up after MAX_AUTO_RESTARTS and stays Crashed.
        let done = wait_until(&id, "gave up", |i| i.restarts == MAX_AUTO_RESTARTS && !i.restart_pending && i.status == Status::Crashed).await;
        assert_eq!(done.restarts, MAX_AUTO_RESTARTS);
        let logs = process_logs(id.clone(), None).await.unwrap();
        assert!(logs.lines.iter().any(|l| l.text.contains("giving up after repeated crashes")));
        assert_eq!(logs.lines.iter().filter(|l| l.text == "boom").count() as u32, MAX_AUTO_RESTARTS + 1);
    }

    #[tokio::test]
    async fn port_conflicts_are_diagnosed_and_not_retried() {
        let id = start("ws-port", "echo 'Error: listen EADDRINUSE: address already in use :::3000' >&2; exit 1", true);
        let info = wait_until(&id, "diagnosed", |i| i.status == Status::Crashed && i.hint.is_some()).await;
        assert!(info.hint.unwrap().contains("Port 3000"));
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert_eq!(super::info(&get(&id).unwrap()).restarts, 0);
    }

    #[tokio::test]
    async fn stopping_cancels_a_pending_restart() {
        let id = start("ws-cancel", "exit 1", true);
        wait_until(&id, "restart pending", |i| i.restart_pending).await;
        process_stop(id.clone()).await.unwrap();
        let stopped = wait_for(&id, Status::Stopped).await;
        assert!(!stopped.restart_pending);
        tokio::time::sleep(Duration::from_millis(300)).await;
        assert_eq!(info(&get(&id).unwrap()).status, Status::Stopped, "must not come back");
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn reports_memory_and_listening_ports_of_the_tree() {
        if std::process::Command::new("python3").arg("--version").output().is_err() {
            return; // no python3 to act as a dev server
        }
        let port = std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        // The shell forks python: the port belongs to a grandchild of the supervised pid.
        let id = start("ws-health", &format!("python3 -m http.server {port} --bind 127.0.0.1 >/dev/null 2>&1 & wait"), false);

        let mut seen = None;
        for _ in 0..100 {
            let list = process_list("ws-health".into()).await.unwrap();
            if let Some(p) = list.iter().find(|p| p.id == id && p.ports.contains(&port)) {
                seen = Some(p.clone());
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        let p = seen.expect("port never detected");
        assert!(p.memory_mb.is_some());
        assert!(workspace_pids("ws-health").contains(&p.pid.unwrap()));

        // Scoped to this test's workspace: the registry is process-global and other tests run
        // in parallel, so the real `shutdown_all` would kill their processes too.
        shutdown_where(|e| e.spec.workspace_id == "ws-health");
        wait_until(&id, "killed on shutdown", |i| i.status != Status::Running).await;
    }

    #[test]
    fn detects_port_conflicts_in_common_dev_server_messages() {
        let lines = |s: &str| vec![s.to_string()];
        assert!(detect_port_conflict(&lines("Error: listen EADDRINUSE: address already in use 127.0.0.1:5173")).unwrap().contains("5173"));
        assert!(detect_port_conflict(&lines("OSError: [Errno 98] Address already in use")).is_some());
        assert!(detect_port_conflict(&lines("Port 3000 is in use, trying another one...")).unwrap().contains("3000"));
        assert!(detect_port_conflict(&lines("compiled successfully on port 3000")).is_none());
        assert!(detect_port_conflict(&[]).is_none());
    }
}

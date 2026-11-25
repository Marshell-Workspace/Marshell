use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, MasterPty};
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Instant;
use tauri::{Emitter, Runtime};

pub struct TerminalHistory {
    pub bytes: VecDeque<u8>,
    pub total_read: usize,
}

/// Raw PTY bytes cross IPC as base64. A JSON array of numbers is 3-4x larger and
/// far slower to parse in the webview; this keeps output floods smooth.
fn serialize_base64<S: serde::Serializer>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error> {
    use base64::Engine;
    serializer.serialize_str(&base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[derive(Clone, serde::Serialize)]
pub struct TerminalEventPayload {
    #[serde(serialize_with = "serialize_base64")]
    pub bytes: Vec<u8>,
    pub instance_id: u64,
    pub offset: usize,
}

#[derive(serde::Serialize)]
pub struct TerminalHistoryInfo {
    pub startup_pending: bool,
    #[serde(serialize_with = "serialize_base64")]
    pub bytes: Vec<u8>,
    pub instance_id: u64,
    pub history: String,
    pub total_read: usize,
}

#[derive(serde::Serialize)]
pub struct TerminalCreateResult {
    pub is_new: bool,
    pub instance_id: u64,
    /// The shell that is actually running, which can differ from the requested
    /// one when it is not installed: powershell, cmd, bash, zsh, fish, gitbash, sh, other.
    pub shell: &'static str,
    /// True when the requested shell could not be started and the system default was used.
    pub fell_back: bool,
}

static NEXT_INSTANCE_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

pub struct TerminalSession {
    startup: Arc<Mutex<crate::terminal_startup::TerminalStartup>>,
    pub instance_id: u64,
    pub is_active: Arc<std::sync::atomic::AtomicBool>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    history: Arc<Mutex<TerminalHistory>>,
    flow: Arc<crate::terminal_flow::TerminalFlow>,
    killer: Arc<Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>>,
    pid: Option<u32>,
    shell_kind: &'static str,
    fell_back: bool,
    managed_cli: Arc<Mutex<Option<&'static str>>>,
    can_exec: bool,
    #[cfg(unix)]
    reader_stop: Arc<crate::terminal_reader::ReaderStop>,
}

impl Drop for TerminalSession {
    fn drop(&mut self) {
        if !self.is_active.swap(false, std::sync::atomic::Ordering::AcqRel) { return; }
        #[cfg(unix)]
        self.reader_stop.stop();
        #[cfg(unix)]
        if self.managed_cli.lock().map(|cli| cli.is_some()).unwrap_or(false) {
            terminate_managed_group(self.pid);
        }
        if let Ok(mut child) = self.killer.lock() {
            #[cfg(windows)]
            {
                if let Some(pid) = self.pid {
                    use std::os::windows::process::CommandExt;
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .creation_flags(0x08000000) // CREATE_NO_WINDOW
                        .spawn();
                }
            }
            let _ = child.kill();
        }
    }
}

type SessionMap = Arc<Mutex<HashMap<String, TerminalSession>>>;

fn sessions() -> &'static SessionMap {
    static SESSIONS: OnceLock<SessionMap> = OnceLock::new();
    SESSIONS.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

type LastOutputMap = Arc<Mutex<HashMap<String, Instant>>>;

fn last_output_map() -> &'static LastOutputMap {
    static MAP: OnceLock<LastOutputMap> = OnceLock::new();
    MAP.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

/// Milliseconds since this terminal last produced output, or `None` if it has
/// never produced any yet (e.g. still booting). This Rust-only idle signal is
/// separate from the frontend `terminal-idle-store`.
#[allow(dead_code)]
pub fn ms_since_last_output(id: &str) -> Option<u64> {
    let map = last_output_map().lock().ok()?;
    map.get(id).map(|t| t.elapsed().as_millis() as u64)
}

fn last_input_map() -> &'static LastOutputMap {
    static MAP: OnceLock<LastOutputMap> = OnceLock::new();
    MAP.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

/// Input reserves a terminal immediately, before the CLI echoes it or emits output.
#[allow(dead_code)]
pub fn ms_since_last_activity(id: &str) -> Option<u64> {
    let output = ms_since_last_output(id);
    let input = last_input_map().lock().ok()?.get(id).map(|at| at.elapsed().as_millis() as u64);
    match (output, input) {
        (Some(a), Some(b)) => Some(a.min(b)),
        (a, b) => a.or(b),
    }
}

fn record_input_activity(id: &str) {
    if let Ok(mut map) = last_input_map().lock() {
        map.insert(id.to_string(), Instant::now());
    }
}

fn clear_activity(id: &str) {
    if let Ok(mut map) = last_output_map().lock() { map.remove(id); }
    if let Ok(mut map) = last_input_map().lock() { map.remove(id); }
}

#[cfg(test)]
pub(crate) fn set_test_output_time(id: &str, time: Instant) {
    last_output_map().lock().unwrap().insert(id.into(), time);
}

/// OS process id of a terminal's shell, if the terminal exists and is running.
pub fn terminal_pid(id: &str) -> Option<u32> {
    let sessions_guard = sessions().lock().ok()?;
    let session = sessions_guard.get(id)?;
    session.pid
}

const MAX_HISTORY_BYTES: usize = 100_000;
const READ_BUFFER_BYTES: usize = 16 * 1024;
const COALESCE_MAX_BYTES: usize = 32 * 1024;
const COALESCE_WAIT_MIN_BYTES: usize = 2 * 1024;

/// Git for Windows' bash, found in the standard, per-user and PATH-derived
/// locations. Never falls back to a bare `bash.exe`: on Windows that name can be
/// WSL's launcher in System32, which is a different environment.
fn git_bash_path() -> Option<std::path::PathBuf> {
    #[cfg(not(windows))]
    {
        None
    }
    #[cfg(windows)]
    {
        use std::path::PathBuf;
        let mut candidates: Vec<PathBuf> = Vec::new();
        for var in ["ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"] {
            if let Some(base) = std::env::var_os(var) {
                candidates.push(PathBuf::from(base).join(r"Git\bin\bash.exe"));
            }
        }
        if let Some(base) = std::env::var_os("LOCALAPPDATA") {
            candidates.push(PathBuf::from(base).join(r"Programs\Git\bin\bash.exe"));
        }
        // <git root>\cmd\git.exe or <git root>\bin\git.exe on PATH.
        if let Some(path) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path) {
                if dir.join("git.exe").is_file() {
                    if let Some(root) = dir.parent() {
                        candidates.push(root.join(r"bin\bash.exe"));
                    }
                }
            }
        }
        candidates.into_iter().find(|candidate| candidate.is_file())
    }
}

/// Kind of a shell program path or name, by its executable stem.
fn shell_kind_of(program: &str) -> &'static str {
    let name = program.rsplit(['/', '\\']).next().unwrap_or(program).to_ascii_lowercase();
    let stem = name.strip_suffix(".exe").unwrap_or(&name);
    match stem {
        "powershell" | "pwsh" => "powershell",
        "cmd" => "cmd",
        "bash" => "bash",
        "zsh" => "zsh",
        "fish" => "fish",
        "sh" | "dash" | "ksh" => "sh",
        _ => "other",
    }
}

/// Kind of the shell `CommandBuilder::new_default_prog()` starts.
fn default_shell_kind() -> &'static str {
    #[cfg(windows)]
    {
        let comspec = std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".into());
        shell_kind_of(&comspec)
    }
    #[cfg(not(windows))]
    {
        match std::env::var("SHELL") {
            Ok(shell) if !shell.is_empty() => shell_kind_of(&shell),
            _ => "sh",
        }
    }
}

/// Kind of the shell requested by name, assuming it can be started.
fn requested_shell_kind(shell: Option<&str>) -> &'static str {
    match shell {
        Some("powershell") => "powershell",
        Some("cmd") if cfg!(windows) => "cmd",
        Some("bash") => "bash",
        Some("zsh") => "zsh",
        Some("gitbash") if git_bash_path().is_some() => "gitbash",
        _ => default_shell_kind(),
    }
}

/// True when any of `names` exists in a directory of the search path a spawned
/// shell would inherit.
fn executable_on_path(names: &[&str]) -> bool {
    let inherited = std::env::var_os("PATH").unwrap_or_default();
    #[cfg(not(windows))]
    let search = {
        let home = std::env::var_os("HOME").map(std::path::PathBuf::from);
        crate::process_environment::unix_path(&inherited, home.as_deref(), None)
    };
    #[cfg(windows)]
    let search = inherited;
    std::env::split_paths(&search).any(|dir| names.iter().any(|name| dir.join(name).is_file()))
}

/// The shells the settings page offers that can really be started on this machine.
/// Names match `build_shell_command`; the system default is always available.
fn available_shells() -> Vec<&'static str> {
    let mut shells = Vec::new();
    #[cfg(windows)]
    {
        if executable_on_path(&["powershell.exe"]) {
            shells.push("powershell");
        }
        shells.push("cmd");
        if executable_on_path(&["bash.exe"]) {
            shells.push("bash");
        }
        if git_bash_path().is_some() {
            shells.push("gitbash");
        }
    }
    #[cfg(not(windows))]
    {
        if executable_on_path(&["pwsh"]) {
            shells.push("powershell");
        }
        if executable_on_path(&["bash"]) {
            shells.push("bash");
        }
        if executable_on_path(&["zsh"]) {
            shells.push("zsh");
        }
    }
    shells
}

#[tauri::command]
pub fn list_available_shells() -> Vec<&'static str> {
    available_shells()
}

fn build_shell_command(shell: Option<&str>, cwd: Option<&str>, _id: &str) -> CommandBuilder {
    let mut cmd = match shell {
        Some("powershell") => {
            #[cfg(target_os = "windows")]
            {
                CommandBuilder::new("powershell.exe")
            }
            #[cfg(not(target_os = "windows"))]
            {
                CommandBuilder::new("pwsh")
            }
        }
        Some("cmd") => {
            #[cfg(target_os = "windows")]
            {
                CommandBuilder::new("cmd.exe")
            }
            #[cfg(not(target_os = "windows"))]
            {
                CommandBuilder::new_default_prog()
            }
        }
        Some("bash") => {
            let mut command = CommandBuilder::new("bash");
            if cfg!(target_os = "macos") { command.arg("-l"); }
            command
        },
        Some("gitbash") => match git_bash_path() {
            Some(path) => {
                let mut command = CommandBuilder::new(path);
                // Login shell so /etc/profile sets up PATH and the MinGW prompt.
                command.args(["--login", "-i"]);
                // ...but keep the requested directory instead of jumping to $HOME.
                command.env("CHERE_INVOKING", "1");
                command
            }
            None => CommandBuilder::new_default_prog(),
        },
        Some("zsh") => {
            let mut command = CommandBuilder::new("zsh");
            if cfg!(target_os = "macos") { command.arg("-l"); }
            command
        },
        _ => CommandBuilder::new_default_prog(),
    };

    if let Some(path) = cwd {
        if !path.trim().is_empty() {
            cmd.cwd(path);
        }
    }

    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    #[cfg(windows)]
    cmd.env("PATH", crate::build_merged_path());

    #[cfg(not(target_os = "windows"))]
    {
        if std::env::var("LANG").is_err() {
            cmd.env("LANG", "en_US.UTF-8");
        }

        let inherited = std::env::var_os("PATH").unwrap_or_default();
        let home = std::env::var_os("HOME").map(std::path::PathBuf::from);
        cmd.env("PATH", crate::process_environment::unix_path(&inherited, home.as_deref(), None));
    }

    cmd
}

#[tauri::command]
pub fn create_terminal<R: Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    shell: Option<String>,
) -> Result<TerminalCreateResult, String> {
    let mut sessions_guard = sessions().lock().map_err(|e| e.to_string())?;

    let mut cols = cols;
    let mut rows = rows;
    if cols == 0 {
        cols = 80;
    }
    if rows == 0 {
        rows = 24;
    }

    if sessions_guard.contains_key(&id) {
        // Re-use existing session, just trigger a resize to be sure
        if let Some(session) = sessions_guard.get(&id) {
            if let Ok(master) = session.master.lock() {
                let _ = master.resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                });
            }
            return Ok(TerminalCreateResult {
                is_new: false,
                instance_id: session.instance_id,
                shell: session.shell_kind,
                fell_back: session.fell_back,
            });
        }
    }

    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let cmd = build_shell_command(shell.as_deref(), cwd.as_deref(), &id);

    let requested_kind = requested_shell_kind(shell.as_deref());
    let asked_for_specific = shell.as_deref().is_some_and(|name| name != "default");
    let (child, shell_kind, fell_back) = match pair.slave.spawn_command(cmd) {
        Ok(child) => (
            child,
            requested_kind,
            // e.g. Git Bash requested but not installed: default prog was used.
            asked_for_specific && requested_kind == default_shell_kind() && shell.as_deref() != Some(requested_kind),
        ),
        Err(_) => {
            let fallback_cmd = build_shell_command(None, cwd.as_deref(), &id);
            let child = pair
                .slave
                .spawn_command(fallback_cmd)
                .map_err(|e| format!("Failed to spawn shell: {}", e))?;
            (child, default_shell_kind(), asked_for_specific)
        }
    };

    // Drop the slave side to avoid holding resources open in this process
    drop(pair.slave);

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    #[cfg(unix)]
    let (reader, reader_stop) = crate::terminal_reader::PtyReader::new(
        pair.master.as_raw_fd().ok_or("PTY has no readable descriptor")?
    ).map_err(|e| e.to_string())?;
    #[cfg(not(unix))]
    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    #[cfg(unix)]
    let exit_reader_stop = reader_stop.clone();

    let history = Arc::new(Mutex::new(TerminalHistory {
        bytes: VecDeque::new(),
        total_read: 0,
    }));
    let shared_history = Arc::clone(&history);
    let instance_id = NEXT_INSTANCE_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let is_active = Arc::new(std::sync::atomic::AtomicBool::new(true));
    let reader_active = Arc::clone(&is_active);
    let session_id = id.clone();
    let app_handle = app.clone();

    let pid = child.process_id();
    let managed_cli = Arc::new(Mutex::new(None));
    let exit_cli = managed_cli.clone();
    let killer = Arc::new(Mutex::new(child.clone_killer()));
    let mut exit_child = child;
    let exit_active = is_active.clone();
    let exit_app = app.clone();
    let exit_id = id.clone();

    let (output_done_tx, output_done_rx) = std::sync::mpsc::channel();
    let flow = Arc::new(crate::terminal_flow::TerminalFlow::default());
    let reader_flow = flow.clone();
    let (output_tx, mut output_rx) = tokio::sync::mpsc::channel::<TerminalEventPayload>(8);
    let event_name = format!("terminal-stdout-{session_id}");
    // Coalesce bursts before IPC without another dedicated OS thread. Small
    // chunks (keystroke echo, prompts) are emitted at once; only a stream of
    // large reads is held back briefly so a flood becomes few, big events.
    tauri::async_runtime::spawn(async move {
        use tokio::sync::mpsc::error::TryRecvError;
        let mut pending = None;
        loop {
            let first = match pending.take() { Some(value) => Some(value), None => output_rx.recv().await };
            let Some(mut payload) = first else { break };
            let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(8);
            while payload.bytes.len() < COALESCE_MAX_BYTES {
                let next = match output_rx.try_recv() {
                    Ok(next) => next,
                    Err(TryRecvError::Disconnected) => break,
                    Err(TryRecvError::Empty) => {
                        if payload.bytes.len() < COALESCE_WAIT_MIN_BYTES { break; }
                        match tokio::time::timeout_at(deadline, output_rx.recv()).await {
                            Ok(Some(next)) => next,
                            _ => break,
                        }
                    }
                };
                if next.instance_id != payload.instance_id || next.offset != payload.offset + payload.bytes.len() {
                    pending = Some(next);
                    break;
                }
                payload.bytes.extend(next.bytes);
            }
            let _ = app_handle.emit(&event_name, payload);
        }
        let _ = output_done_tx.send(());
    });
    // Spawn stdout/stderr reader thread
    thread::spawn(move || {
        let mut buf = [0u8; READ_BUFFER_BYTES];
        let mut reader = reader;
        loop {
            if !reader_flow.wait_for_capacity(&reader_active) {
                break;
            }
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    if !reader_active.load(std::sync::atomic::Ordering::Relaxed) {
                        break;
                    }
                    let data = &buf[..n];
                    reader_flow.produced(n);

                    if let Ok(mut map) = last_output_map().lock() {
                        map.insert(session_id.clone(), Instant::now());
                    }

                    let payload = if let Ok(mut hist) = shared_history.lock() {
                        let offset = hist.total_read;
                        hist.bytes.extend(data.iter().copied());
                        hist.total_read += n;
                        if hist.bytes.len() > MAX_HISTORY_BYTES {
                            let drain_amt = hist.bytes.len() - MAX_HISTORY_BYTES;
                            hist.bytes.drain(0..drain_amt);
                        }

                        // Emit event to frontend with instance_id and offset
                        let payload = TerminalEventPayload {
                            bytes: data.to_vec(),
                            instance_id,
                            offset,
                        };
                        Some(payload)
                    } else { None };
                    // Serialization/IPC must never run while holding history state.
                    if let Some(payload) = payload {
                        if output_tx.blocking_send(payload).is_err() { break; }
                    }
                }
                _ => {
                    // Shell exited or error reading
                    break;
                }
            }
        }

    });

    let session = TerminalSession {
        startup: Arc::new(Mutex::new(crate::terminal_startup::TerminalStartup::default())),
        instance_id,
        is_active,
        writer: Arc::new(Mutex::new(writer)),
        master: Arc::new(Mutex::new(pair.master)),
        history,
        flow,
        killer,
        pid,
        shell_kind,
        fell_back,
        managed_cli,
        can_exec: supports_exec(shell.as_deref()),
        #[cfg(unix)]
        reader_stop,
    };

    sessions_guard.insert(id.clone(), session);
    drop(sessions_guard);
    // Own the waiter separately from the kill handle: no polling and no lock held across wait.
    thread::spawn(move || {
        let outcome = exit_child.wait();
        if !exit_active.load(std::sync::atomic::Ordering::Relaxed) { return; }
        // A managed CLI is the PTY session leader. Terminate remaining members
        // of its process group after it exits or crashes.
        #[cfg(unix)]
        if exit_cli.lock().unwrap_or_else(|e| e.into_inner()).is_some() {
            terminate_managed_group(pid);
        }
        #[cfg(unix)]
        exit_reader_stop.stop();
        let drained = output_done_rx.recv_timeout(std::time::Duration::from_secs(2)).is_ok();
        let payload = match outcome {
            Ok(status) => serde_json::json!({ "instance_id": instance_id, "pid": pid, "program": *exit_cli.lock().unwrap_or_else(|e| e.into_inner()), "code": status.exit_code(), "detail": status.to_string(), "output_incomplete": !drained }),
            Err(error) => serde_json::json!({ "instance_id": instance_id, "code": null, "error": error.to_string() }),
        };
        exit_active.store(false, std::sync::atomic::Ordering::Release);
        let _ = exit_app.emit(&format!("terminal-exit-{exit_id}"), payload);
        if let Ok(mut sessions) = sessions().lock() {
            if sessions.get(&exit_id).is_some_and(|current| current.instance_id == instance_id) { sessions.remove(&exit_id); clear_activity(&exit_id); }
        }
    });

    Ok(TerminalCreateResult {
        is_new: true,
        instance_id,
        shell: shell_kind,
        fell_back,
    })
}

/// Startup belongs to the native session rather than a disposable pane timer.
/// Concurrent calls serialize under the session lock, including after IPC retries.
#[tauri::command]
pub async fn launch_terminal_command(
    id: String,
    instance_id: u64,
    command: String,
) -> Result<bool, String> {
    let (startup, history, writer, active, cli, can_exec) = {
        let guard = sessions().lock().map_err(|e| e.to_string())?;
        let session = guard.get(&id).filter(|s| s.instance_id == instance_id)
            .ok_or("Terminal session changed before startup")?;
        (session.startup.clone(), session.history.clone(), session.writer.clone(),
         session.is_active.clone(), session.managed_cli.clone(), session.can_exec)
    };
    let started = Instant::now();
    loop {
        if !active.load(std::sync::atomic::Ordering::Acquire) {
            return Err("Terminal session changed before startup".into());
        }
        if startup.lock().map_err(|e| e.to_string())?.attempted || command.trim().is_empty() {
            return Ok(false);
        }
        let ready = {
            let history = history.lock().map_err(|e| e.to_string())?;
            let bytes: Vec<_> = history.bytes.iter().copied().collect();
            !bytes.is_empty() && (crate::terminal_startup::has_shell_prompt(&bytes)
                || started.elapsed().as_millis() >= 2500)
        };
        if ready {
            return tokio::task::spawn_blocking(move || {
                let mut startup = startup.lock().map_err(|e| e.to_string())?;
                if startup.attempted { return Ok(false); }
                let mut writer = writer.lock().map_err(|e| e.to_string())?;
                if !active.load(std::sync::atomic::Ordering::Acquire) {
                    return Err("Terminal process exited before startup".into());
                }
                let (command, managed) = managed_startup(&command, can_exec);
                *cli.lock().map_err(|e| e.to_string())? = managed;
                let launched = startup.launch(writer.as_mut(), &command)?;
                if launched { record_input_activity(&id); }
                Ok(launched)
            }).await.map_err(|e| e.to_string())?;
        }
        if started.elapsed().as_secs() >= 30 {
            return Err("Shell did not show a ready prompt within 30 seconds. The startup command was not sent.".into());
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
}

#[tauri::command]
pub async fn write_terminal(id: String, data: String, instance_id: Option<u64>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || write_terminal_blocking(id, data, instance_id))
        .await.map_err(|e| e.to_string())?
}

pub(crate) fn write_terminal_blocking(id: String, data: String, instance_id: Option<u64>) -> Result<(), String> {
    let handles = {
        let guard = sessions().lock().map_err(|e| e.to_string())?;
        validate_write_instance(instance_id, guard.get(&id).map(|s| (
            s.instance_id, s.is_active.load(std::sync::atomic::Ordering::Acquire))))?;
        guard.get(&id).map(|s| (s.writer.clone(), s.is_active.clone()))
    };
    if let Some((writer, active)) = handles {
        let mut writer = writer.lock().map_err(|e| e.to_string())?;
        if !active.load(std::sync::atomic::Ordering::Acquire) { return Err("Terminal process exited before input".into()); }
        writer.write_all(data.as_bytes()).and_then(|_| writer.flush())
            .map_err(|e| format!("Failed to write to terminal: {e}"))?;
        if !data.is_empty() { record_input_activity(&id); }
    }
    Ok(())
}

fn output_flow(id: &str, instance_id: u64) -> Result<Arc<crate::terminal_flow::TerminalFlow>, String> {
    let guard = sessions().lock().map_err(|e| e.to_string())?;
    let session = guard.get(id).filter(|s| s.instance_id == instance_id)
        .ok_or("Terminal session changed before output subscription")?;
    Ok(session.flow.clone())
}

#[tauri::command]
pub fn attach_terminal_output(id: String, instance_id: u64) -> Result<u64, String> {
    Ok(output_flow(&id, instance_id)?.attach())
}

#[tauri::command]
pub fn acknowledge_terminal_output(id: String, instance_id: u64, lease: u64, offset: usize) -> Result<(), String> {
    output_flow(&id, instance_id)?.acknowledge(lease, offset)
}

#[tauri::command]
pub fn detach_terminal_output(id: String, instance_id: u64, lease: u64) -> Result<(), String> {
    if let Ok(flow) = output_flow(&id, instance_id) { flow.detach(lease); }
    Ok(())
}

fn validate_write_instance(expected: Option<u64>, actual: Option<(u64, bool)>) -> Result<(), String> {
    if let Some(expected) = expected {
        if actual != Some((expected, true)) {
            return Err("Terminal session changed before input was sent".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn resize_terminal(id: String, cols: u16, rows: u16) -> Result<(), String> {
    if cols == 0 || rows == 0 {
        return Ok(()); // Ignore invalid resize events to avoid conhost freezes
    }
    let sessions_guard = sessions().lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions_guard.get(&id) {
        if !session.is_active.load(std::sync::atomic::Ordering::Relaxed) {
            return Ok(());
        }
        let master = session.master.lock().map_err(|e| e.to_string())?;
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        Ok(())
    } else {
        // Session already closed / not found: harmless no-op during unmount
        Ok(())
    }
}

#[tauri::command]
pub fn get_terminal_history(id: String) -> Result<TerminalHistoryInfo, String> {
    let (history, startup, instance_id) = {
        let guard = sessions().lock().map_err(|e| e.to_string())?;
        let session = guard.get(&id).ok_or("Terminal session not found")?;
        (session.history.clone(), session.startup.clone(), session.instance_id)
    };
    let startup_pending = !startup.lock().map_err(|e| e.to_string())?.attempted;
    let mut history = history.lock().map_err(|e| e.to_string())?;
    Ok(TerminalHistoryInfo {
        startup_pending,
        bytes: history.bytes.iter().copied().collect(),
        instance_id,
        history: String::from_utf8_lossy(history.bytes.make_contiguous()).to_string(),
        total_read: history.total_read,
    })
}

#[tauri::command]
pub fn close_terminal(id: String) -> Result<(), String> {
    let mut sessions_guard = sessions().lock().map_err(|e| e.to_string())?;
    let removed = sessions_guard.remove(&id);
    drop(sessions_guard);
    drop(removed);
    clear_activity(&id);
    // Drop implementation handles process killing
    Ok(())
}

#[tauri::command]
pub fn reset_terminal<R: Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    shell: Option<String>,
) -> Result<TerminalCreateResult, String> {
    // Force remove and drop existing session to terminate process tree
    {
        let mut sessions_guard = sessions().lock().map_err(|e| e.to_string())?;
        sessions_guard.remove(&id);
    }
    clear_activity(&id);
    // Create fresh terminal session
    create_terminal(app, id, cols, rows, cwd, shell)
}

#[tauri::command]
pub fn has_active_process(id: String) -> Result<bool, String> {
    let pid = {
        let sessions_guard = sessions().lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions_guard.get(&id) {
            // A managed Unix CLI replaces its shell, so it need not have children.
            if session.managed_cli.lock().map_err(|e| e.to_string())?.is_some() {
                return Ok(session.is_active.load(std::sync::atomic::Ordering::Acquire));
            }
            session.pid
        } else {
            None
        }
    };

    let Some(pid) = pid else {
        return Ok(false);
    };

    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, ERROR_NO_MORE_FILES, INVALID_HANDLE_VALUE};
        use windows_sys::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        };

        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot == INVALID_HANDLE_VALUE {
                return Err(format!("Could not inspect terminal processes: {}", std::io::Error::last_os_error()));
            }
            if snapshot != INVALID_HANDLE_VALUE {
                let mut entry: PROCESSENTRY32W = std::mem::zeroed();
                entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

                if Process32FirstW(snapshot, &mut entry) != 0 {
                    loop {
                        if entry.th32ParentProcessID == pid {
                            CloseHandle(snapshot);
                            return Ok(true);
                        }
                        if Process32NextW(snapshot, &mut entry) == 0 {
                            let error = GetLastError();
                            if error != ERROR_NO_MORE_FILES {
                                CloseHandle(snapshot);
                                return Err(format!("Could not inspect terminal processes: {}", std::io::Error::from_raw_os_error(error as i32)));
                            }
                            break;
                        }
                    }
                } else {
                    let error = GetLastError();
                    if error != ERROR_NO_MORE_FILES {
                        CloseHandle(snapshot);
                        return Err(format!("Could not inspect terminal processes: {}", std::io::Error::from_raw_os_error(error as i32)));
                    }
                }
                CloseHandle(snapshot);
            }
        }
        Ok(false)
    }

    #[cfg(not(windows))]
    {
        let mut tree = crate::proc_inspect::cached_process_tree();
        if !tree.values().any(|parent| *parent == pid) {
            // Freshly launched children must not be rejected by a cached miss.
            tree = crate::proc_inspect::process_tree();
        }
        if tree.is_empty() {
            return Err("Could not inspect terminal processes. Process inspection is unavailable.".into());
        }
        Ok(tree.values().any(|parent| *parent == pid))
    }
}

/// Windows build number of the host, used to tell xterm which ConPTY behaviour
/// to expect (line-wrap heuristics and reflow differ before build 21376).
/// `None` on other platforms.
#[tauri::command]
pub fn get_windows_build_number() -> Option<u32> {
    #[cfg(windows)]
    {
        #[repr(C)]
        struct OsVersionInfoW {
            size: u32,
            major: u32,
            minor: u32,
            build: u32,
            platform: u32,
            service_pack: [u16; 128],
        }
        #[link(name = "ntdll")]
        extern "system" {
            fn RtlGetVersion(info: *mut OsVersionInfoW) -> i32;
        }
        let mut info = OsVersionInfoW { size: std::mem::size_of::<OsVersionInfoW>() as u32, major: 0, minor: 0, build: 0, platform: 0, service_pack: [0; 128] };
        // SAFETY: RtlGetVersion only writes into the correctly sized struct.
        if unsafe { RtlGetVersion(&mut info) } == 0 { Some(info.build) } else { None }
    }
    #[cfg(not(windows))]
    {
        None
    }
}

fn supports_exec(shell: Option<&str>) -> bool {
    if !cfg!(unix) { return false; }
    let default = std::env::var("SHELL").unwrap_or_default();
    matches!(std::path::Path::new(shell.unwrap_or(&default)).file_name().and_then(|name| name.to_str()),
        Some("sh" | "bash" | "zsh" | "dash" | "ksh" | "fish"))
}

#[cfg(unix)]
fn terminate_managed_group(pid: Option<u32>) {
    if let Some(pid) = pid.filter(|pid| *pid > 1 && *pid <= i32::MAX as u32) {
        // portable-pty starts a new session/process group; exec preserves it.
        unsafe { libc::kill(-(pid as i32), libc::SIGKILL); }
    }
}

fn managed_startup(command: &str, can_exec: bool) -> (String, Option<&'static str>) {
    let trimmed = command.trim();
    // Only simple, explicit Antigravity invocations. Preserve arbitrary shell
    // scripts, custom shells, pipelines and Windows launch semantics unchanged.
    let is_agy = trimmed == "agy" || trimmed.starts_with("agy ");
    if can_exec && is_agy && !trimmed.contains(['\n', '\r', ';', '&', '|', '<', '>', '$', '`']) {
        (format!("exec {trimmed}"), Some("agy"))
    } else { (command.to_owned(), None) }
}


#[cfg(test)]
mod activity_tests {
    use super::*;

    #[test]
    fn guarded_input_rejects_replaced_closed_or_missing_terminal_instances() {
        assert!(validate_write_instance(Some(7), Some((8, true))).is_err());
        assert!(validate_write_instance(Some(7), Some((7, false))).is_err());
        assert!(validate_write_instance(Some(7), None).is_err());
        assert!(validate_write_instance(Some(7), Some((7, true))).is_ok());
        assert!(validate_write_instance(None, None).is_ok());
    }

    #[test]
    fn submitted_input_reserves_a_quiet_terminal_before_any_echo() {
        let id = "test-input-reservation";
        set_test_output_time(id, Instant::now() - std::time::Duration::from_secs(10));
        assert!(ms_since_last_activity(id).unwrap() > 2500);
        record_input_activity(id);
        assert!(ms_since_last_activity(id).unwrap() < 2500);
        assert!(ms_since_last_output(id).unwrap() > 2500);
        clear_activity(id);
        assert_eq!(ms_since_last_activity(id), None);
    }
}


#[cfg(test)]
mod managed_tests {
    use super::*;

    #[cfg(unix)]
    fn wait_test_child(child: &mut dyn portable_pty::Child) -> portable_pty::ExitStatus {
        let started = Instant::now();
        loop {
            if let Some(status) = child.try_wait().unwrap() { return status; }
            if started.elapsed().as_secs() >= 3 {
                terminate_managed_group(child.process_id());
                panic!("Disposable PTY child did not exit within three seconds");
            }
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
    }


    #[test]
    fn arbitrary_shell_commands_are_never_rewritten() {
        assert_eq!(managed_startup("agy | tee out", true).1, None);
        assert_eq!(managed_startup("agy; echo done", true).1, None);
        assert_eq!(managed_startup("agy", false).0, "agy");
        assert_eq!(managed_startup("agy --mode plan", true).0, "exec agy --mode plan");
    }

    #[cfg(unix)]
    #[test]
    fn managed_cli_replaces_shell_and_waiter_observes_its_real_exit() {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempfile::tempdir().unwrap();
        let program = directory.path().join("agy");
        std::fs::write(&program, r#"#!/bin/sh
printf '%s:%s\n' "$$" "$1"
exit 7
"#).unwrap();
        std::fs::set_permissions(&program, std::fs::Permissions::from_mode(0o755)).unwrap();
        let pair = NativePtySystem::default().openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 }).unwrap();
        let mut command = CommandBuilder::new("/bin/sh");
        command.args(["-c", &managed_startup("agy --mode plan", true).0]);
        command.env("PATH", directory.path());
        let mut child = pair.slave.spawn_command(command).unwrap();
        drop(pair.slave);
        let pid = child.process_id().unwrap();
        let (mut reader, stop) = crate::terminal_reader::PtyReader::new(pair.master.as_raw_fd().unwrap()).unwrap();
        let status = wait_test_child(child.as_mut());
        stop.stop();
        assert_eq!(status.exit_code(), 7);
        let mut output = String::new();
        let _ = reader.read_to_string(&mut output);
        assert!(output.contains(&format!("{pid}:--mode")), "{output:?}");
    }

    #[cfg(unix)]
    #[test]
    fn managed_exit_cleans_up_children_that_ignore_hangup() {
        use std::io::BufRead;
        let pair = NativePtySystem::default().openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 }).unwrap();
        let mut command = CommandBuilder::new("/bin/sh");
        command.args(["-c", "(trap '' HUP; exec /bin/sleep 30) & echo $!; /bin/sleep 0.05; exit 7"]);
        let mut child = pair.slave.spawn_command(command).unwrap();
        drop(pair.slave);
        let (reader, stop) = crate::terminal_reader::PtyReader::new(pair.master.as_raw_fd().unwrap()).unwrap();
        wait_test_child(child.as_mut());
        stop.stop();
        let mut reader = std::io::BufReader::new(reader);
        let mut line = String::new();
        reader.read_line(&mut line).unwrap();
        let descendant: u32 = line.trim().parse().unwrap();
        terminate_managed_group(child.process_id());
        let started = Instant::now();
        loop {
            let state = std::process::Command::new("/bin/ps").args(["-p", &descendant.to_string(), "-o", "stat="])
                .stdin(std::process::Stdio::null()).output().unwrap();
            let state = String::from_utf8_lossy(&state.stdout);
            if state.trim().is_empty() || state.trim_start().starts_with('Z') { break; }
            assert!(started.elapsed().as_secs() < 2, "Managed child still alive: {state}");
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
}

#[cfg(test)]
mod shell_kind_tests {
    use super::*;

    #[test]
    fn shells_are_recognised_by_executable_name() {
        assert_eq!(shell_kind_of(r"C:\Windows\System32\cmd.exe"), "cmd");
        assert_eq!(shell_kind_of("powershell.exe"), "powershell");
        assert_eq!(shell_kind_of("/usr/local/bin/pwsh"), "powershell");
        assert_eq!(shell_kind_of("/bin/zsh"), "zsh");
        assert_eq!(shell_kind_of("/usr/bin/fish"), "fish");
        assert_eq!(shell_kind_of("/bin/dash"), "sh");
        assert_eq!(shell_kind_of("/opt/weird/nu"), "other");
    }

    #[test]
    fn a_missing_git_bash_reports_the_default_shell_not_gitbash() {
        if git_bash_path().is_none() {
            assert_eq!(requested_shell_kind(Some("gitbash")), default_shell_kind());
        }
        assert_eq!(requested_shell_kind(None), default_shell_kind());
    }

    #[test]
    fn available_shells_only_lists_shells_the_settings_page_knows() {
        let shells = available_shells();
        for shell in &shells {
            assert!(["powershell", "cmd", "bash", "zsh", "gitbash"].contains(shell));
        }
        #[cfg(windows)]
        assert!(shells.contains(&"cmd"));
        // A listed Git Bash must be startable, and the reverse.
        assert_eq!(shells.contains(&"gitbash"), git_bash_path().is_some());
    }

    #[test]
    fn a_shell_listed_as_available_is_not_reported_as_a_fallback() {
        for shell in available_shells() {
            assert_eq!(requested_shell_kind(Some(shell)), shell);
        }
    }
}

//! Read-only OS inspection used by the preview (which dev server is listening?) and by
//! the process supervisor (how much CPU/memory is a daemon and its children using?).
//!
//! Each platform has a small collector (Linux `/proc`, macOS `lsof`/`ps`, Windows
//! `netstat`/PowerShell) feeding pure parsers, which are unit-tested from sample output.

// The parsers for every platform are compiled everywhere so each can be unit-tested from
// sample output; a given platform only calls its own, hence the unused-function warnings.
#![allow(dead_code)]

use serde::Serialize;
use std::collections::{HashMap, HashSet};

#[derive(Serialize, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPort {
    pub port: u16,
    pub pid: u32,
}

/// pid -> parent pid for every visible process.
pub type ProcessTree = HashMap<u32, u32>;

/// Concurrent workspace/preview consumers share one short-lived OS snapshot.
/// Only diagnostic/preview paths use these; process exit remains event-driven.
fn sample_cached<T: Clone>(cache: &std::sync::Mutex<Option<(std::time::Instant, T)>>, collect: impl FnOnce() -> T) -> T {
    let mut cached = cache.lock().unwrap_or_else(|e| e.into_inner());
    if let Some((at, value)) = cached.as_ref() {
        if at.elapsed() < std::time::Duration::from_millis(1000) { return value.clone(); }
    }
    let value = collect();
    *cached = Some((std::time::Instant::now(), value.clone()));
    value
}

pub fn cached_process_tree() -> ProcessTree {
    static CACHE: std::sync::Mutex<Option<(std::time::Instant, ProcessTree)>> = std::sync::Mutex::new(None);
    sample_cached(&CACHE, process_tree)
}

pub fn cached_listening_ports() -> Vec<ListeningPort> {
    static CACHE: std::sync::Mutex<Option<(std::time::Instant, Vec<ListeningPort>)>> = std::sync::Mutex::new(None);
    sample_cached(&CACHE, listening_ports)
}

/// `root` and everything below it.
pub fn descendants(tree: &ProcessTree, roots: &[u32]) -> HashSet<u32> {
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for (&pid, &ppid) in tree {
        children.entry(ppid).or_default().push(pid);
    }
    let mut seen: HashSet<u32> = HashSet::new();
    let mut stack: Vec<u32> = roots.to_vec();
    while let Some(pid) = stack.pop() {
        if seen.insert(pid) {
            if let Some(kids) = children.get(&pid) {
                stack.extend(kids);
            }
        }
    }
    seen
}

// ---------------------------------------------------------------------------
// Pure parsers
// ---------------------------------------------------------------------------

/// `/proc/net/tcp{,6}` rows in the LISTEN state -> (port, socket inode).
pub fn parse_proc_net_tcp(text: &str) -> Vec<(u16, u64)> {
    text.lines()
        .skip(1)
        .filter_map(|line| {
            let f: Vec<&str> = line.split_whitespace().collect();
            // sl local_address rem_address st tx:rx tr:when retrnsmt uid timeout inode
            if f.get(3) != Some(&"0A") {
                return None;
            }
            let port = u16::from_str_radix(f.get(1)?.rsplit(':').next()?, 16).ok()?;
            let inode = f.get(9)?.parse().ok()?;
            Some((port, inode))
        })
        .collect()
}

/// `lsof -nP -iTCP -sTCP:LISTEN -Fpn` output -> listening ports.
pub fn parse_lsof(text: &str) -> Vec<ListeningPort> {
    let mut out = Vec::new();
    let mut pid = None;
    for line in text.lines() {
        if let Some(p) = line.strip_prefix('p') {
            pid = p.parse::<u32>().ok();
        } else if let (Some(name), Some(pid)) = (line.strip_prefix('n'), pid) {
            if let Some(port) = name.rsplit(':').next().and_then(|p| p.parse::<u16>().ok()) {
                out.push(ListeningPort { port, pid });
            }
        }
    }
    out
}

/// Windows `netstat -ano -p TCP` output -> listening ports.
pub fn parse_netstat_windows(text: &str) -> Vec<ListeningPort> {
    text.lines()
        .filter_map(|line| {
            let f: Vec<&str> = line.split_whitespace().collect();
            if f.len() < 5 || f[0] != "TCP" || f[3] != "LISTENING" {
                return None;
            }
            Some(ListeningPort {
                port: f[1].rsplit(':').next()?.parse().ok()?,
                pid: f[4].parse().ok()?,
            })
        })
        .collect()
}

/// `ps -Ao pid=,ppid=` or the PowerShell `pid,ppid` CSV -> process tree.
pub fn parse_pid_ppid(text: &str) -> ProcessTree {
    text.lines()
        .filter_map(|line| {
            let mut it = line.split(|c: char| c.is_whitespace() || c == ',').filter(|s| !s.is_empty());
            Some((it.next()?.parse().ok()?, it.next()?.parse().ok()?))
        })
        .collect()
}

/// `ps -Ao pid=,pcpu=,rss=` -> pid -> (cpu %, rss KiB).
pub fn parse_ps_usage(text: &str) -> HashMap<u32, (f32, u64)> {
    text.lines()
        .filter_map(|line| {
            let f: Vec<&str> = line.split_whitespace().collect();
            Some((f.first()?.parse().ok()?, (f.get(1)?.parse().ok()?, f.get(2)?.parse().ok()?)))
        })
        .collect()
}

/// utime + stime (clock ticks) from a `/proc/<pid>/stat` line. The comm field can contain
/// spaces and parentheses, so fields are counted from the LAST `)`.
pub fn parse_stat_cpu_ticks(stat: &str) -> Option<u64> {
    let rest = &stat[stat.rfind(')')? + 1..];
    let f: Vec<&str> = rest.split_whitespace().collect();
    // After `)`: state ppid pgrp session tty tpgid flags minflt cminflt majflt cmajflt utime stime
    Some(f.get(11)?.parse::<u64>().ok()? + f.get(12)?.parse::<u64>().ok()?)
}

pub fn parse_stat_ppid(stat: &str) -> Option<u32> {
    let rest = &stat[stat.rfind(')')? + 1..];
    rest.split_whitespace().nth(1)?.parse().ok()
}

// ---------------------------------------------------------------------------
// Collectors
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
pub fn process_tree() -> ProcessTree {
    let mut tree = ProcessTree::new();
    if let Ok(dir) = std::fs::read_dir("/proc") {
        for entry in dir.flatten() {
            let Some(pid) = entry.file_name().to_str().and_then(|n| n.parse::<u32>().ok()) else { continue };
            if let Some(ppid) = std::fs::read_to_string(entry.path().join("stat")).ok().and_then(|s| parse_stat_ppid(&s)) {
                tree.insert(pid, ppid);
            }
        }
    }
    tree
}

#[cfg(target_os = "linux")]
pub fn listening_ports() -> Vec<ListeningPort> {
    let mut by_inode: HashMap<u64, u16> = HashMap::new();
    for file in ["/proc/net/tcp", "/proc/net/tcp6"] {
        if let Ok(text) = std::fs::read_to_string(file) {
            for (port, inode) in parse_proc_net_tcp(&text) {
                by_inode.insert(inode, port);
            }
        }
    }
    let mut out = Vec::new();
    if by_inode.is_empty() {
        return out;
    }
    if let Ok(dir) = std::fs::read_dir("/proc") {
        for entry in dir.flatten() {
            let Some(pid) = entry.file_name().to_str().and_then(|n| n.parse::<u32>().ok()) else { continue };
            // Other users' processes are unreadable, which is exactly the scope we want.
            let Ok(fds) = std::fs::read_dir(entry.path().join("fd")) else { continue };
            for fd in fds.flatten() {
                let Ok(target) = std::fs::read_link(fd.path()) else { continue };
                let target = target.to_string_lossy();
                if let Some(inode) = target.strip_prefix("socket:[").and_then(|t| t.strip_suffix(']')).and_then(|t| t.parse::<u64>().ok()) {
                    if let Some(&port) = by_inode.get(&inode) {
                        out.push(ListeningPort { port, pid });
                    }
                }
            }
        }
    }
    out.sort();
    out.dedup();
    out
}

#[cfg(target_os = "macos")]
fn run(program: &str, args: &[&str]) -> String {
    std::process::Command::new(program)
        .args(args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

/// OS utilities by absolute path: GUI-app PATHs must never break inspection.
#[cfg(target_os = "macos")]
pub fn process_tree() -> ProcessTree {
    parse_pid_ppid(&run("/bin/ps", &["-Ao", "pid=,ppid="]))
}

#[cfg(target_os = "macos")]
pub fn listening_ports() -> Vec<ListeningPort> {
    let mut ports = parse_lsof(&run("/usr/sbin/lsof", &["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"]));
    ports.sort();
    ports.dedup();
    ports
}

#[cfg(windows)]
fn run(program: &str, args: &[&str]) -> String {
    use std::os::windows::process::CommandExt;
    use std::process::Stdio;
    use std::sync::mpsc;
    use std::time::Duration;

    let mut cmd = std::process::Command::new(program);
    cmd.args(args);
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::null());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    let (tx, rx) = mpsc::channel();
    let mut stdout = child.stdout.take();

    std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut stream) = stdout.take() {
            let _ = std::io::Read::read_to_end(&mut stream, &mut buf);
        }
        let _ = tx.send(buf);
    });

    match rx.recv_timeout(Duration::from_secs(3)) {
        Ok(bytes) => {
            let _ = child.wait();
            String::from_utf8_lossy(&bytes).to_string()
        }
        Err(_) => {
            let _ = child.kill();
            String::new()
        }
    }
}

#[cfg(windows)]
pub fn process_tree() -> ProcessTree {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let mut tree = ProcessTree::new();
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot != INVALID_HANDLE_VALUE {
            let mut entry: PROCESSENTRY32W = std::mem::zeroed();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    tree.insert(entry.th32ProcessID, entry.th32ParentProcessID);
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);
        }
    }

    if tree.is_empty() {
        // Fallback only if native snapshot failed
        parse_pid_ppid(&run(
            "powershell",
            &["-NoProfile", "-Command", "Get-CimInstance Win32_Process | ForEach-Object { \"$($_.ProcessId),$($_.ParentProcessId)\" }"],
        ))
    } else {
        tree
    }
}

#[cfg(windows)]
pub fn listening_ports() -> Vec<ListeningPort> {
    let mut ports = parse_netstat_windows(&run("netstat", &["-ano", "-p", "TCP"]));
    ports.sort();
    ports.dedup();
    ports
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
pub fn process_tree() -> ProcessTree {
    ProcessTree::new()
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
pub fn listening_ports() -> Vec<ListeningPort> {
    Vec::new()
}

// ---------------------------------------------------------------------------
// CPU / memory of a process and everything below it
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub cpu_percent: Option<f32>,
    pub memory_kb: u64,
}

/// Remembers the previous CPU-tick reading so Linux can turn ticks into a percentage.
#[derive(Default)]
pub struct CpuMemo {
    last: Option<(std::time::Instant, u64)>,
}

#[cfg(target_os = "linux")]
pub fn usage_of(tree: &ProcessTree, root: u32, memo: &mut CpuMemo) -> Option<Usage> {
    let pids = descendants(tree, &[root]);
    let (clk, page) = unsafe { (libc::sysconf(libc::_SC_CLK_TCK) as f64, libc::sysconf(libc::_SC_PAGESIZE) as u64) };
    let (mut ticks, mut rss_pages, mut found) = (0u64, 0u64, false);
    for pid in pids {
        let Ok(stat) = std::fs::read_to_string(format!("/proc/{pid}/stat")) else { continue };
        found = true;
        ticks += parse_stat_cpu_ticks(&stat).unwrap_or(0);
        rss_pages += std::fs::read_to_string(format!("/proc/{pid}/statm"))
            .ok()
            .and_then(|s| s.split_whitespace().nth(1)?.parse::<u64>().ok())
            .unwrap_or(0);
    }
    if !found {
        return None;
    }
    let now = std::time::Instant::now();
    let cpu_percent = memo.last.and_then(|(at, prev)| {
        let secs = now.duration_since(at).as_secs_f64();
        (secs > 0.05).then(|| (ticks.saturating_sub(prev) as f64 / clk / secs * 100.0) as f32)
    });
    memo.last = Some((now, ticks));
    Some(Usage { cpu_percent, memory_kb: rss_pages * page / 1024 })
}

#[cfg(target_os = "macos")]
pub fn usage_of(tree: &ProcessTree, root: u32, _memo: &mut CpuMemo) -> Option<Usage> {
    let pids = descendants(tree, &[root]);
    let table = parse_ps_usage(&run("ps", &["-Ao", "pid=,pcpu=,rss="]));
    let rows: Vec<&(f32, u64)> = pids.iter().filter_map(|p| table.get(p)).collect();
    if rows.is_empty() {
        return None;
    }
    Some(Usage {
        cpu_percent: Some(rows.iter().map(|r| r.0).sum()),
        memory_kb: rows.iter().map(|r| r.1).sum(),
    })
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
pub fn usage_of(_tree: &ProcessTree, _root: u32, _memo: &mut CpuMemo) -> Option<Usage> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_proc_net_tcp_listeners_only() {
        let text = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n\
   0: 0100007F:0BB8 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 12345 1 0000 100 0 0 10 0\n\
   1: 0100007F:1F90 0100007F:D2A4 01 00000000:00000000 00:00000000 00000000  1000        0 999 1 0000 100 0 0 10 0\n\
   2: 00000000:1435 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 777 1 0000 100 0 0 10 0\n";
        assert_eq!(parse_proc_net_tcp(text), vec![(3000, 12345), (5173, 777)]);
    }

    #[test]
    fn parses_lsof_and_netstat() {
        let lsof = "p100\nn127.0.0.1:3000\nn[::1]:3000\np200\nn*:8080\nf5\n";
        assert_eq!(
            parse_lsof(lsof),
            vec![
                ListeningPort { port: 3000, pid: 100 },
                ListeningPort { port: 3000, pid: 100 },
                ListeningPort { port: 8080, pid: 200 },
            ]
        );
        let netstat = "Active Connections\n\n  Proto  Local Address          Foreign Address        State           PID\n  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       4321\n  TCP    127.0.0.1:50000        127.0.0.1:3000         ESTABLISHED     99\n  TCP    [::]:3010              [::]:0                 LISTENING       555\n";
        assert_eq!(
            parse_netstat_windows(netstat),
            vec![ListeningPort { port: 5173, pid: 4321 }, ListeningPort { port: 3010, pid: 555 }]
        );
    }

    #[test]
    fn parses_process_tables() {
        let tree = parse_pid_ppid("  1     0\n 10     1\n 11    10\n12,10\n");
        assert_eq!(tree.get(&11), Some(&10));
        assert_eq!(tree.get(&12), Some(&10));
        let mut kids: Vec<u32> = descendants(&tree, &[10]).into_iter().collect();
        kids.sort();
        assert_eq!(kids, vec![10, 11, 12]);

        let usage = parse_ps_usage("  10  1.5 20480\n  11  0.0   512\n");
        assert_eq!(usage.get(&10), Some(&(1.5, 20480)));
    }

    #[test]
    fn stat_parsing_survives_odd_process_names() {
        let stat = "4242 (my (weird) app) S 1 4242 4242 0 -1 4194560 100 0 0 0 250 50 0 0 20 0 1 0 100 1000 200 18446744073709551615";
        assert_eq!(parse_stat_ppid(stat), Some(1));
        assert_eq!(parse_stat_cpu_ticks(stat), Some(300));
    }

    #[test]
    fn descendants_handles_cycles_and_unknown_roots() {
        let mut tree = ProcessTree::new();
        tree.insert(1, 2);
        tree.insert(2, 1);
        assert_eq!(descendants(&tree, &[1]).len(), 2);
        assert_eq!(descendants(&tree, &[99]).len(), 1);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn finds_a_real_listener_and_own_usage() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let me = std::process::id();
        assert!(listening_ports().contains(&ListeningPort { port, pid: me }));

        let tree = process_tree();
        assert!(descendants(&tree, &[1]).contains(&me));
        let mut memo = CpuMemo::default();
        let first = usage_of(&tree, me, &mut memo).unwrap();
        assert!(first.memory_kb > 0 && first.cpu_percent.is_none());
        std::thread::sleep(std::time::Duration::from_millis(120));
        assert!(usage_of(&tree, me, &mut memo).unwrap().cpu_percent.is_some());
    }
}


#[cfg(test)]
mod cache_tests {
    use super::*;
    #[test]
    fn concurrent_consumers_share_one_sample_and_expiry_refreshes() {
        use std::sync::{Arc, Mutex, atomic::{AtomicUsize, Ordering}};
        let cache = Arc::new(Mutex::new(None));
        let calls = Arc::new(AtomicUsize::new(0));
        let workers: Vec<_> = (0..8).map(|_| {
            let (cache, calls) = (cache.clone(), calls.clone());
            std::thread::spawn(move || sample_cached(&cache, || calls.fetch_add(1, Ordering::SeqCst)))
        }).collect();
        for worker in workers { assert_eq!(worker.join().unwrap(), 0); }
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        *cache.lock().unwrap() = Some((std::time::Instant::now() - std::time::Duration::from_secs(2), 0));
        assert_eq!(sample_cached(&cache, || calls.fetch_add(1, Ordering::SeqCst)), 1);
    }
}

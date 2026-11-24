//! Native PATH handling shared by CLI discovery and PTYs. A Finder-launched app
//! does not inherit the login shell's tool managers. Never use Windows separators
//! on Unix, and never discard the user's configured tool precedence.

use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

pub fn unix_path(inherited: &OsStr, home: Option<&Path>, login: Option<&OsStr>) -> OsString {
  let mut paths: Vec<PathBuf> = Vec::new();
  if let Some(login) = login {
    paths.extend(std::env::split_paths(login));
  }
  paths.extend(std::env::split_paths(inherited));
  if let Some(home) = home {
    for directory in [
      ".local/bin",
      ".cargo/bin",
      ".bun/bin",
      ".volta/bin",
      ".npm-global/bin",
      ".antigravity/bin",
      ".agy/bin",
      "Library/pnpm",
      ".local/share/pnpm",
    ] {
      paths.push(home.join(directory));
    }
  }
  paths.extend(
    [
      "/opt/homebrew/bin",
      "/opt/homebrew/sbin",
      "/usr/local/bin",
      "/usr/local/sbin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
    ]
    .map(PathBuf::from),
  );
  let mut seen = HashSet::new();
  paths.retain(|path| {
    !path.as_os_str().is_empty()
      && seen.insert(path.clone())
      && std::env::join_paths([path]).is_ok()
  });
  std::env::join_paths(paths).unwrap_or_else(|_| inherited.to_owned())
}

pub fn process_path() -> OsString {
  let inherited = std::env::var_os("PATH").unwrap_or_default();
  let home = std::env::var_os("HOME").map(PathBuf::from);
  #[cfg(target_os = "macos")]
  let login = login_path();
  #[cfg(not(target_os = "macos"))]
  let login: Option<OsString> = None;
  unix_path(&inherited, home.as_deref(), login.as_deref())
}

#[cfg(any(target_os = "macos", test))]
fn parse_login_path(bytes: &[u8]) -> Option<OsString> {
  use std::os::unix::ffi::OsStringExt;
  let fields: Vec<_> = bytes.split(|byte| *byte == 0).collect();
  fields.windows(3).find_map(|fields| {
    (fields[0] == b"MARSHELL_PATH" && !fields[1].is_empty())
      .then(|| OsString::from_vec(fields[1].to_vec()))
  })
}

#[cfg(any(target_os = "macos", test))]
static LOGIN_PATH: std::sync::Mutex<Option<Option<OsString>>> = std::sync::Mutex::new(None);

#[cfg(any(target_os = "macos", test))]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn login_path() -> Option<OsString> {
  let mut cached = LOGIN_PATH.lock().unwrap_or_else(|error| error.into_inner());
  cached
    .get_or_insert_with(|| {
      let shell = std::env::var_os("SHELL")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute() && path.is_file())
        .unwrap_or_else(|| PathBuf::from("/bin/zsh"));
      probe_login_path(&shell, std::time::Duration::from_secs(3))
    })
    .clone()
}

#[cfg(target_os = "macos")]
pub fn invalidate_login_path() {
  *LOGIN_PATH.lock().unwrap_or_else(|error| error.into_inner()) = None;
}

#[cfg(any(target_os = "macos", test))]
fn probe_login_path(shell: &Path, timeout: std::time::Duration) -> Option<OsString> {
  use std::io::Read;
  use std::os::unix::process::CommandExt;
  use std::process::{Command, Stdio};
  use std::sync::mpsc;
  use std::time::{Duration, Instant};
  let mut command = Command::new(shell);
  let name = shell.file_name().and_then(|name| name.to_str());
  if matches!(name, Some("zsh" | "bash" | "sh" | "dash" | "ksh")) {
    // Interactive startup files contain tool-manager PATHs (notably .zshrc).
    // Disable job control before startup so the detached probe cannot suspend
    // itself while trying to acquire a controlling terminal.
    command.args(["-il", "+m", "-c"]);
  } else {
    // Do not pass POSIX job-control flags to shells such as fish.
    command.args(["-lc"]);
  }
  let mut child = command
    .arg("printf '\\0MARSHELL_PATH\\0%s\\0' \"$PATH\"")
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .process_group(0)
    .spawn()
    .ok()?;
  let mut stdout = child.stdout.take()?;
  let (send, receive) = mpsc::channel();
  std::thread::spawn(move || {
    let mut bytes = Vec::new();
    let mut chunk = [0; 4096];
    while bytes.len() < 65_536 {
      let Ok(read) = stdout.read(&mut chunk) else {
        break;
      };
      if read == 0 {
        break;
      }
      bytes.extend_from_slice(&chunk[..read]);
      if let Some(path) = parse_login_path(&bytes) {
        let _ = send.send(path);
        break;
      }
    }
  });
  let started = Instant::now();
  loop {
    if let Ok(path) = receive.try_recv() {
      // The PATH is ready; a hanging .zlogout or inherited child stdout must
      // not add the entire timeout to every first launch.
      unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
      }
      let _ = child.kill();
      let _ = child.wait();
      return Some(path);
    }
    match child.try_wait() {
      Ok(Some(_)) => return receive.recv_timeout(Duration::from_millis(100)).ok(),
      Ok(None) if started.elapsed() < timeout => std::thread::sleep(Duration::from_millis(20)),
      _ => {
        // Only this probe's isolated process group is terminated. A bad
        // shell profile must not hang app startup or leave children alive.
        unsafe {
          libc::kill(-(child.id() as i32), libc::SIGKILL);
        }
        let _ = child.kill();
        let _ = child.wait();
        return receive.recv_timeout(Duration::from_millis(100)).ok();
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[cfg(target_os = "macos")]
  #[test]
  fn detached_zsh_probe_reads_interactive_tool_manager_paths() {
    use std::os::unix::fs::PermissionsExt;
    let directory = tempfile::tempdir().unwrap();
    let shell = directory.path().join("zsh");
    let dotdir = directory.path().to_string_lossy().replace('\'', "'\\''");
    std::fs::write(
      directory.path().join(".zshrc"),
      "export PATH=\"/marshell-zshrc-tools/bin:$PATH\"\n",
    )
    .unwrap();
    std::fs::write(
      &shell,
      format!(
        "#!/bin/sh\nexport ZDOTDIR='{}'\nexec /bin/zsh \"$@\"\n",
        dotdir
      ),
    )
    .unwrap();
    std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o700)).unwrap();
    let path = probe_login_path(&shell, std::time::Duration::from_secs(3))
      .expect("detached interactive zsh should not be suspended by job control");
    assert!(
      std::env::split_paths(&path).any(|entry| entry == Path::new("/marshell-zshrc-tools/bin"))
    );
  }
  #[test]
  fn unix_paths_preserve_tool_precedence_spaces_and_case() {
    let path = unix_path(
      OsStr::new("/custom/node/bin:/usr/bin:/Tools:/tools"),
      Some(Path::new("/Users/Dev Name")),
      Some(OsStr::new(
        "/Users/Dev Name/.nvm/versions/node/v22/bin:/custom/node/bin",
      )),
    );
    let entries: Vec<_> = std::env::split_paths(&path).collect();
    assert_eq!(
      entries[0],
      PathBuf::from("/Users/Dev Name/.nvm/versions/node/v22/bin")
    );
    assert_eq!(entries[1], PathBuf::from("/custom/node/bin"));
    assert!(entries.contains(&PathBuf::from("/opt/homebrew/bin")));
    assert!(entries.contains(&PathBuf::from("/Users/Dev Name/.local/bin")));
    assert!(
      entries.contains(&PathBuf::from("/Tools")) && entries.contains(&PathBuf::from("/tools"))
    );
    assert_eq!(
      entries
        .iter()
        .filter(|path| **path == PathBuf::from("/custom/node/bin"))
        .count(),
      1
    );
    assert!(!path.to_string_lossy().contains(';'));
  }
  #[test]
  fn ignores_banners_and_partial_login_output() {
    assert_eq!(
      parse_login_path(b"welcome\n\0MARSHELL_PATH\0/custom/bin:/usr/bin\0goodbye"),
      Some(OsString::from("/custom/bin:/usr/bin"))
    );
    assert_eq!(
      parse_login_path(b"PATH=/wrong\n\0MARSHELL_PATH\0/incomplete"),
      None
    );
    assert_eq!(parse_login_path(b"\0MARSHELL_PATH\0\0"), None);
  }
  #[test]
  fn reads_a_real_login_shell_without_inheriting_stdin() {
    let path = probe_login_path(Path::new("/bin/sh"), std::time::Duration::from_secs(2));
    assert!(path.is_some());
    assert!(std::env::split_paths(&path.unwrap()).any(|path| path.is_absolute()));
  }
  #[test]
  fn a_hanging_profile_has_a_bounded_timeout() {
    use std::os::unix::fs::PermissionsExt;
    let directory = tempfile::tempdir().unwrap();
    let shell = directory.path().join("slow-shell");
    std::fs::write(&shell, "#!/bin/sh\nsleep 30\n").unwrap();
    std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o700)).unwrap();
    let started = std::time::Instant::now();
    assert!(probe_login_path(&shell, std::time::Duration::from_millis(100)).is_none());
    assert!(started.elapsed() < std::time::Duration::from_secs(2));
  }

  #[test]
  fn completed_path_does_not_wait_for_a_hanging_logout() {
    use std::os::unix::fs::PermissionsExt;
    let directory = tempfile::tempdir().unwrap();
    let shell = directory.path().join("slow-logout");
    std::fs::write(
      &shell,
      "#!/bin/sh\nprintf '\\0MARSHELL_PATH\\0/custom/bin:/usr/bin\\0'\nsleep 30\n",
    )
    .unwrap();
    std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o700)).unwrap();
    let started = std::time::Instant::now();
    assert_eq!(
      probe_login_path(&shell, std::time::Duration::from_secs(3)),
      Some(OsString::from("/custom/bin:/usr/bin"))
    );
    assert!(started.elapsed() < std::time::Duration::from_secs(1));
  }
}

use std::io::Write;

/// Owned by the PTY instance, so reattaching a webview cannot lose or repeat a launch.
#[derive(Default)]
pub struct TerminalStartup {
  pub attempted: bool,
}

impl TerminalStartup {
  pub fn launch(&mut self, writer: &mut dyn Write, command: &str) -> Result<bool, String> {
    if self.attempted || command.trim().is_empty() {
      return Ok(false);
    }
    // A failed write may have delivered a prefix. Never replay a command with
    // unknown side effects automatically, even if the IPC response was lost.
    self.attempted = true;
    writer
      .write_all(format!("{}\r", command.trim_end_matches(['\r', '\n'])).as_bytes())
      .and_then(|_| writer.flush())
      .map_err(|error| format!("Terminal startup command could not be written: {error}"))?;
    Ok(true)
  }
}

/// Inspect the last visible shell line, ignoring CSI/OSC styling and title sequences.
/// A welcome banner alone is not evidence that the shell can accept a command.
fn visible_terminal_text(bytes: &[u8]) -> String {
  let text = String::from_utf8_lossy(bytes);
  let mut visible = String::new();
  let mut chars = text.chars().peekable();
  while let Some(ch) = chars.next() {
    if ch == '\u{1b}' {
      match chars.next() {
        Some('[') => {
          for control in chars.by_ref() {
            if ('@'..='~').contains(&control) {
              break;
            }
          }
        }
        Some(']') => {
          while let Some(control) = chars.next() {
            if control == '\u{7}' {
              break;
            }
            if control == '\u{1b}' && chars.peek() == Some(&'\\') {
              chars.next();
              break;
            }
          }
        }
        _ => {}
      }
    } else if ch == '\n' || ch == '\r' {
      visible.push(ch);
    } else if !ch.is_control() {
      visible.push(ch);
    }
  }
  visible
}

const PROMPT_END_CHARS: [char; 14] = [
  '>', '$', '#', '%', '❯', '➜', '❱', 'λ', '→', '▶', '›', '»', ':', '·',
];

const PROMPT_START_CHARS: [char; 5] = ['❯', '➜', 'λ', '»', '›'];

pub fn has_shell_prompt(bytes: &[u8]) -> bool {
  let text = visible_terminal_text(bytes);
  let last_line = text
    .lines()
    .map(|l| l.trim())
    .filter(|l| !l.is_empty())
    .last()
    .unwrap_or_default();

  if last_line.is_empty() {
    return false;
  }

  // Shell themes starting with prompt symbols (e.g., Oh My Zsh robbyrussell: "➜  repo git:(main)")
  if last_line.starts_with(&PROMPT_START_CHARS[..]) {
    return true;
  }

  // PowerShell standard prompt (e.g. "PS C:\Users\name>")
  if last_line.starts_with("PS ") && last_line.ends_with('>') {
    return true;
  }

  // Standard prompts ending with prompt symbols
  if last_line.ends_with(&PROMPT_END_CHARS[..]) {
    return true;
  }

  // Also check if line contains a standard prompt character followed only by whitespace
  for ch in PROMPT_END_CHARS {
    if let Some(pos) = last_line.rfind(ch) {
      let suffix = &last_line[pos + ch.len_utf8()..];
      if suffix.trim().is_empty() {
        return true;
      }
    }
  }

  false
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn waits_for_the_prompt_not_the_welcome_banner() {
    assert!(!has_shell_prompt(
      b"Windows PowerShell\r\nLoading profile...\r\n"
    ));
    for prompt in [
      "PS D:\\project> ",
      "D:\\project>",
      "user@host:~/project$ ",
      "root# ",
      "project % ",
      "❯ ",
      "➜  project git:(main) ",
    ] {
      assert!(has_shell_prompt(prompt.as_bytes()), "{prompt}");
    }
    assert!(has_shell_prompt(
      b"\x1b]0;title\x07\x1b[32mPS D:\\project> \x1b[0m\x1b[?25h"
    ));
  }

  #[test]
  fn reattachments_and_retries_write_only_once() {
    let mut startup = TerminalStartup::default();
    let mut writer = Vec::new();
    assert!(startup.launch(&mut writer, "codex --yolo").unwrap());
    assert!(!startup.launch(&mut writer, "codex --yolo").unwrap());
    assert_eq!(writer, b"codex --yolo\r");
    assert!(TerminalStartup::default()
      .launch(&mut Vec::new(), "codex")
      .unwrap());
  }

  #[test]
  fn blank_commands_do_not_consume_the_launch() {
    let mut startup = TerminalStartup::default();
    assert!(!startup.launch(&mut Vec::new(), "  ").unwrap());
    assert!(!startup.attempted);
  }

  #[test]
  fn parallel_launch_requests_share_one_delivery() {
    let state = std::sync::Arc::new(std::sync::Mutex::new((
      TerminalStartup::default(),
      Vec::new(),
    )));
    let workers: Vec<_> = (0..8)
      .map(|_| {
        let state = state.clone();
        std::thread::spawn(move || {
          let mut guard = state.lock().unwrap();
          let (startup, writer) = &mut *guard;
          startup.launch(writer, "echo once").unwrap()
        })
      })
      .collect();
    assert_eq!(
      workers
        .into_iter()
        .map(|worker| worker.join().unwrap())
        .filter(|launched| *launched)
        .count(),
      1
    );
    assert_eq!(state.lock().unwrap().1, b"echo once\r");
  }

  #[test]
  fn failed_writes_are_reported_without_blindly_replaying_partial_input() {
    struct BrokenWriter;
    impl Write for BrokenWriter {
      fn write(&mut self, _: &[u8]) -> std::io::Result<usize> {
        Err(std::io::Error::other("disconnected"))
      }
      fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
      }
    }
    let mut startup = TerminalStartup::default();
    assert!(startup
      .launch(&mut BrokenWriter, "codex")
      .unwrap_err()
      .contains("disconnected"));
    assert!(!startup.launch(&mut Vec::new(), "codex").unwrap());
  }

  #[test]
  fn starts_the_command_once_in_real_shells_after_delayed_startup() {
    use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
    use std::io::Read;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};

    #[allow(unused_mut)]
    let mut commands = vec![CommandBuilder::new_default_prog()];
    #[cfg(windows)]
    {
      let mut powershell = CommandBuilder::new("powershell.exe");
      powershell.args([
        "-NoLogo",
        "-NoProfile",
        "-NoExit",
        "-Command",
        "Start-Sleep -Milliseconds 1500",
      ]);
      commands.push(powershell);
    }
    for command in commands {
      let pair = NativePtySystem::default()
        .openpty(PtySize {
          rows: 24,
          cols: 100,
          pixel_width: 0,
          pixel_height: 0,
        })
        .unwrap();
      let mut child = pair.slave.spawn_command(command).unwrap();
      drop(pair.slave);
      let mut writer = pair.master.take_writer().unwrap();
      let mut reader = pair.master.try_clone_reader().unwrap();
      let (send, receive) = mpsc::channel();
      let reading = std::thread::spawn(move || {
        let mut bytes = [0; 4096];
        while let Ok(length) = reader.read(&mut bytes) {
          if length == 0 || send.send(bytes[..length].to_vec()).is_err() {
            break;
          }
        }
      });
      let deadline = Instant::now() + Duration::from_secs(20);
      let mut output = Vec::new();
      let mut startup = TerminalStartup::default();
      let mut delivered = false;
      let mut executed = false;
      while Instant::now() < deadline {
        if let Ok(chunk) = receive.recv_timeout(Duration::from_millis(100)) {
          output.extend(chunk);
        }
        if !delivered && has_shell_prompt(&output) {
          assert!(startup
            .launch(writer.as_mut(), "echo marshell_first_launch_ok")
            .unwrap());
          assert!(!startup
            .launch(writer.as_mut(), "echo marshell_first_launch_ok")
            .unwrap());
          delivered = true;
          output.clear();
        }
        let text = visible_terminal_text(&output);
        // The result line may be preceded by \n or \r (bash shells with a
        // bracketed-paste PS0 emit \r before the command's output), so match a
        // whole output line instead of the exact newline-and-prefix bytes.
        if delivered
          && text.lines().any(|line| {
            let trimmed = line.trim();
            trimmed == "marshell_first_launch_ok"
              || (cfg!(windows)
                && !trimmed.contains("echo ")
                && trimmed.starts_with("marshell_first_launch_ok"))
          })
        {
          executed = true;
          break;
        }
      }
      let _ = child.kill();
      drop(writer);
      drop(pair.master);
      drop(receive);
      let _ = reading.join();
      assert!(
        delivered,
        "Shell prompt was not detected: {}",
        String::from_utf8_lossy(&output)
      );
      assert!(
        executed,
        "Command did not execute: {}",
        String::from_utf8_lossy(&output)
      );
    }
  }
}

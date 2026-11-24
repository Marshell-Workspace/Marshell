//! Non-interactive agent commands. Completion is child.wait(), never output silence.
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;
use tokio::sync::{oneshot, Notify};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellResult {
  pub job_id: String,
  pub status: String,
  pub exit_code: Option<i32>,
  pub stdout: String,
  pub stderr: String,
  pub timed_out: bool,
  pub cancelled: bool,
  pub duration_ms: u64,
  pub output_paths: Vec<String>,
}
struct Job {
  root: PathBuf,
  started: Instant,
  outputs: [(PathBuf, String); 2],
  result: Mutex<Option<ShellResult>>,
  cancel: Mutex<Option<oneshot::Sender<()>>>,
  done: Notify,
}
static JOBS: OnceLock<Mutex<HashMap<String, Arc<Job>>>> = OnceLock::new();
fn jobs() -> &'static Mutex<HashMap<String, Arc<Job>>> {
  JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}
fn owned_job(root: &str, job_id: &str) -> Result<Arc<Job>, String> {
  let root = Path::new(root).canonicalize().map_err(|e| e.to_string())?;
  jobs()
    .lock()
    .map_err(|e| e.to_string())?
    .get(job_id)
    .filter(|job| job.root == root)
    .cloned()
    .ok_or_else(|| "Shell job not found in this workspace".into())
}
fn result_or_running(job_id: &str, job: &Job) -> Result<ShellResult, String> {
  Ok(
    job
      .result
      .lock()
      .map_err(|e| e.to_string())?
      .clone()
      .unwrap_or_else(|| ShellResult {
        job_id: job_id.into(),
        status: "running".into(),
        exit_code: None,
        stdout: crate::tool_output::preview(&job.outputs[0].0, &job.outputs[0].1)
          .unwrap_or_default(),
        stderr: crate::tool_output::preview(&job.outputs[1].0, &job.outputs[1].1)
          .unwrap_or_default(),
        timed_out: false,
        cancelled: false,
        duration_ms: job.started.elapsed().as_millis() as u64,
        output_paths: job
          .outputs
          .iter()
          .map(|(_, relative)| relative.clone())
          .collect(),
      }),
  )
}
fn kill_group(pid: u32) {
  #[cfg(unix)]
  unsafe {
    libc::kill(-(pid as i32), libc::SIGKILL);
  }
  #[cfg(windows)]
  {
    let _ = std::process::Command::new("taskkill")
      .args(["/F", "/T", "/PID", &pid.to_string()])
      .creation_flags(0x08000000)
      .status();
  }
}
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[tauri::command]
pub async fn shell_exec(
  root: String,
  command: String,
  workdir: Option<String>,
  timeout_ms: Option<u64>,
) -> Result<ShellResult, String> {
  if command.trim().is_empty() {
    return Err("command must not be empty".into());
  }
  let root_path = Path::new(&root).canonicalize().map_err(|e| e.to_string())?;
  let requested = workdir.unwrap_or_else(|| ".".into());
  let cwd = root_path
    .join(requested)
    .canonicalize()
    .map_err(|e| e.to_string())?;
  if !cwd.starts_with(&root_path) || !cwd.is_dir() {
    return Err("workdir must be a directory inside this workspace".into());
  }
  let (out_path, out_relative, out_file) = crate::tool_output::create(&root_path, "stdout")?;
  let (err_path, err_relative, err_file) = crate::tool_output::create(&root_path, "stderr")?;
  #[cfg(unix)]
  let mut builder = {
    let mut c = tokio::process::Command::new("/bin/sh");
    c.args(["-c", &command]);
    c.process_group(0);
    c
  };
  #[cfg(windows)]
  let mut builder = {
    let mut c = tokio::process::Command::new("cmd.exe");
    c.args(["/D", "/S", "/C", &command]);
    c.creation_flags(0x08000000);
    c
  };
  builder
    .current_dir(cwd)
    .env("PATH", crate::build_merged_path())
    .stdin(Stdio::null())
    .stdout(Stdio::from(out_file))
    .stderr(Stdio::from(err_file))
    .kill_on_drop(true);
  // Bound retained jobs. Completed handles are disposable; output files remain available.
  let job_id = uuid::Uuid::new_v4().to_string();
  let (cancel_tx, mut cancel_rx) = oneshot::channel();
  let job = Arc::new(Job {
    root: root_path,
    started: Instant::now(),
    outputs: [
      (out_path.clone(), out_relative.clone()),
      (err_path.clone(), err_relative.clone()),
    ],
    result: Mutex::new(None),
    cancel: Mutex::new(Some(cancel_tx)),
    done: Notify::new(),
  });
  let mut guard = jobs().lock().map_err(|e| e.to_string())?;
  if guard.len() >= 32 {
    guard.retain(|_, item| {
      item
        .result
        .lock()
        .map(|value| value.is_none())
        .unwrap_or(true)
    });
  }
  if guard.len() >= 32 {
    return Err("Too many active shell jobs; wait for or cancel a job".into());
  }
  let mut child = builder
    .spawn()
    .map_err(|e| format!("Failed to start shell: {e}"))?;
  let pid = child.id().ok_or("Shell process has no PID")?;
  guard.insert(job_id.clone(), job.clone());
  drop(guard);
  let task_job = job.clone();
  let task_id = job_id.clone();
  let duration =
    std::time::Duration::from_millis(timeout_ms.unwrap_or(120_000).clamp(1, 3_600_000));
  tauri::async_runtime::spawn(async move {
    let mut timed_out = false;
    let mut cancelled = false;
    let outcome = tokio::select! {
        result = child.wait() => result,
        _ = tokio::time::sleep(duration) => { timed_out = true; kill_group(pid); let _ = child.kill().await; child.wait().await },
        _ = &mut cancel_rx => { cancelled = true; kill_group(pid); let _ = child.kill().await; child.wait().await },
    };
    // A shell can exit while leaving children holding output handles. Terminate its own process group.
    kill_group(pid);
    let mut stderr = crate::tool_output::preview(&err_path, &err_relative)
      .unwrap_or_else(|e| format!("Unable to read stderr: {e}"));
    let code = match outcome {
      Ok(status) => status.code(),
      Err(e) => {
        stderr.push_str(&format!("\nProcess wait failed: {e}"));
        None
      }
    };
    let result = ShellResult {
      job_id: task_id,
      status: "completed".into(),
      exit_code: code,
      stdout: crate::tool_output::preview(&out_path, &out_relative)
        .unwrap_or_else(|e| format!("Unable to read stdout: {e}")),
      stderr,
      timed_out,
      cancelled,
      duration_ms: task_job.started.elapsed().as_millis() as u64,
      output_paths: vec![out_relative, err_relative],
    };
    if let Ok(mut slot) = task_job.result.lock() {
      *slot = Some(result);
    }
    task_job.done.notify_waiters();
  });
  result_or_running(&job_id, &job)
}

#[tauri::command]
pub fn shell_status(root: String, job_id: String) -> Result<ShellResult, String> {
  result_or_running(&job_id, owned_job(&root, &job_id)?.as_ref())
}

#[tauri::command]
pub async fn shell_wait(root: String, job_id: String) -> Result<ShellResult, String> {
  let job = owned_job(&root, &job_id)?;
  loop {
    let notified = job.done.notified();
    tokio::pin!(notified);
    notified.as_mut().enable();
    let result = result_or_running(&job_id, &job)?;
    if result.status == "completed" {
      return Ok(result);
    }
    notified.await;
  }
}

#[tauri::command]
pub fn shell_cancel(root: String, job_id: String) -> Result<(), String> {
  let job = owned_job(&root, &job_id)?;
  if let Some(tx) = job.cancel.lock().map_err(|e| e.to_string())?.take() {
    let _ = tx.send(());
  }
  Ok(())
}

#[cfg(all(test, unix))]
mod tests {
  use super::*;
  #[tokio::test]
  async fn exact_exit_after_silent_pause_and_large_output() {
    let directory = tempfile::tempdir().unwrap();
    let root = directory.path().to_str().unwrap().to_owned();
    let launched = shell_exec(
      root.clone(),
      "printf 'Error 401: local stdout\\n'; sleep 3; seq 1 10000; printf 'err' >&2; exit 7".into(),
      None,
      None,
    )
    .await
    .unwrap();
    assert_eq!(launched.status, "running");
    assert_eq!(launched.exit_code, None);
    let done = shell_wait(root.clone(), launched.job_id).await.unwrap();
    assert_eq!(done.exit_code, Some(7));
    assert!(!done.timed_out);
    assert!(done.duration_ms >= 2900);
    assert!(done.stdout.contains("10000"));
    assert!(done.stdout.contains("401"));
    assert!(done.stderr.contains("err"));
    assert!(
      std::fs::read_to_string(directory.path().join(&done.output_paths[0]))
        .unwrap()
        .contains("5000\n")
    );
  }
  #[tokio::test]
  async fn timeout_cancel_and_workspace_isolation() {
    let directory = tempfile::tempdir().unwrap();
    let root = directory.path().to_str().unwrap().to_owned();
    let job = shell_exec(
      root.clone(),
      "printf start; sleep 30".into(),
      None,
      Some(100),
    )
    .await
    .unwrap();
    let outside = tempfile::tempdir().unwrap();
    assert!(shell_status(outside.path().to_str().unwrap().into(), job.job_id.clone()).is_err());
    let done = shell_wait(root.clone(), job.job_id).await.unwrap();
    assert!(done.timed_out);
    assert_ne!(done.exit_code, Some(0));
    let job = shell_exec(root.clone(), "sleep 30".into(), None, None)
      .await
      .unwrap();
    shell_cancel(root.clone(), job.job_id.clone()).unwrap();
    assert!(
      shell_wait(root.clone(), job.job_id)
        .await
        .unwrap()
        .cancelled
    );
    assert!(shell_exec(root, "pwd".into(), Some("..".into()), None)
      .await
      .is_err());
  }
}

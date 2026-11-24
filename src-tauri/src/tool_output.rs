use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

pub const MAX_INLINE_BYTES: u64 = 25 * 1024;

pub fn create(root: &Path, suffix: &str) -> Result<(PathBuf, String, File), String> {
  let root = root.canonicalize().map_err(|e| e.to_string())?;
  let mut directory = root.clone();
  for part in [".marshell", "tool-output"] {
    directory.push(part);
    match fs::symlink_metadata(&directory) {
      Ok(meta) if meta.file_type().is_symlink() || !meta.is_dir() => {
        return Err("Tool output directory must be a real directory inside the workspace".into())
      }
      Ok(_) => {}
      Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
        if let Err(error) = fs::create_dir(&directory) {
          if error.kind() != std::io::ErrorKind::AlreadyExists {
            return Err(error.to_string());
          }
        }
      }
      Err(e) => return Err(e.to_string()),
    }
    let metadata = fs::symlink_metadata(&directory).map_err(|e| e.to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
      return Err("Tool output directory must not be a symlink".into());
    }
    if !directory
      .canonicalize()
      .map_err(|e| e.to_string())?
      .starts_with(&root)
    {
      return Err("Tool output escaped the workspace".into());
    }
  }
  let stamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map_err(|e| e.to_string())?
    .as_millis();
  let hash = format!("{:x}", Sha256::digest(uuid::Uuid::new_v4().as_bytes()));
  let name = format!("output_{stamp}_{}_{suffix}.txt", &hash[..16]);
  let path = directory.join(&name);
  let mut options = OpenOptions::new();
  options.write(true).create_new(true);
  #[cfg(unix)]
  {
    use std::os::unix::fs::OpenOptionsExt;
    options.mode(0o600);
  }
  let file = options.open(&path).map_err(|e| e.to_string())?;
  Ok((path, format!(".marshell/tool-output/{name}"), file))
}

pub fn preview(path: &Path, relative: &str) -> Result<String, String> {
  let mut file = File::open(path).map_err(|e| e.to_string())?;
  let size = file.metadata().map_err(|e| e.to_string())?.len();
  if size <= MAX_INLINE_BYTES {
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    return Ok(String::from_utf8_lossy(&bytes).into_owned());
  }
  // Bound bytes as well as lines: a single minified line must not overwhelm IPC.
  let mut head = vec![0; 12 * 1024];
  let n = file.read(&mut head).map_err(|e| e.to_string())?;
  head.truncate(n);
  file.seek(SeekFrom::End(-8192)).map_err(|e| e.to_string())?;
  let mut tail = Vec::new();
  file.read_to_end(&mut tail).map_err(|e| e.to_string())?;
  let first = String::from_utf8_lossy(&head)
    .lines()
    .take(60)
    .collect::<Vec<_>>()
    .join("\n");
  let last = String::from_utf8_lossy(&tail)
    .lines()
    .rev()
    .take(40)
    .collect::<Vec<_>>()
    .into_iter()
    .rev()
    .collect::<Vec<_>>()
    .join("\n");
  Ok(format!("[Output exceeded 25KB. Showing first 60 and last 40 lines (byte bounded). Full output saved to: {relative}]\n{first}\n…\n{last}"))
}

#[tauri::command]
pub async fn save_tool_output(root: String, content: String) -> Result<String, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (_, relative, mut file) = create(Path::new(&root), "tool")?;
    file
      .write_all(content.as_bytes())
      .map_err(|e| e.to_string())?;
    Ok(relative)
  })
  .await
  .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn saves_complete_output_and_bounds_preview() {
    let root = tempfile::tempdir().unwrap();
    let (path, relative, mut file) = create(root.path(), "test").unwrap();
    let text = (0..2000)
      .map(|i| format!("line {i}: {}\n", "x".repeat(40)))
      .collect::<String>();
    file.write_all(text.as_bytes()).unwrap();
    let shown = preview(&path, &relative).unwrap();
    assert_eq!(fs::read_to_string(path).unwrap(), text);
    assert!(shown.contains("line 0:"));
    assert!(shown.contains("line 1999:"));
    assert!(!shown.contains("line 1000:"));
    assert!(shown.len() < 25 * 1024);
  }
  #[cfg(unix)]
  #[test]
  fn rejects_output_directory_symlinks() {
    let root = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::os::unix::fs::symlink(outside.path(), root.path().join(".marshell")).unwrap();
    assert!(create(root.path(), "test").is_err());
  }
}

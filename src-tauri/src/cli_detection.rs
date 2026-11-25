use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;

const AGENTS: &[(&str, &[&str])] = &[
  ("codex", &["codex"]),
  ("claude", &["claude"]),
  ("gemini-cli", &["gemini", "gemini-cli"]),
  ("agy", &["agy", "antigravity"]),
  ("opencode", &["opencode"]),
  ("q", &["q"]),
  ("github-copilot", &["copilot", "gh-copilot"]),
];

#[cfg(windows)]
const EXTENSIONS: &[&str] = &[".exe", ".cmd", ".bat", ".com"];
#[cfg(not(windows))]
const EXTENSIONS: &[&str] = &[""];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliDetectionResult {
  id: &'static str,
  status: &'static str,
  #[serde(skip_serializing_if = "Option::is_none")]
  executable: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  command_name: Option<&'static str>,
}

fn is_executable(path: &std::path::Path) -> bool {
  let Ok(metadata) = path.metadata() else {
    return false;
  };
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    metadata.is_file() && metadata.permissions().mode() & 0o111 != 0
  }
  #[cfg(not(unix))]
  metadata.is_file()
}

fn detect(paths: &[PathBuf]) -> HashMap<&'static str, CliDetectionResult> {
  AGENTS
    .iter()
    .map(|&(id, names)| {
      let found = paths
        .iter()
        .filter(|dir| dir.is_absolute())
        .find_map(|dir| {
          names.iter().find_map(|&name| {
            EXTENSIONS.iter().find_map(|extension| {
              let path = dir.join(format!("{name}{extension}"));
              is_executable(&path).then_some((name, path))
            })
          })
        });
      let (status, command_name, executable) = match found {
        Some((name, path)) => (
          "installed",
          Some(name),
          Some(path.to_string_lossy().into_owned()),
        ),
        None => ("not-installed", None, None),
      };
      (
        id,
        CliDetectionResult {
          id,
          status,
          executable,
          command_name,
        },
      )
    })
    .collect()
}

#[tauri::command]
pub async fn check_all_cli_agents(
  force: bool,
) -> Result<HashMap<&'static str, CliDetectionResult>, String> {
  tauri::async_runtime::spawn_blocking(move || {
    #[cfg(target_os = "macos")]
    if force {
      crate::process_environment::invalidate_login_path();
    }
    #[cfg(not(target_os = "macos"))]
    let _ = force;
    let paths = std::env::split_paths(&crate::build_merged_path()).collect::<Vec<_>>();
    detect(&paths)
  })
  .await
  .map_err(|error| error.to_string())
}

#[cfg(windows)]
pub fn windows_path() -> std::ffi::OsString {
  use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
  use winreg::RegKey;

  let inherited = std::env::var_os("PATH").unwrap_or_default();
  let mut paths: Vec<_> = std::env::split_paths(&inherited).collect();
  for (root, key) in [
    (
      HKEY_LOCAL_MACHINE,
      r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
    ),
    (HKEY_CURRENT_USER, "Environment"),
  ] {
    if let Ok(value) = RegKey::predef(root)
      .open_subkey(key)
      .and_then(|key| key.get_value::<String, _>("Path"))
    {
      let mut expanded = String::new();
      for (index, part) in value.split('%').enumerate() {
        if index % 2 == 0 {
          expanded.push_str(part);
        } else {
          expanded.push_str(&std::env::var(part).unwrap_or_else(|_| format!("%{part}%")));
        }
      }
      paths.extend(std::env::split_paths(&expanded));
    }
  }
  for (variable, directories) in [
    ("APPDATA", &["npm"][..]),
    (
      "LOCALAPPDATA",
      &[
        r"agy\bin",
        r"antigravity\bin",
        r"Programs\Antigravity\bin",
        r"Programs\agy\bin",
        r"Microsoft\WinGet\Links",
        "pnpm",
      ][..],
    ),
    (
      "USERPROFILE",
      &[r".local\bin", r".antigravity\bin", r".agy\bin"][..],
    ),
  ] {
    if let Some(root) = std::env::var_os(variable) {
      let root = PathBuf::from(root);
      paths.extend(directories.iter().map(|directory| root.join(directory)));
    }
  }
  let mut seen = std::collections::HashSet::new();
  paths.retain(|path| !path.as_os_str().is_empty() && seen.insert(path.clone()));
  std::env::join_paths(paths).unwrap_or(inherited)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn finds_antigravity_alias_and_reports_absent_agents() {
    let directory = tempfile::tempdir().unwrap();
    let antigravity = directory
      .path()
      .join(format!("antigravity{}", EXTENSIONS[0]));
    std::fs::write(&antigravity, "").unwrap();
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      assert_eq!(
        detect(&[directory.path().to_owned()])["agy"].status,
        "not-installed"
      );
      std::fs::set_permissions(&antigravity, std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    let results = detect(&[directory.path().to_owned()]);
    assert_eq!(results["agy"].command_name, Some("antigravity"));
    assert_eq!(results["agy"].executable.as_deref(), antigravity.to_str());
    assert_eq!(results["codex"].status, "not-installed");
    assert_eq!(results.len(), AGENTS.len());
  }
}

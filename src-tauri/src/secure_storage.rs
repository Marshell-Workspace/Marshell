use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

#[derive(Clone, Default)]
pub struct SecureStorageState(Arc<Mutex<crate::credential_session::CredentialSession>>);

const SERVICE_NAME: &str = "marshell";
const INDEX_FILENAME: &str = "secure_keys_index.json";
const FALLBACK_FILENAME: &str = "secure_store_fallback.json";

fn credential_service(identifier: &str) -> &str {
  // QA builds have a separate bundle identity and must not open production
  // Keychain items (which would also request access for a different signer).
  if identifier.ends_with(".qa") {
    identifier
  } else {
    SERVICE_NAME
  }
}

fn write_store_atomic(path: &Path, content: &[u8]) -> Result<(), String> {
  let parent = path
    .parent()
    .ok_or("Credential store has no parent directory")?;
  let temporary = parent.join(format!(".secure-store-{}.tmp", uuid::Uuid::new_v4()));
  let result = (|| -> std::io::Result<()> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
      use std::os::unix::fs::OpenOptionsExt;
      options.mode(0o600);
    }
    let mut file = options.open(&temporary)?;
    file.write_all(content)?;
    file.sync_all()?;
    drop(file);
    fs::rename(&temporary, path)
  })();
  if result.is_err() {
    let _ = fs::remove_file(&temporary);
  }
  result.map_err(|error| format!("Could not update credential store: {error}"))
}

fn read_fallback_map(path: &Path) -> Result<std::collections::HashMap<String, String>, String> {
  match fs::read(path) {
    Ok(content) => serde_json::from_slice(&content)
      .map_err(|_| "The legacy credential store is unreadable. It has been preserved.".to_string()),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Default::default()),
    Err(_) => Err("The legacy credential store cannot be read. It has been preserved.".to_string()),
  }
}

fn remove_fallback_key(path: &Path, key: &str) -> Result<(), String> {
  let mut map = read_fallback_map(path)?;
  if map.remove(key).is_some() {
    let content = serde_json::to_vec(&map).map_err(|_| "Could not encode credential store")?;
    write_store_atomic(path, &content)?;
  }
  Ok(())
}

fn get_index(app: &AppHandle) -> HashSet<String> {
  if let Ok(data_dir) = app.path().app_data_dir() {
    let path = data_dir.join(INDEX_FILENAME);
    if path.exists() {
      if let Ok(content) = fs::read_to_string(path) {
        if let Ok(keys) = serde_json::from_str::<HashSet<String>>(&content) {
          return keys;
        }
      }
    }
  }
  HashSet::new()
}

fn save_index(app: &AppHandle, keys: &HashSet<String>) {
  if let Ok(data_dir) = app.path().app_data_dir() {
    let _ = fs::create_dir_all(&data_dir);
    let path = data_dir.join(INDEX_FILENAME);
    if let Ok(content) = serde_json::to_string(keys) {
      let _ = write_store_atomic(&path, content.as_bytes());
    }
  }
}

// Fallback file storage if OS keychain is unavailable (e.g. headless Linux, CI)
fn fallback_get(app: &AppHandle, key: &str) -> Option<String> {
  if let Ok(data_dir) = app.path().app_data_dir() {
    let path = data_dir.join(FALLBACK_FILENAME);
    if path.exists() {
      if let Ok(content) = fs::read_to_string(path) {
        if let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, String>>(&content)
        {
          return map.get(key).cloned();
        }
      }
    }
  }
  None
}

fn fallback_set(app: &AppHandle, key: &str, value: &str) -> Result<(), String> {
  let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
  let path = data_dir.join(FALLBACK_FILENAME);
  let mut map = read_fallback_map(&path)?;
  map.insert(key.to_string(), value.to_string());
  let content = serde_json::to_string(&map).map_err(|e| e.to_string())?;
  write_store_atomic(&path, content.as_bytes())?;
  Ok(())
}

fn fallback_delete(app: &AppHandle, key: &str) -> Result<(), String> {
  let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let path = data_dir.join(FALLBACK_FILENAME);
  remove_fallback_key(&path, key)
}

fn set_credential(
  app: &AppHandle,
  key: String,
  value: String,
  session: &mut crate::credential_session::CredentialSession,
) -> Result<(), String> {
  let service = credential_service(&app.config().identifier);
  #[cfg(target_os = "macos")]
  {
    session.write(&key, &value, || {
      keyring::Entry::new(service, &key)?.set_password(&value)
    })?;
    // Remove a legacy plaintext copy only after its replacement is safe.
    fallback_delete(app, &key)?;
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = session;
    let entry = keyring::Entry::new(service, &key);
    let keyring_result = match entry {
      Ok(e) => e.set_password(&value),
      Err(e) => Err(e),
    };

    if let Err(err) = keyring_result {
      eprintln!(
        "Keyring set failed ({}), falling back to app-data store",
        err
      );
      fallback_set(&app, &key, &value)?;
    }
  }

  let mut index = get_index(&app);
  index.insert(key);
  save_index(&app, &index);

  Ok(())
}

fn get_credential(
  app: &AppHandle,
  key: String,
  session: &mut crate::credential_session::CredentialSession,
) -> Result<Option<String>, String> {
  let service = credential_service(&app.config().identifier);
  #[cfg(target_os = "macos")]
  {
    let value = session.read(&key, || keyring::Entry::new(service, &key)?.get_password())?;
    if value.is_some() {
      return Ok(value);
    }
    // Preserve existing installs: migrate a legacy fallback only once the
    // Keychain accepts it. Denial must never delete or downgrade credentials.
    if let Some(legacy) = fallback_get(app, &key) {
      session.write(&key, &legacy, || {
        keyring::Entry::new(service, &key)?.set_password(&legacy)
      })?;
      fallback_delete(app, &key)?;
      return Ok(Some(legacy));
    }
    Ok(None)
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = session;
    if let Ok(entry) = keyring::Entry::new(service, &key) {
      match entry.get_password() {
        Ok(val) => return Ok(Some(val)),
        Err(keyring::Error::NoEntry) => {
          return Ok(fallback_get(&app, &key));
        }
        Err(err) => {
          eprintln!("Keyring get failed ({}), checking fallback", err);
          return Ok(fallback_get(&app, &key));
        }
      }
    }
    Ok(fallback_get(&app, &key))
  }
}

fn delete_credential(
  app: &AppHandle,
  key: String,
  session: &mut crate::credential_session::CredentialSession,
) -> Result<(), String> {
  let service = credential_service(&app.config().identifier);
  #[cfg(target_os = "macos")]
  {
    // Remove the migration source first. Otherwise a failed local cleanup can
    // cause the next read to re-import a credential already deleted from Keychain.
    fallback_delete(app, &key)?;
    session.delete(&key, || {
      keyring::Entry::new(service, &key)?.delete_credential()
    })?;
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = session;
    if let Ok(entry) = keyring::Entry::new(service, &key) {
      let _ = entry.delete_credential();
    }
  }
  #[cfg(not(target_os = "macos"))]
  fallback_delete(&app, &key)?;

  let mut index = get_index(&app);
  index.remove(&key);
  save_index(&app, &index);

  Ok(())
}

#[tauri::command]
pub async fn secure_set(
  app: AppHandle,
  state: tauri::State<'_, SecureStorageState>,
  key: String,
  value: String,
) -> Result<(), String> {
  let state = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || {
    let mut session = state
      .0
      .lock()
      .map_err(|_| "Credential access is unavailable. Restart Marshell.")?;
    set_credential(&app, key, value, &mut session)
  })
  .await
  .map_err(|_| "Credential worker stopped.".to_string())?
}

#[tauri::command]
pub async fn secure_get(
  app: AppHandle,
  state: tauri::State<'_, SecureStorageState>,
  key: String,
) -> Result<Option<String>, String> {
  let state = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || {
    let mut session = state
      .0
      .lock()
      .map_err(|_| "Credential access is unavailable. Restart Marshell.")?;
    get_credential(&app, key, &mut session)
  })
  .await
  .map_err(|_| "Credential worker stopped.".to_string())?
}

#[tauri::command]
pub async fn secure_delete(
  app: AppHandle,
  state: tauri::State<'_, SecureStorageState>,
  key: String,
) -> Result<(), String> {
  let state = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || {
    let mut session = state
      .0
      .lock()
      .map_err(|_| "Credential access is unavailable. Restart Marshell.")?;
    delete_credential(&app, key, &mut session)
  })
  .await
  .map_err(|_| "Credential worker stopped.".to_string())?
}

/// Only an explicit Settings action may resume access after a denied OS prompt.
#[tauri::command]
pub async fn secure_retry_access(
  state: tauri::State<'_, SecureStorageState>,
) -> Result<(), String> {
  let state = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || {
    state
      .0
      .lock()
      .map_err(|_| "Credential access is unavailable. Restart Marshell.")?
      .retry();
    Ok(())
  })
  .await
  .map_err(|_| "Credential worker stopped.".to_string())?
}

#[tauri::command]
pub async fn secure_list(app: AppHandle, prefix: String) -> Result<Vec<String>, String> {
  let index = get_index(&app);
  let matching: Vec<String> = index
    .into_iter()
    .filter(|k| k.starts_with(&prefix))
    .collect();
  Ok(matching)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn qa_cannot_open_production_keychain_items() {
    assert_eq!(credential_service("com.marshell.app"), "marshell");
    assert_ne!(
      credential_service("com.marshell.app.qa"),
      credential_service("com.marshell.app")
    );
  }

  #[test]
  fn migration_removes_only_the_requested_legacy_credential() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("legacy.json");
    fs::write(&path, r#"{"migrated":"one","unmigrated":"two"}"#).unwrap();
    remove_fallback_key(&path, "migrated").unwrap();
    assert_eq!(
      read_fallback_map(&path).unwrap(),
      std::collections::HashMap::from([("unmigrated".to_string(), "two".to_string())])
    );
    assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      assert_eq!(
        fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o600
      );
    }
  }

  #[test]
  fn malformed_legacy_data_is_never_silently_overwritten() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("legacy.json");
    fs::write(&path, b"invalid legacy data").unwrap();
    assert!(remove_fallback_key(&path, "key").is_err());
    assert_eq!(fs::read(&path).unwrap(), b"invalid legacy data");
  }

  #[test]
  fn a_failed_atomic_replacement_leaves_the_original_intact() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("existing-directory");
    fs::create_dir(&path).unwrap();
    fs::write(path.join("original"), b"keep").unwrap();
    assert!(write_store_atomic(&path, b"new").is_err());
    assert_eq!(fs::read(path.join("original")).unwrap(), b"keep");
    assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
  }
}

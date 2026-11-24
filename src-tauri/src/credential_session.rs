//! Keep background work from repeatedly reopening a macOS Keychain dialog.
use std::collections::HashMap;

const ACCESS_PAUSED: &str = "macOS Keychain access is paused. Unlock your login Keychain or allow Marshell access, then choose Retry Keychain in Settings. Your saved credentials have not been removed.";

#[derive(Default)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub(crate) struct CredentialSession {
  values: HashMap<String, Option<String>>,
  paused: bool,
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
impl CredentialSession {
  fn failure(&mut self, error: keyring::Error) -> String {
    match error {
      keyring::Error::NoStorageAccess(_)
      | keyring::Error::PlatformFailure(_)
      | keyring::Error::NoDefaultStore => {
        self.paused = true;
        ACCESS_PAUSED.to_string()
      }
      _ => "The credential could not be accessed in the OS Keychain.".to_string(),
    }
  }

  pub(crate) fn read(
    &mut self,
    key: &str,
    read: impl FnOnce() -> Result<String, keyring::Error>,
  ) -> Result<Option<String>, String> {
    if let Some(value) = self.values.get(key) {
      return Ok(value.clone());
    }
    if self.paused {
      return Err(ACCESS_PAUSED.to_string());
    }
    let value = match read() {
      Ok(value) => Some(value),
      Err(keyring::Error::NoEntry) => None,
      Err(error) => return Err(self.failure(error)),
    };
    self.values.insert(key.to_string(), value.clone());
    Ok(value)
  }

  pub(crate) fn write(
    &mut self,
    key: &str,
    value: &str,
    write: impl FnOnce() -> Result<(), keyring::Error>,
  ) -> Result<(), String> {
    if self.paused {
      return Err(ACCESS_PAUSED.to_string());
    }
    if self.values.get(key).and_then(Option::as_deref) == Some(value) {
      return Ok(());
    }
    write().map_err(|error| self.failure(error))?;
    self.values.insert(key.to_string(), Some(value.to_string()));
    Ok(())
  }

  pub(crate) fn delete(
    &mut self,
    key: &str,
    delete: impl FnOnce() -> Result<(), keyring::Error>,
  ) -> Result<(), String> {
    if self.paused {
      return Err(ACCESS_PAUSED.to_string());
    }
    match delete() {
      Ok(()) | Err(keyring::Error::NoEntry) => {
        self.values.insert(key.to_string(), None);
        Ok(())
      }
      Err(error) => Err(self.failure(error)),
    }
  }

  pub(crate) fn retry(&mut self) {
    self.values.clear();
    self.paused = false;
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::cell::Cell;

  fn denied() -> keyring::Error {
    keyring::Error::NoStorageAccess(Box::new(std::io::Error::new(
      std::io::ErrorKind::PermissionDenied,
      "access cancelled",
    )))
  }

  #[test]
  fn repeated_reads_and_unchanged_writes_do_not_reopen_the_vault() {
    let mut session = CredentialSession::default();
    assert_eq!(
      session.read("key", || Ok("secret".into())).unwrap(),
      Some("secret".into())
    );
    assert_eq!(
      session
        .read("key", || panic!("repeated vault read"))
        .unwrap(),
      Some("secret".into())
    );
    session
      .write("key", "secret", || panic!("unchanged vault write"))
      .unwrap();
    session.write("key", "rotated", || Ok(())).unwrap();
    assert_eq!(
      session.read("key", || panic!("stale vault read")).unwrap(),
      Some("rotated".into())
    );
    session.delete("key", || Ok(())).unwrap();
    assert_eq!(
      session
        .read("key", || panic!("deleted value resurrected"))
        .unwrap(),
      None
    );
  }

  #[test]
  fn cancelled_access_pauses_background_attempts_until_explicit_retry() {
    let mut session = CredentialSession::default();
    assert!(session.read("key", || Err(denied())).is_err());
    assert!(session
      .read("other", || panic!("another permission dialog"))
      .is_err());
    assert!(session
      .write("key", "value", || panic!("write dialog after denial"))
      .is_err());
    assert!(session
      .delete("key", || panic!("delete dialog after denial"))
      .is_err());
    session.retry();
    assert_eq!(
      session.read("key", || Ok("unlocked".into())).unwrap(),
      Some("unlocked".into())
    );
  }

  #[test]
  fn missing_credentials_are_cached_but_can_be_saved_and_reloaded() {
    let mut session = CredentialSession::default();
    let reads = Cell::new(0);
    for _ in 0..5 {
      assert_eq!(
        session
          .read("missing", || {
            reads.set(reads.get() + 1);
            Err(keyring::Error::NoEntry)
          })
          .unwrap(),
        None
      );
    }
    assert_eq!(reads.get(), 1);
    session.write("missing", "new", || Ok(())).unwrap();
    session.retry();
    assert_eq!(
      session
        .read("missing", || Ok("external update".into()))
        .unwrap(),
      Some("external update".into())
    );
  }
}

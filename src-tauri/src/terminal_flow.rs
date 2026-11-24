//! Per-session byte credits. Only the current frontend lease can acknowledge
//! parsed output; PTY input and lifecycle events never acquire this lock for I/O.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Condvar, Mutex};

pub const HIGH_WATERMARK: usize = 256 * 1024;
const LOW_WATERMARK: usize = 64 * 1024;

#[derive(Default)]
struct Credits {
  lease: u64,
  attached: bool,
  produced: usize,
  consumed: usize,
}

#[derive(Default)]
pub struct TerminalFlow {
  credits: Mutex<Credits>,
  ready: Condvar,
}

impl TerminalFlow {
  pub fn attach(&self) -> u64 {
    let mut state = self.credits.lock().unwrap_or_else(|e| e.into_inner());
    state.lease += 1;
    state.attached = true;
    state.consumed = state.produced;
    self.ready.notify_all();
    state.lease
  }

  pub fn detach(&self, lease: u64) {
    let mut state = self.credits.lock().unwrap_or_else(|e| e.into_inner());
    if state.lease == lease {
      state.attached = false;
      self.ready.notify_all();
    }
  }

  pub fn acknowledge(&self, lease: u64, offset: usize) -> Result<(), String> {
    let mut state = self.credits.lock().map_err(|e| e.to_string())?;
    if !state.attached || state.lease != lease {
      return Ok(());
    }
    if offset > state.produced {
      return Err("Terminal acknowledgement exceeds produced output".into());
    }
    state.consumed = state.consumed.max(offset);
    self.ready.notify_all();
    Ok(())
  }

  pub fn produced(&self, count: usize) {
    let mut state = self.credits.lock().unwrap_or_else(|e| e.into_inner());
    state.produced = state.produced.saturating_add(count);
  }

  pub fn wait_for_capacity(&self, active: &AtomicBool) -> bool {
    let mut state = self.credits.lock().unwrap_or_else(|e| e.into_inner());
    if state.produced.saturating_sub(state.consumed) < HIGH_WATERMARK {
      return active.load(Ordering::Acquire);
    }
    while active.load(Ordering::Acquire)
      && state.attached
      && state.produced.saturating_sub(state.consumed) > LOW_WATERMARK
    {
      // A timeout also observes process cancellation if no frontend remains.
      state = self
        .ready
        .wait_timeout(state, std::time::Duration::from_millis(100))
        .unwrap_or_else(|e| e.into_inner())
        .0;
    }
    active.load(Ordering::Acquire)
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::{mpsc, Arc};

  #[test]
  fn slow_consumer_blocks_until_actual_consumption_and_rejects_future_ack() {
    let flow = Arc::new(TerminalFlow::default());
    let lease = flow.attach();
    flow.produced(HIGH_WATERMARK);
    assert!(flow.acknowledge(lease, HIGH_WATERMARK + 1).is_err());
    let (tx, rx) = mpsc::channel();
    let reader = flow.clone();
    let worker = std::thread::spawn(move || {
      tx.send(reader.wait_for_capacity(&AtomicBool::new(true)))
        .unwrap();
    });
    assert!(rx
      .recv_timeout(std::time::Duration::from_millis(40))
      .is_err());
    flow.acknowledge(lease, HIGH_WATERMARK).unwrap();
    assert!(rx.recv_timeout(std::time::Duration::from_secs(1)).unwrap());
    worker.join().unwrap();
  }

  #[test]
  fn old_attachment_cannot_detach_or_acknowledge_replacement() {
    let flow = TerminalFlow::default();
    let old = flow.attach();
    let current = flow.attach();
    flow.produced(HIGH_WATERMARK);
    flow.detach(old);
    flow.acknowledge(old, HIGH_WATERMARK).unwrap();
    let state = flow.credits.lock().unwrap();
    assert!(state.attached);
    assert_eq!(state.consumed, 0);
    drop(state);
    flow.detach(current);
    assert!(flow.wait_for_capacity(&AtomicBool::new(true)));
  }

  #[test]
  fn stop_wakes_a_reader_even_without_acknowledgements() {
    let flow = TerminalFlow::default();
    flow.attach();
    flow.produced(HIGH_WATERMARK);
    assert!(!flow.wait_for_capacity(&AtomicBool::new(false)));
  }
}

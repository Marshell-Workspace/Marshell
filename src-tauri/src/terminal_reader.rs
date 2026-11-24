//! Unix PTY EOF is not a portable process-lifetime signal. A separate socket
//! wakes an idle reader on child exit without a periodic polling timer.
use std::fs::File;
use std::io::{self, Read};
use std::os::fd::{AsRawFd, FromRawFd, RawFd};
use std::os::unix::net::UnixStream;
use std::sync::Arc;

pub struct ReaderStop(UnixStream);

impl ReaderStop {
  pub fn stop(&self) {
    let _ = self.0.shutdown(std::net::Shutdown::Write);
  }
}

pub struct PtyReader {
  terminal: File,
  stop: UnixStream,
}

impl PtyReader {
  pub fn new(fd: RawFd) -> io::Result<(Self, Arc<ReaderStop>)> {
    // Own the descriptor used for poll as well as read, avoiding fd reuse
    // when the session's original master is dropped during cancellation.
    let duplicate = unsafe { libc::fcntl(fd, libc::F_DUPFD_CLOEXEC, 0) };
    if duplicate < 0 {
      return Err(io::Error::last_os_error());
    }
    let terminal = unsafe { File::from_raw_fd(duplicate) };
    let (stop, sender) = UnixStream::pair()?;
    Ok((Self { terminal, stop }, Arc::new(ReaderStop(sender))))
  }
}

impl Read for PtyReader {
  fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
    if bytes.is_empty() {
      return Ok(0);
    }
    loop {
      let mut fds = [
        libc::pollfd {
          fd: self.terminal.as_raw_fd(),
          events: libc::POLLIN,
          revents: 0,
        },
        libc::pollfd {
          fd: self.stop.as_raw_fd(),
          events: libc::POLLIN,
          revents: 0,
        },
      ];
      if unsafe { libc::poll(fds.as_mut_ptr(), fds.len() as libc::nfds_t, -1) } < 0 {
        let error = io::Error::last_os_error();
        if error.kind() == io::ErrorKind::Interrupted {
          continue;
        }
        return Err(error);
      }
      if fds[0].revents & libc::POLLNVAL != 0 {
        return Err(io::Error::from_raw_os_error(libc::EBADF));
      }
      // Drain bytes already available before honoring the stop signal.
      if fds[0].revents & (libc::POLLIN | libc::POLLHUP | libc::POLLERR) != 0 {
        return match self.terminal.read(bytes) {
          Err(error) if error.raw_os_error() == Some(libc::EIO) => Ok(0),
          result => result,
        };
      }
      if fds[1].revents != 0 {
        return Ok(0);
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Write;

  #[test]
  fn child_exit_wakes_idle_reader_without_eof_from_the_terminal() {
    let (terminal, _still_open) = UnixStream::pair().unwrap();
    let (mut reader, stop) = PtyReader::new(terminal.as_raw_fd()).unwrap();
    let (tx, rx) = std::sync::mpsc::channel();
    let worker = std::thread::spawn(move || tx.send(reader.read(&mut [0; 32])).unwrap());
    stop.stop();
    assert_eq!(
      rx.recv_timeout(std::time::Duration::from_secs(1))
        .unwrap()
        .unwrap(),
      0
    );
    worker.join().unwrap();
  }

  #[test]
  fn cancellation_drains_ready_bytes_before_stopping() {
    let (terminal, mut writer) = UnixStream::pair().unwrap();
    let (mut reader, stop) = PtyReader::new(terminal.as_raw_fd()).unwrap();
    writer.write_all(b"last output").unwrap();
    stop.stop();
    let mut output = String::new();
    reader.read_to_string(&mut output).unwrap();
    assert_eq!(output, "last output");
  }
}

//! Windows Notification Identity & Native Toast Dispatcher
//!
//! Ensures that notifications appear with "Marshell" as the sender and
//! with the Marshell app icon, both in development and production builds.

use std::path::PathBuf;
use tauri::AppHandle;
#[cfg(target_os = "windows")]
use tauri::Manager;

#[cfg(target_os = "windows")]
use tauri_winrt_notification::{IconCrop, Toast};

/// Registers the application identity in Windows Registry & current process.
pub fn register() {
  #[cfg(target_os = "windows")]
  {
    // 1. Set explicit process AUMID so Windows associates our windows with Marshell
    extern "system" {
      fn SetCurrentProcessExplicitAppUserModelID(AppID: *const u16) -> i32;
    }
    let aumid: Vec<u16> = "com.hyperion.desktop"
      .encode_utf16()
      .chain(std::iter::once(0))
      .collect();
    unsafe {
      let _ = SetCurrentProcessExplicitAppUserModelID(aumid.as_ptr());
    }

    // 2. Ensure HKCU registry key exists for com.hyperion.desktop in background thread
    std::thread::spawn(ensure_registry_entry);
  }
}

#[cfg(target_os = "windows")]
fn ensure_registry_entry() {
  let icon_path = find_or_extract_icon_path();
  let icon_str = icon_path
    .as_ref()
    .map(|p| p.to_string_lossy().to_string())
    .unwrap_or_default();

  use winreg::enums::{HKEY_CURRENT_USER, KEY_WRITE};
  use winreg::RegKey;

  let hkcu = RegKey::predef(HKEY_CURRENT_USER);
  if let Ok((key, _)) = hkcu.create_subkey_with_flags(
    r"Software\Classes\AppUserModelId\com.hyperion.desktop",
    KEY_WRITE,
  ) {
    let _ = key.set_value("DisplayName", &"Marshell");
    if !icon_str.is_empty() {
      let _ = key.set_value("IconUri", &icon_str);
    }
    let _ = key.set_value("ShowInSettings", &1u32);
  }

  // Notify Windows Explorer shell to refresh icon caches
  extern "system" {
    fn SHChangeNotify(
      wEventId: i32,
      uFlags: u32,
      dwItem1: *const std::ffi::c_void,
      dwItem2: *const std::ffi::c_void,
    );
  }
  unsafe {
    SHChangeNotify(0x0800_0000, 0, std::ptr::null(), std::ptr::null());
  }
}

/// Locate or extract the best icon for Windows Shell and WinRT notifications.
pub fn find_or_extract_icon_path() -> Option<PathBuf> {
  // Always synchronize the embedded crisp icon bytes to local app data so
  // upgrades over older versions never leave a stale icon behind.
  let base_dir = std::env::var_os("LOCALAPPDATA")
    .map(PathBuf::from)
    .unwrap_or_else(std::env::temp_dir);
  let marshell_dir = base_dir.join("Marshell");
  let _ = std::fs::create_dir_all(&marshell_dir);

  let icon_png = marshell_dir.join("icon.png");
  let png_bytes = include_bytes!("../icons/128x128.png");
  if std::fs::read(&icon_png).as_deref().ok() != Some(png_bytes) {
    let _ = std::fs::write(&icon_png, png_bytes);
  }

  let icon_ico = marshell_dir.join("icon.ico");
  let ico_bytes = include_bytes!("../icons/icon.ico");
  if std::fs::read(&icon_ico).as_deref().ok() != Some(ico_bytes) {
    let _ = std::fs::write(&icon_ico, ico_bytes);
  }

  if let Some(path) = find_icon_path() {
    return Some(path);
  }

  if icon_png.exists() {
    Some(icon_png)
  } else if icon_ico.exists() {
    Some(icon_ico)
  } else {
    None
  }
}

/// Locate the best icon (prefer PNG for WinRT toasts, fallback to ICO)
pub fn find_icon_path() -> Option<PathBuf> {
  let exe = std::env::current_exe().ok()?;
  let mut cur = exe.clone();
  for _ in 0..6 {
    cur.pop();
    let png = cur.join("icons").join("128x128.png");
    if png.exists() {
      return Some(png);
    }
    let icon_png = cur.join("icons").join("icon.png");
    if icon_png.exists() {
      return Some(icon_png);
    }
    let direct_png = cur.join("icon.png");
    if direct_png.exists() {
      return Some(direct_png);
    }
    let ico = cur.join("icons").join("icon.ico");
    if ico.exists() {
      return Some(ico);
    }
    let direct_ico = cur.join("icon.ico");
    if direct_ico.exists() {
      return Some(direct_ico);
    }
    let src_icons = cur.join("src-tauri").join("icons").join("128x128.png");
    if src_icons.exists() {
      return Some(src_icons);
    }
    let src_icon_png = cur.join("src-tauri").join("icons").join("icon.png");
    if src_icon_png.exists() {
      return Some(src_icon_png);
    }
  }
  None
}

/// Send a native Windows desktop notification with Marshell identity and logo.
#[tauri::command]
pub fn send_native_notification(
  app: AppHandle,
  title: String,
  body: String,
) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    let mut toast = Toast::new("com.hyperion.desktop")
      .title(&title)
      .text1(&body);

    if let Some(icon_path) = find_or_extract_icon_path() {
      toast = toast.icon(&icon_path, IconCrop::Square, "Marshell");
    }

    let app_handle = app.clone();
    toast = toast.on_activated(move |_| {
      if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
      Ok(())
    });

    toast.show().map_err(|e| format!("Failed to show notification: {e:?}"))?;

    // Also place the white dot badge on the taskbar icon
    let _ = set_taskbar_badge(app, true);
    return Ok(());
  }

  #[cfg(not(target_os = "windows"))]
  {
    // On non-Windows, title & body can be handled normally
    let _ = (app, title, body);
    Ok(())
  }
}

#[cfg(target_os = "windows")]
fn create_white_dot_image() -> tauri::image::Image<'static> {
  const WIDTH: u32 = 16;
  const HEIGHT: u32 = 16;
  let mut rgba = Vec::with_capacity((WIDTH * HEIGHT * 4) as usize);

  // Circular white dot centered at (7.5, 7.5) with radius 6.0
  let center_x = 7.5f32;
  let center_y = 7.5f32;
  let radius = 6.0f32;

  for y in 0..HEIGHT {
    for x in 0..WIDTH {
      let dx = x as f32 - center_x;
      let dy = y as f32 - center_y;
      let dist = (dx * dx + dy * dy).sqrt();

      if dist <= radius - 1.0 {
        // Pure solid white dot
        rgba.extend_from_slice(&[255, 255, 255, 255]);
      } else if dist <= radius {
        // Smooth anti-aliased edge
        let alpha = ((radius - dist) * 255.0) as u8;
        rgba.extend_from_slice(&[255, 255, 255, alpha]);
      } else if dist <= radius + 1.0 {
        // Subtle dark contrast shadow for visibility on light taskbars
        let shadow_alpha = ((radius + 1.0 - dist) * 120.0) as u8;
        rgba.extend_from_slice(&[20, 20, 20, shadow_alpha]);
      } else {
        // Transparent background
        rgba.extend_from_slice(&[0, 0, 0, 0]);
      }
    }
  }

  tauri::image::Image::new_owned(rgba, WIDTH, HEIGHT)
}

/// Sets or removes a white dot badge on the Windows taskbar icon.
#[tauri::command]
pub fn set_taskbar_badge(app: AppHandle, show: bool) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    if let Some(window) = app.get_webview_window("main") {
      if show {
        let dot_img = create_white_dot_image();
        let _ = window.set_overlay_icon(Some(dot_img));
      } else {
        let _ = window.set_overlay_icon(None);
      }
    }
  }

  // macOS Dock badge / Linux launcher (Unity-style) count. Not every Linux
  // desktop shows it; failures are harmless, so they are ignored.
  #[cfg(not(target_os = "windows"))]
  {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
      let _ = window.set_badge_count(if show { Some(1) } else { None });
    }
  }

  Ok(())
}

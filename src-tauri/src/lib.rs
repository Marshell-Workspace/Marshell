// Module declarations
mod auth;
mod credential_session;
mod external_editor;
pub mod fs_tools;
pub mod fs_write;
pub mod notification_identity;
mod preview_proxy;
mod proc_inspect;
#[cfg(unix)]
mod process_environment;
mod process_supervisor;
pub mod secure_storage;
mod shell_exec;
mod terminal;
mod terminal_flow;
#[cfg(unix)]
mod terminal_reader;
mod terminal_startup;
mod tool_output;
mod website_http;

use serde::Serialize;
use tauri::AppHandle;

pub(crate) fn build_merged_path() -> std::ffi::OsString {
  #[cfg(unix)]
  {
    process_environment::process_path()
  }
  #[cfg(not(unix))]
  {
    std::env::var_os("PATH").unwrap_or_default()
  }
}

#[derive(Serialize)]
struct GreetResponse {
  message_key: String,
  name: String,
  source: String,
}

#[derive(Serialize)]
struct DesktopMetadata {
  version: String,
  platform: &'static str,
}

#[tauri::command]
fn greet(name: &str) -> GreetResponse {
  GreetResponse {
    message_key: "successGreeting".to_string(),
    name: name.to_string(),
    source: "Tauri".to_string(),
  }
}

#[tauri::command]
fn desktop_metadata(app: AppHandle) -> DesktopMetadata {
  let platform = match std::env::consts::OS {
    "macos" => "darwin",
    other => other,
  };
  DesktopMetadata {
    version: app.package_info().version.to_string(),
    platform,
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  notification_identity::register();

  tauri::Builder::default()
    .manage(auth::AuthCallbackState::default())
    .manage(secure_storage::SecureStorageState::default())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_http::init())
    .setup(|app| {
      auth::start_auth_listener(app.handle().clone());

      #[cfg(desktop)]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          let icon_bytes = include_bytes!("../icons/128x128.png");
          if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
            let _ = window.set_icon(icon);
          } else if let Some(icon) = app.default_window_icon() {
            let _ = window.set_icon(icon.clone());
          }
        }
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      greet,
      desktop_metadata,
      tool_output::save_tool_output,
      shell_exec::shell_exec,
      shell_exec::shell_status,
      shell_exec::shell_wait,
      shell_exec::shell_cancel,
      website_http::website_request,
      notification_identity::send_native_notification,
      notification_identity::set_taskbar_badge,
      terminal::create_terminal,
      terminal::list_available_shells,
      terminal::launch_terminal_command,
      terminal::write_terminal,
      terminal::resize_terminal,
      terminal::get_terminal_history,
      terminal::get_windows_build_number,
      terminal::close_terminal,
      terminal::reset_terminal,
      terminal::has_active_process,
      terminal::attach_terminal_output,
      terminal::acknowledge_terminal_output,
      terminal::detach_terminal_output,
      fs_tools::list_dir,
      fs_tools::list_folder_contents,
      fs_tools::list_directory,
      fs_tools::list_windows_drives,
      fs_tools::get_system_drives,
      fs_tools::search_directory_folders,
      fs_tools::validate_folder_path,
      fs_tools::validate_path,
      fs_tools::get_parent_directory,
      fs_tools::create_directory,
      fs_tools::get_user_home_dir,
      fs_tools::read_text_file,
      fs_tools::grep_repo,
      fs_write::fs_resolve_path,
      fs_write::fs_create_file,
      fs_write::fs_create_dir,
      fs_write::fs_edit_file,
      fs_write::fs_move,
      fs_write::fs_delete,
      process_supervisor::process_start,
      process_supervisor::process_stop,
      process_supervisor::process_restart,
      process_supervisor::process_list,
      process_supervisor::process_logs,
      process_supervisor::process_remove,
      preview_proxy::preview_proxy_start,
      preview_proxy::preview_proxy_stop,
      preview_proxy::preview_probe_ports,
      preview_proxy::preview_detect_ports,
      external_editor::open_in_external_editor,
      auth::save_session,
      auth::get_auth_callback_port,
      auth::get_session,
      auth::clear_session,
      auth::open_browser,
      secure_storage::secure_set,
      secure_storage::secure_get,
      secure_storage::secure_delete,
      secure_storage::secure_list,
      secure_storage::secure_retry_access,
    ])
    .build(tauri::tauri_build_context!())
    .expect("error while building tauri application")
    .run(|_app, event| {
      // Background daemons must not outlive the app.
      if let tauri::RunEvent::Exit = event {
        process_supervisor::shutdown_all();
      }
    });
}

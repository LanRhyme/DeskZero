mod commands;
mod desktop;
mod models;
mod storage;

use tauri::Manager;

#[cfg(target_os = "windows")]
mod win_layer {
    use std::ffi::c_void;

    type HWND = *mut c_void;
    type BOOL = i32;
    type UINT = u32;

    extern "system" {
        pub fn SetWindowPos(
            hWnd: HWND,
            hWndInsertAfter: HWND,
            X: i32,
            Y: i32,
            cx: i32,
            cy: i32,
            uFlags: UINT,
        ) -> BOOL;
    }

    const HWND_BOTTOM: isize = 1;
    const SWP_NOMOVE: UINT = 0x0002;
    const SWP_NOSIZE: UINT = 0x0001;
    const SWP_NOACTIVATE: UINT = 0x0010;
    const SWP_SHOWWINDOW: UINT = 0x0040;

    pub fn set_window_bottom(hwnd: isize) {
        unsafe {
            SetWindowPos(
                hwnd as HWND,
                HWND_BOTTOM as HWND,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "windows")]
            {
                let hwnd = window.hwnd().unwrap();
                win_layer::set_window_bottom(hwnd.0 as isize);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::container::get_all_containers,
            commands::container::create_container,
            commands::container::update_container,
            commands::container::delete_container,
            commands::desktop::scan_desktop_icons,
            commands::file::open_file,
            commands::file::rename_file,
            commands::file::delete_file,
            commands::file::move_file,
            commands::system::get_settings,
            commands::system::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

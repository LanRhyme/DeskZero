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
    type LPCSTR = *const i8;

    extern "system" {
        pub fn FindWindowA(lpClassName: LPCSTR, lpWindowName: LPCSTR) -> HWND;
        pub fn FindWindowExA(hWndParent: HWND, hWndChildAfter: HWND, lpszClass: LPCSTR, lpszWindow: LPCSTR) -> HWND;
        pub fn SetParent(hWndChild: HWND, hWndNewParent: HWND) -> HWND;
        pub fn SetWindowPos(hWnd: HWND, hWndInsertAfter: HWND, X: i32, Y: i32, cx: i32, cy: i32, uFlags: UINT) -> BOOL;
        pub fn GetParent(hWnd: HWND) -> HWND;
        pub fn SendMessageA(hWnd: HWND, Msg: UINT, wParam: usize, lParam: isize) -> isize;
    }

    const HWND_TOP: isize = 0;
    const SWP_NOMOVE: UINT = 0x0002;
    const SWP_NOSIZE: UINT = 0x0001;
    const SWP_NOACTIVATE: UINT = 0x0010;
    const SWP_SHOWWINDOW: UINT = 0x0040;

    /// 将窗口嵌入到桌面图标层（WorkerW）
    /// 参考 Sapphire 的 inplace() 实现
    pub fn embed_into_desktop_layer(hwnd: isize) {
        unsafe {
            let progman = FindWindowA(b"Progman\0".as_ptr() as *const i8, std::ptr::null());

            // 发送消息让 Progman 创建 WorkerW 子窗口
            // 0x052C = 0x052C (WM_SPAWN_WORKERW)
            SendMessageA(progman, 0x052C, 0, 0);

            // 遍历所有 WorkerW 窗口，找到包含 SHELLDLL_DefView 的那个
            let mut worker: HWND = std::ptr::null_mut();
            loop {
                worker = FindWindowExA(
                    std::ptr::null_mut(),
                    worker,
                    b"WorkerW\0".as_ptr() as *const i8,
                    std::ptr::null(),
                );

                if worker.is_null() {
                    break;
                }

                let shelldlldefview = FindWindowExA(
                    worker,
                    std::ptr::null_mut(),
                    b"SHELLDLL_DefView\0".as_ptr() as *const i8,
                    std::ptr::null(),
                );

                if !shelldlldefview.is_null() {
                    // 找到了包含 SHELLDLL_DefView 的 WorkerW
                    // 将我们的窗口设置为其子窗口
                    SetParent(hwnd as HWND, worker);
                    SetWindowPos(
                        hwnd as HWND,
                        HWND_TOP as HWND,
                        0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
                    );
                    return;
                }
            }
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
                win_layer::embed_into_desktop_layer(hwnd.0 as isize);
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

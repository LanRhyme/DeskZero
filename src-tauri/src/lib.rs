mod commands;
mod desktop;
mod models;
mod storage;
mod clipboard;
mod context_menu;

use tauri::Manager;

/// Windows desktop layer integration
/// 将窗口嵌入到桌面图标层（壁纸和桌面图标之间）
#[cfg(target_os = "windows")]
mod win_layer {
    use std::ffi::c_void;

    type HWND = *mut c_void;
    type BOOL = i32;
    type UINT = u32;
    type LPCSTR = *const i8;

    extern "system" {
        fn FindWindowA(lpClassName: LPCSTR, lpWindowName: LPCSTR) -> HWND;
        fn FindWindowExA(hWndParent: HWND, hWndChildAfter: HWND, lpszClass: LPCSTR, lpszWindow: LPCSTR) -> HWND;
        fn SetParent(hWndChild: HWND, hWndNewParent: HWND) -> HWND;
        fn SetWindowPos(hWnd: HWND, hWndInsertAfter: HWND, X: i32, Y: i32, cx: i32, cy: i32, uFlags: UINT) -> BOOL;
        fn SetFocus(hWnd: HWND) -> HWND;
        fn SendMessageA(hWnd: HWND, Msg: UINT, wParam: usize, lParam: isize) -> isize;
        fn GetClassNameA(hWnd: HWND, lpClassName: *mut i8, nMaxCount: i32) -> i32;
        fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
        fn GetSystemMetrics(nIndex: i32) -> i32;
    }

    const SWP_SHOWWINDOW: UINT = 0x0040;
    const HWND_TOP: isize = 0;
    const SM_CXSCREEN: i32 = 0;
    const SM_CYSCREEN: i32 = 1;
    const SW_SHOW: i32 = 5;

    fn get_class_name(hwnd: HWND) -> String {
        unsafe {
            let mut buf = [0u8; 256];
            let len = GetClassNameA(hwnd, buf.as_mut_ptr() as *mut i8, 256);
            if len > 0 {
                String::from_utf8_lossy(&buf[..len as usize]).to_string()
            } else {
                String::new()
            }
        }
    }

    /// 嵌入窗口到桌面图标层
    /// 返回 true 表示成功嵌入
    pub fn embed_into_icon_layer(hwnd: isize) -> bool {
        unsafe {
            eprintln!("[DeskZero] Starting desktop layer embedding...");
            
            // Step 1: Find Progman (Program Manager)
            let progman = FindWindowA(
                b"Progman\0".as_ptr() as LPCSTR,
                b"Program Manager\0".as_ptr() as LPCSTR,
            );
            if progman.is_null() {
                eprintln!("[DeskZero] ERROR: Progman not found");
                return false;
            }
            eprintln!("[DeskZero] Found Progman: {:?}", progman);

            // Step 2: 发送 0x052C 消息，让 Progman 创建 WorkerW 窗口结构
            eprintln!("[DeskZero] Sending 0x052C message to Progman...");
            let result = SendMessageA(progman, 0x052C, 0, 0);
            eprintln!("[DeskZero] Sent 0x052C message, result: {}", result);

            // Step 3: 查找目标父窗口
            // 优先查找 Progman 的直接子窗口中的 SHELLDLL_DefView
            // 如果找不到，则查找 WorkerW 中的 SHELLDLL_DefView
            let mut target_parent: HWND = std::ptr::null_mut();

            // 3a: 先检查 Progman 的直接子窗口
            eprintln!("[DeskZero] Checking Progman's children...");
            let mut child = std::ptr::null_mut();
            loop {
                child = FindWindowExA(
                    progman,
                    child,
                    std::ptr::null(),
                    std::ptr::null(),
                );
                if child.is_null() {
                    break;
                }
                let class_name = get_class_name(child);
                if class_name == "SHELLDLL_DefView" {
                    eprintln!("[DeskZero] Found SHELLDLL_DefView as direct child of Progman");
                    target_parent = progman;
                    break;
                }
            }

            // 3b: 如果 Progman 中没有找到，检查 WorkerW 窗口
            if target_parent.is_null() {
                eprintln!("[DeskZero] Checking WorkerW windows...");
                let mut worker: HWND = std::ptr::null_mut();
                loop {
                    worker = FindWindowExA(
                        std::ptr::null_mut(),
                        worker,
                        b"WorkerW\0".as_ptr() as LPCSTR,
                        std::ptr::null(),
                    );
                    if worker.is_null() {
                        break;
                    }

                    let mut child = std::ptr::null_mut();
                    loop {
                        child = FindWindowExA(
                            worker,
                            child,
                            std::ptr::null(),
                            std::ptr::null(),
                        );
                        if child.is_null() {
                            break;
                        }
                        let class_name = get_class_name(child);
                        if class_name == "SHELLDLL_DefView" {
                            eprintln!("[DeskZero] Found SHELLDLL_DefView in WorkerW: {:?}", worker);
                            target_parent = worker;
                            break;
                        }
                    }
                    
                    if !target_parent.is_null() {
                        break;
                    }
                }
            }

            // Step 4: 如果找到了目标父窗口，执行嵌入
            if target_parent.is_null() {
                eprintln!("[DeskZero] ERROR: Could not find suitable parent window");
                return false;
            }

            eprintln!("[DeskZero] Setting parent to: {:?}", target_parent);
            
            // 4a: 设置父窗口
            let old_parent = SetParent(hwnd as HWND, target_parent);
            if old_parent.is_null() {
                eprintln!("[DeskZero] WARNING: SetParent returned null (might be first parent)");
            } else {
                eprintln!("[DeskZero] SetParent done, old parent: {:?}", old_parent);
            }
            
            // 4b: 获取屏幕尺寸并设置窗口位置
            let screen_width = GetSystemMetrics(SM_CXSCREEN);
            let screen_height = GetSystemMetrics(SM_CYSCREEN);
            eprintln!("[DeskZero] Screen size: {}x{}", screen_width, screen_height);
            
            // 4c: 设置窗口位置和大小（覆盖整个屏幕，高度加1以避免Wallpaper Engine识别为全屏导致暂停）
            SetWindowPos(
                hwnd as HWND,
                HWND_TOP as HWND,
                0, 0, screen_width, screen_height - 1,
                SWP_SHOWWINDOW,
            );
            
            // 4d: 显示窗口
            ShowWindow(hwnd as HWND, SW_SHOW);
            
            // 4e: 设置焦点
            SetFocus(hwnd as HWND);
            
            eprintln!("[DeskZero] Successfully embedded into desktop layer!");
            true
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            crate::desktop::watcher::start_desktop_watcher(app_handle);

            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "windows")]
            {
                let window_clone = window.clone();
                
                // 先隐藏窗口
                let _ = window.hide();
                eprintln!("[DeskZero] Window hidden before embedding");
                
                let hwnd = window.hwnd().unwrap().0 as isize;
                eprintln!("[DeskZero] Window HWND: {:?} (0x{:X})", hwnd, hwnd);

                // 在新线程中执行嵌入操作
                std::thread::spawn(move || {
                    // 等待窗口完全初始化
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    
                    // 尝试嵌入，最多重试 3 次
                    let max_retries = 3;
                    let mut success = false;
                    
                    for attempt in 1..=max_retries {
                        eprintln!("[DeskZero] Attempt {} to embed into icon layer...", attempt);
                        
                        if win_layer::embed_into_icon_layer(hwnd) {
                            success = true;
                            break;
                        }
                        
                        if attempt < max_retries {
                            eprintln!("[DeskZero] Embed failed, retrying in 500ms...");
                            std::thread::sleep(std::time::Duration::from_millis(500));
                        }
                    }
                    
                    if success {
                        // 嵌入成功，显示窗口
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        let _ = window_clone.show();
                        eprintln!("[DeskZero] Window shown after successful embedding");
                    } else {
                        // 嵌入失败，仍然显示窗口（作为普通窗口）
                        eprintln!("[DeskZero] WARNING: Failed to embed after {} attempts, showing as normal window", max_retries);
                        let _ = window_clone.show();
                    }
                });
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
            commands::system::close_settings_window,
            commands::system::drag_settings_window,
            clipboard::copy_files_to_clipboard,
            clipboard::get_files_from_clipboard,
            clipboard::paste_files_to_desktop,
            context_menu::show_context_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

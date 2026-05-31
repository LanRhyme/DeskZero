mod clipboard;
mod commands;
mod context_menu;
mod desktop;
mod models;
mod storage;

use tauri::Manager;

/// Windows desktop layer integration
/// 将窗口嵌入到桌面图标层（壁纸和桌面图标之间）
#[cfg(target_os = "windows")]
mod win_layer {
    use std::ffi::c_void;

    #[repr(C)]
    struct RECT {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    type HWND = *mut c_void;
    type BOOL = i32;
    type UINT = u32;
    type LPCSTR = *const i8;

    extern "system" {
        fn FindWindowA(lpClassName: LPCSTR, lpWindowName: LPCSTR) -> HWND;
        fn FindWindowExA(
            hWndParent: HWND,
            hWndChildAfter: HWND,
            lpszClass: LPCSTR,
            lpszWindow: LPCSTR,
        ) -> HWND;
        fn SetParent(hWndChild: HWND, hWndNewParent: HWND) -> HWND;
        fn SetWindowPos(
            hWnd: HWND,
            hWndInsertAfter: HWND,
            X: i32,
            Y: i32,
            cx: i32,
            cy: i32,
            uFlags: UINT,
        ) -> BOOL;
        fn SetFocus(hWnd: HWND) -> HWND;
        fn SendMessageA(hWnd: HWND, Msg: UINT, wParam: usize, lParam: isize) -> isize;
        fn GetClassNameA(hWnd: HWND, lpClassName: *mut i8, nMaxCount: i32) -> i32;
        fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
        fn GetClientRect(hWnd: HWND, lpRect: *mut RECT) -> BOOL;
        fn GetParent(hWnd: HWND) -> HWND;
    }

    #[cfg(target_pointer_width = "64")]
    extern "system" {
        fn GetWindowLongPtrA(hWnd: HWND, nIndex: i32) -> isize;
        fn SetWindowLongPtrA(hWnd: HWND, nIndex: i32, dwNewLong: isize) -> isize;
    }

    #[cfg(target_pointer_width = "32")]
    extern "system" {
        fn GetWindowLongA(hWnd: HWND, nIndex: i32) -> i32;
        fn SetWindowLongA(hWnd: HWND, nIndex: i32, dwNewLong: i32) -> i32;
    }

    #[cfg(target_pointer_width = "64")]
    fn get_window_long(hwnd: HWND, index: i32) -> isize {
        unsafe { GetWindowLongPtrA(hwnd, index) }
    }
    #[cfg(target_pointer_width = "64")]
    fn set_window_long(hwnd: HWND, index: i32, new_long: isize) -> isize {
        unsafe { SetWindowLongPtrA(hwnd, index, new_long) }
    }

    #[cfg(target_pointer_width = "32")]
    fn get_window_long(hwnd: HWND, index: i32) -> isize {
        unsafe { GetWindowLongA(hwnd, index) as isize }
    }
    #[cfg(target_pointer_width = "32")]
    fn set_window_long(hwnd: HWND, index: i32, new_long: isize) -> isize {
        unsafe { SetWindowLongA(hwnd, index, new_long as i32) as isize }
    }

    const SWP_SHOWWINDOW: UINT = 0x0040;
    const HWND_TOP: isize = 0;
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
            let mut target_parent: HWND = std::ptr::null_mut();

            // 3a: 先检查 Progman 的直接子窗口
            eprintln!("[DeskZero] Checking Progman's children...");
            let mut child = std::ptr::null_mut();
            loop {
                child = FindWindowExA(progman, child, std::ptr::null(), std::ptr::null());
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
                        child = FindWindowExA(worker, child, std::ptr::null(), std::ptr::null());
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

            // 4e: 设置焦点
            SetFocus(hwnd as HWND);

            eprintln!("[DeskZero] Successfully embedded into desktop layer!");
            true
        }
    }

    /// 强制修复窗口样式和尺寸，需要在 Tauri window.show() 后调用
    pub fn fix_window_styles(hwnd: isize) {
        unsafe {
            let sm_cxvirtualscreen = 78;
            let sm_cyvirtualscreen = 79;
            let sm_xvirtualscreen = 76;
            let sm_yvirtualscreen = 77;
            extern "system" { fn GetSystemMetrics(nIndex: i32) -> i32; }
            let _v_x = GetSystemMetrics(sm_xvirtualscreen);
            let _v_y = GetSystemMetrics(sm_yvirtualscreen);
            let v_width = GetSystemMetrics(sm_cxvirtualscreen);
            let v_height = GetSystemMetrics(sm_cyvirtualscreen);

            let gwl_style = -16;
            let ws_popup: isize = 0x80000000_u32 as isize;
            let ws_child: isize = 0x40000000;
            let ws_caption: isize = 0x00C00000;
            let ws_thickframe: isize = 0x00040000;
            let ws_sysmenu: isize = 0x00080000;
            
            let mut style = get_window_long(hwnd as HWND, gwl_style);
            style &= !ws_popup;
            style &= !ws_caption;
            style &= !ws_thickframe;
            style &= !ws_sysmenu;
            style |= ws_child;
            set_window_long(hwnd as HWND, gwl_style, style);

            let swp_framechanged: UINT = 0x0020;
            SetWindowPos(
                hwnd as HWND,
                HWND_TOP as HWND,
                0, 
                0,
                v_width,
                v_height - 1, // 关键：利用 Tauri 的全屏模式消除 8px 边框，但手动削减 1 像素以绕过壁纸引擎检测
                SWP_SHOWWINDOW | swp_framechanged,
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Err(e) = crate::storage::init() {
                eprintln!("[DeskZero] Storage initialization failed: {}", e);
            }

            use tauri::Emitter;

            let refresh_i = tauri::menu::MenuItem::with_id(app, "refresh", "刷新桌面", true, None::<&str>)?;
            let settings_i = tauri::menu::MenuItem::with_id(app, "settings", "DeskZero 设置", true, None::<&str>)?;
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&refresh_i, &settings_i, &quit_i])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "refresh" => {
                        app.emit("refresh-desktop", ()).unwrap();
                    }
                    "settings" => {
                        app.emit("open-settings", ()).unwrap();
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        app.emit("refresh-desktop", ()).unwrap();
                    }
                    _ => {}
                })
                .build(app)?;

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
                    // 开启 Tauri 全屏以彻底消除 Windows 隐形边框和拖拽栏
                    let _ = window_clone.set_fullscreen(true);
                    let _ = window_clone.set_decorations(false);
                    let _ = window_clone.set_resizable(false);
                    
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
                        
                        // Tauri 的 show() 可能会覆盖我们在 embed 时设置的样式，
                        // 导致重新出现 Windows 11 隐形边框。这里强制再次抹除边框并适应尺寸。
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        win_layer::fix_window_styles(hwnd);
                        eprintln!("[DeskZero] Window styles forcibly fixed after show()");
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
            commands::container::update_container_full,
            commands::container::delete_container,
            commands::desktop::scan_desktop_icons,
            commands::desktop::scan_directory_icons,
            commands::desktop::get_desktop_dir,
            commands::desktop::get_desktop_layout,
            commands::desktop::save_desktop_layout,
            commands::file::open_file,
            commands::file::rename_file,
            commands::file::delete_file,
            commands::file::move_file,
            commands::file::create_folder,
            commands::file::create_empty_file,
            commands::file::open_terminal,
            commands::file::read_shortcut_url,
            commands::file::run_as_admin,
            commands::file::open_file_location,
            commands::file::open_with_notepad,
            commands::file::show_open_with_dialog,
            commands::file::pin_to_taskbar,
            commands::file::create_shortcut_item,
            commands::file::show_properties_dialog,
            commands::system::get_settings,
            commands::system::save_settings,
            commands::system::close_settings_window,
            commands::system::drag_settings_window,
            commands::system::get_wallpaper_base64,
            commands::system::get_wallpaper_engine_preview,
            commands::system::capture_desktop_background,
            commands::file::trash_file,
            clipboard::copy_files_to_clipboard,
            clipboard::get_files_from_clipboard,
            clipboard::check_clipboard_has_files,
            clipboard::paste_files_to_desktop,
            clipboard::move_files_to_dir,
            context_menu::show_context_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

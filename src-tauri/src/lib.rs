mod backup_timer;
mod clipboard;
mod commands;
mod context_menu;
pub mod desktop;
mod models;
mod storage;
pub mod service;

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
                    target_parent = child; // 关键修复：直接作为 SHELLDLL_DefView 的子窗口
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
                            target_parent = child; // 关键修复：直接作为 SHELLDLL_DefView 的子窗口
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
            let v_x = GetSystemMetrics(sm_xvirtualscreen);
            let v_y = GetSystemMetrics(sm_yvirtualscreen);
            let v_width = GetSystemMetrics(sm_cxvirtualscreen);
            let v_height = GetSystemMetrics(sm_cyvirtualscreen);

            let gwl_style = -16;
            let gwl_exstyle = -20;
            let ws_popup: isize = 0x80000000_u32 as isize;
            let ws_child: isize = 0x40000000;
            let ws_caption: isize = 0x00C00000;
            let ws_thickframe: isize = 0x00040000;
            let ws_sysmenu: isize = 0x00080000;
            let ws_visible: isize = 0x10000000;

            // 修复常规样式
            let mut style = get_window_long(hwnd as HWND, gwl_style);
            style &= !ws_popup;
            style &= !ws_caption;
            style &= !ws_thickframe;
            style &= !ws_sysmenu;
            style |= ws_child;
            style |= ws_visible;
            set_window_long(hwnd as HWND, gwl_style, style);

            // 修复扩展样式：清除 WS_EX_LAYERED 和 WS_EX_TRANSPARENT
            // 在 WebView2 中，如果带有 WS_EX_LAYERED，CSS 的阴影（半透明像素）会因为 alpha 预乘 bug 显示为白边/白色阴影。
            // 因为现在 DeskZero 直接作为 SHELLDLL_DefView 的子窗口，不再需要 WS_EX_LAYERED 也能保证 Z-order 稳定，所以可以安全移除它！
            let ws_ex_layered: isize = 0x00080000;
            let ws_ex_transparent: isize = 0x00000020;
            let ws_ex_noactivate: isize = 0x08000000_u32 as isize;
            let ws_ex_toolwindow: isize = 0x00000080;
            let ws_ex_appwindow: isize = 0x00040000;

            let mut ex_style = get_window_long(hwnd as HWND, gwl_exstyle);
            ex_style &= !ws_ex_layered;
            ex_style &= !ws_ex_transparent;
            ex_style &= !ws_ex_noactivate;
            ex_style &= !ws_ex_toolwindow;
            ex_style &= !ws_ex_appwindow;
            set_window_long(hwnd as HWND, gwl_exstyle, ex_style);

            let swp_framechanged: UINT = 0x0020;
            SetWindowPos(
                hwnd as HWND,
                HWND_TOP as HWND,
                v_x,
                v_y,
                v_width,
                v_height - 1,
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
                return Err(format!("数据库初始化失败: {}", e).into());
            }

            // 初始化显示器信息
            match crate::desktop::monitor_scanner::enumerate_monitors() {
                Ok(monitors) => {
                    if let Err(e) = crate::storage::monitor_store::save_monitors(&monitors) {
                        eprintln!("[DeskZero] 保存显示器信息失败: {}", e);
                    } else {
                        eprintln!("[DeskZero] 检测到 {} 个显示器", monitors.len());
                    }
                }
                Err(e) => {
                    eprintln!("[DeskZero] 显示器枚举失败: {}", e);
                }
            }

            // 更新后恢复高优先级服务（安装包会先删除服务再替换 exe）
            crate::commands::system::ensure_service_if_needed();

            // 设置进程为高优先级，确保桌面渲染不被其他进程抢占
            #[cfg(target_os = "windows")]
            {
                use windows::Win32::System::Threading::{
                    GetCurrentProcess, SetPriorityClass, HIGH_PRIORITY_CLASS,
                };
                unsafe {
                    if let Err(e) = SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS) {
                        eprintln!("[DeskZero] 设置高优先级失败: {:?}", e);
                    } else {
                        eprintln!("[DeskZero] 已设置为高优先级 (HIGH_PRIORITY_CLASS)");
                    }
                }
            }

            use tauri::Emitter;

            let refresh_i = tauri::menu::MenuItem::with_id(app, "refresh", "刷新桌面", true, None::<&str>)?;
            let settings_i = tauri::menu::MenuItem::with_id(app, "settings", "DeskZero 设置", true, None::<&str>)?;
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&refresh_i, &settings_i, &quit_i])?;

            let tray_icon = app.default_window_icon().cloned()
                .expect("应用图标未加载，无法创建托盘图标");
            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "refresh" => {
                        let _ = app.emit("refresh-desktop", ());
                    }
                    "settings" => {
                        let _ = app.emit("open-settings", ());
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
                        let _ = app.emit("refresh-desktop", ());
                    }
                    _ => {}
                })
                .build(app)?;

            let app_handle = app.handle().clone();
            crate::desktop::watcher::start_desktop_watcher(app_handle);

            // 启动全屏检测器
            crate::desktop::fullscreen_detector::start_fullscreen_detector(app.handle().clone());

            let Some(window) = app.get_webview_window("main") else {
                eprintln!("[DeskZero] ERROR: main window not found");
                return Ok(());
            };

            #[cfg(target_os = "windows")]
            {
                let window_clone = window.clone();

                // 先隐藏窗口
                let _ = window.hide();
                eprintln!("[DeskZero] Window hidden before embedding");

                let hwnd = match window.hwnd() {
                    Ok(h) => h.0 as isize,
                    Err(e) => {
                        eprintln!("[DeskZero] ERROR: Failed to get HWND: {:?}", e);
                        let _ = window.show();
                        return Ok(());
                    }
                };
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

            // 启动自动备份定时器
            crate::backup_timer::start_backup_timer(app.handle().clone());

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
            commands::desktop::sync_windows_layout,
            commands::backup::create_backup,
            commands::backup::delete_backup,
            commands::backup::get_backup_data,
            commands::backup::get_backup_settings,
            commands::backup::list_backups,
            commands::backup::restore_backup,
            commands::backup::save_backup_settings,
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
            commands::file::trash_file,
            commands::file::check_files_exist,
            commands::file::read_file_content,
            commands::system::get_settings,
            commands::system::save_settings,
            commands::system::set_auto_start,
            commands::system::get_autostart_status,
            commands::system::close_settings_window,
            commands::system::drag_settings_window,
            commands::system::get_wallpaper_base64,
            commands::system::get_wallpaper_engine_preview,
            commands::system::capture_desktop_background,
            commands::system::get_system_info,
            commands::monitor::get_monitors,
            commands::monitor::refresh_monitors,
            commands::monitor::get_monitor_for_point,
            clipboard::copy_files_to_clipboard,
            clipboard::get_files_from_clipboard,
            clipboard::check_clipboard_has_files,
            clipboard::paste_files_to_desktop,
            clipboard::move_files_to_dir,
            context_menu::show_context_menu,
            commands::countdown::get_countdown_events,
            commands::countdown::add_countdown_event,
            commands::countdown::update_countdown_event,
            commands::countdown::delete_countdown_event,
            commands::todo::get_todo_items,
            commands::todo::add_todo_item,
            commands::todo::update_todo_item,
            commands::todo::delete_todo_item,
            commands::todo::reorder_todo_items,
            commands::calendar::get_calendar_events,
            commands::calendar::add_calendar_event,
            commands::calendar::delete_calendar_event,
            commands::weather::get_weather,
            commands::weather::get_location_by_ip,
            commands::music::get_music_status,
            commands::music::music_play_pause,
            commands::music::music_next,
            commands::music::music_prev,
            commands::music::music_seek,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

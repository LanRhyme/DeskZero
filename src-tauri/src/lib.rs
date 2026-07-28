mod backup_timer;
mod clipboard;
mod commands;
mod context_menu;
pub mod desktop;
mod models;
mod storage;
use tauri::Manager;

/// Windows desktop layer integration
/// 将窗口嵌入到桌面图标层（壁纸和桌面图标之间）
#[cfg(target_os = "windows")]
pub mod win_layer {
    use std::ffi::c_void;

    pub fn set_focus_hwnd(hwnd: isize) {
        unsafe {
            SetFocus(hwnd as HWND);
        }
    }

    #[repr(C)]
    struct RECT {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    pub type HWND = *mut c_void;
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
        // DWM API 用于消除 Windows 11 的隐形边框
        fn DwmSetWindowAttribute(
            hwnd: HWND,
            dwAttribute: u32,
            pvAttribute: *const c_void,
            cbAttribute: u32,
        ) -> i32;
        fn DwmExtendFrameIntoClientArea(hwnd: HWND, pMarInset: *const MARGINS) -> i32;
    }

    #[repr(C)]
    struct MARGINS {
        cxLeftWidth: i32,
        cxRightWidth: i32,
        cyTopHeight: i32,
        cyBottomHeight: i32,
    }

    #[cfg(target_pointer_width = "64")]
    extern "system" {
        fn GetWindowLongPtrA(hWnd: HWND, nIndex: i32) -> isize;
        fn SetWindowLongPtrA(hWnd: HWND, nIndex: i32, dwNewLong: isize) -> isize;
        fn CallWindowProcA(lpPrevWndFunc: isize, hWnd: HWND, Msg: UINT, wParam: usize, lParam: isize) -> isize;
        fn DefWindowProcA(hWnd: HWND, Msg: UINT, wParam: usize, lParam: isize) -> isize;
    }

    #[cfg(target_pointer_width = "32")]
    extern "system" {
        fn GetWindowLongA(hWnd: HWND, nIndex: i32) -> i32;
        fn SetWindowLongA(hWnd: HWND, nIndex: i32, dwNewLong: i32) -> i32;
        fn CallWindowProcA(lpPrevWndFunc: isize, hWnd: HWND, Msg: UINT, wParam: usize, lParam: isize) -> isize;
        fn DefWindowProcA(hWnd: HWND, Msg: UINT, wParam: usize, lParam: isize) -> isize;
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

    static OLD_WNDPROC: std::sync::atomic::AtomicIsize = std::sync::atomic::AtomicIsize::new(0);
    const WM_NCCALCSIZE: UINT = 0x0083;
    const WM_NCPAINT: UINT = 0x0085;
    const WM_NCHITTEST: UINT = 0x0084;
    const WM_MOUSEACTIVATE: UINT = 0x0021;
    const GWLP_WNDPROC: i32 = -4;

    unsafe extern "system" fn custom_wndproc(
        hwnd: HWND,
        msg: UINT,
        wparam: usize,
        lparam: isize,
    ) -> isize {
        match msg {
            WM_NCCALCSIZE => { return 0; }
            WM_NCPAINT => { return 0; }
            0x0086 => { // WM_NCACTIVATE
                return 1; // 防止切换窗口后出现白边
            }
            WM_MOUSEACTIVATE => {
                return 1; // MA_ACTIVATE
            }
            _ => {}
        }
        let old_ptr = OLD_WNDPROC.load(std::sync::atomic::Ordering::SeqCst);
        if old_ptr != 0 {
            CallWindowProcA(old_ptr, hwnd, msg, wparam, lparam)
        } else {
            DefWindowProcA(hwnd, msg, wparam, lparam)
        }
    }

    /// 使用互斥锁保护的子类化计数器，避免重复设置
    static SUBCLASS_COUNT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

    pub fn subclass_window(hwnd: isize) {
        unsafe {
            let hwnd_ptr = hwnd as HWND;
            // 每次都重新设置 WNDPROC
            let new_wndproc = set_window_long(hwnd_ptr, GWLP_WNDPROC, custom_wndproc as isize);
            
            // 如果 set_window_long 返回的不是 custom_wndproc 自身，
            // 说明这是第一次设置，或者上一个 WNDPROC 被其他代码修改了
            if new_wndproc != 0 && new_wndproc != custom_wndproc as isize {
                // 总是更新 OLD_WNDPROC 为最新的原始 WNDPROC
                //（例如 WebView2 初始化后注册了自己的 WNDPROC）
                let previous = OLD_WNDPROC.swap(new_wndproc, std::sync::atomic::Ordering::SeqCst);
                if previous == 0 {
                    eprintln!("[DeskZero] Subclass: recorded new original WNDPROC");
                } else {
                    eprintln!("[DeskZero] Subclass: updated original WNDPROC (was {:?}, now {:?})", previous, new_wndproc);
                }
            }
            let count = SUBCLASS_COUNT.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            eprintln!("[DeskZero] Subclass applied (count={})", count + 1);
        }
    }

    static SHELLDLL_HWND: std::sync::atomic::AtomicIsize = std::sync::atomic::AtomicIsize::new(0);

    pub fn restore_desktop_icons() {
        let shelldll = SHELLDLL_HWND.load(std::sync::atomic::Ordering::SeqCst) as HWND;
        if !shelldll.is_null() {
            unsafe { ShowWindow(shelldll, 5); } // SW_SHOW
        }
    }

    /// 嵌入窗口到桌面图标层（嵌入到壁纸层 WorkerW，在壁纸和图标之间）
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
            SendMessageA(progman, 0x052C, 0, 0);

            // Step 3: 查找 SHELLDLL_DefView（桌面图标容器）
            let mut shelldll: HWND = std::ptr::null_mut();

            // 3a: 先检查 Progman 的直接子窗口
            let mut child = std::ptr::null_mut();
            loop {
                child = FindWindowExA(progman, child, std::ptr::null(), std::ptr::null());
                if child.is_null() { break; }
                if get_class_name(child) == "SHELLDLL_DefView" {
                    shelldll = child;
                    eprintln!("[DeskZero] Found SHELLDLL_DefView in Progman: {:?}", shelldll);
                    break;
                }
            }

            // 3b: 如果 Progman 中没有，检查 WorkerW 窗口
            if shelldll.is_null() {
                let mut worker: HWND = std::ptr::null_mut();
                loop {
                    worker = FindWindowExA(std::ptr::null_mut(), worker,
                        b"WorkerW\0".as_ptr() as LPCSTR, std::ptr::null());
                    if worker.is_null() { break; }
                    let mut c = std::ptr::null_mut();
                    loop {
                        c = FindWindowExA(worker, c, std::ptr::null(), std::ptr::null());
                        if c.is_null() { break; }
                        if get_class_name(c) == "SHELLDLL_DefView" {
                            shelldll = c;
                            eprintln!("[DeskZero] Found SHELLDLL_DefView in WorkerW: {:?}", shelldll);
                            break;
                        }
                    }
                    if !shelldll.is_null() { break; }
                }
            }

            if shelldll.is_null() {
                eprintln!("[DeskZero] ERROR: Could not find SHELLDLL_DefView");
                return false;
            }
            SHELLDLL_HWND.store(shelldll as isize, std::sync::atomic::Ordering::SeqCst);

            // Step 4: 确定目标父窗口（拥有 SHELLDLL_DefView 的窗口）
            // 直接使用 Progman 或包含 SHELLDLL_DefView 的 WorkerW
            let target_parent = if shelldll == child { progman } else {
                // shelldll 在 WorkerW 中，找到包含它的 WorkerW
                let mut w: HWND = std::ptr::null_mut();
                loop {
                    w = FindWindowExA(std::ptr::null_mut(), w,
                        b"WorkerW\0".as_ptr() as LPCSTR, std::ptr::null());
                    if w.is_null() { break; }
                    let mut c = std::ptr::null_mut();
                    loop {
                        c = FindWindowExA(w, c, std::ptr::null(), std::ptr::null());
                        if c.is_null() { break; }
                        if c == shelldll { break; }
                    }
                    if c == shelldll { break; }
                }
                if w.is_null() { progman } else { w }
            };
            eprintln!("[DeskZero] SetParent to icon layer: {:?}", target_parent);
            SetParent(hwnd as HWND, target_parent);

            // 启动后台线程维持 Z-order
            let hwnd_isize = hwnd as isize;
            std::thread::spawn(move || {
                let swp_nomove: UINT = 0x0002;
                let swp_nosize: UINT = 0x0001;
                let swp_noactivate: UINT = 0x0010;
                let flags = swp_nomove | swp_nosize | swp_noactivate;
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                    SetWindowPos(
                        hwnd_isize as HWND,
                        HWND_TOP as HWND,
                        0, 0, 0, 0,
                        flags,
                    );
                }
            });

            eprintln!("[DeskZero] Successfully embedded into desktop layer!");
            true
        }
    }

    /// 仅清除窗口的标题栏、边框等非客户区样式（不改变父子关系，不调整位置）
    /// 适用于嵌入失败回退场景：窗口作为普通窗口显示但不应有标题栏
    pub fn strip_window_chrome(hwnd: isize) {
        unsafe {
            let gwl_style = -16;
            let gwl_exstyle = -20;
            let ws_popup: isize = 0x80000000_u32 as isize;
            let ws_caption: isize = 0x00C00000;
            let ws_thickframe: isize = 0x00040000;
            let ws_sysmenu: isize = 0x00080000;
            let ws_visible: isize = 0x10000000;

            // 清除标题栏、边框、系统菜单等
            let mut style = get_window_long(hwnd as HWND, gwl_style);
            style &= !ws_popup;
            style &= !ws_caption;
            style &= !ws_thickframe;
            style &= !ws_sysmenu;
            style |= ws_visible;
            set_window_long(hwnd as HWND, gwl_style, style);

            // 清除扩展样式：WS_EX_LAYERED / WS_EX_TRANSPARENT / WS_EX_APPWINDOW 等
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

            // 通知系统重新计算非客户区
            let swp_framechanged: UINT = 0x0020;
            let swp_nomove: UINT = 0x0002;
            let swp_nosize: UINT = 0x0001;
            let swp_nozorder: UINT = 0x0004;
            SetWindowPos(
                hwnd as HWND,
                HWND_TOP as HWND,
                0,
                0,
                0,
                0,
                swp_framechanged | swp_nomove | swp_nosize | swp_nozorder,
            );

            // 使用 DWM 消除 Windows 11 的隐形边框和圆角
            apply_dwm_borderless(hwnd);
        }
    }

    /// 使用 DWM API 消除 Windows 11 的隐形边框
    /// 1. 禁用窗口圆角（DWMWA_WINDOW_CORNER_PREFERENCE = 33，DWMWCP_DO_NOT_ROUND = 1）
    /// 2. 扩展边框到客户区（DwmExtendFrameIntoClientArea，所有边距=0 或 -1）
    /// 3. 禁用窗口边框绘制（DWMWA_NCRENDERING_POLICY = 2，DWMNCRP_DISABLED = 2）
    fn apply_dwm_borderless(hwnd: isize) {
        unsafe {
            // DWMWA_WINDOW_CORNER_PREFERENCE = 33
            // DWMWCP_DEFAULT = 0, DWMWCP_DONOTROUND = 1, DWMWCP_ROUND = 2, DWMWCP_ROUNDSMALL = 3
            let corner_pref: i32 = 1; // DWMWCP_DONOTROUND
            let _ = DwmSetWindowAttribute(
                hwnd as HWND,
                33,
                &corner_pref as *const i32 as *const c_void,
                std::mem::size_of::<i32>() as u32,
            );

            // DWMWA_NCRENDERING_POLICY = 2
            // DWMNCRP_USEWINDOWSTYLE = 0, DWMNCRP_DISABLED = 1, DWMNCRP_ENABLED = 2
            // 注意：有些文档说 DWMNCRP_DISABLED = 1，有些说 = 2，这里用 1
            let nc_policy: i32 = 1; // DWMNCRP_DISABLED
            let _ = DwmSetWindowAttribute(
                hwnd as HWND,
                2,
                &nc_policy as *const i32 as *const c_void,
                std::mem::size_of::<i32>() as u32,
            );

            // DwmExtendFrameIntoClientArea：将所有边距设为 -1 表示扩展到整个窗口
            // 这样 DWM 不会再绘制额外的边框
            let margins = MARGINS {
                cxLeftWidth: -1,
                cxRightWidth: -1,
                cyTopHeight: -1,
                cyBottomHeight: -1,
            };
            let _ = DwmExtendFrameIntoClientArea(hwnd as HWND, &margins);

            eprintln!("[DeskZero] DWM borderless attributes applied");
        }
    }

    /// 嵌入后修复：设置窗口覆盖整个虚拟屏幕，触发 WM_NCCALCSIZE 消除白边
    pub fn fix_window_after_embed(hwnd: isize, _set_fullscreen: bool) {
        unsafe {
            // 获取整个虚拟屏幕尺寸
            let sm_cxvirtualscreen = 78;
            let sm_cyvirtualscreen = 79;
            let sm_xvirtualscreen = 76;
            let sm_yvirtualscreen = 77;
            extern "system" { fn GetSystemMetrics(nIndex: i32) -> i32; }
            let v_x = GetSystemMetrics(sm_xvirtualscreen);
            let v_y = GetSystemMetrics(sm_yvirtualscreen);
            let v_width = GetSystemMetrics(sm_cxvirtualscreen);
            let v_height = GetSystemMetrics(sm_cyvirtualscreen);
            
            if v_width > 0 && v_height > 0 {
                SetWindowPos(
                    hwnd as HWND,
                    0 as HWND,
                    v_x, v_y, v_width, v_height,
                    0x0020, // SWP_FRAMECHANGED - 触发 WM_NCCALCSIZE 消除白边
                );
                eprintln!("[DeskZero] 窗口已覆盖虚拟屏幕: {}x{}+{},{}", v_width, v_height, v_x, v_y);
            }
        }
    }

    /// 强制修复窗口样式和尺寸，需要在 Tauri window.show() 后调用
    /// 仅用于嵌入成功场景：设置 ws_child 并覆盖整个虚拟屏幕
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

            // 先复用 strip_window_chrome 清除标题栏等通用样式
            strip_window_chrome(hwnd);

            // 嵌入成功专用：强制设置为子窗口样式并覆盖整个虚拟屏幕
            let gwl_style = -16;
            let ws_child: isize = 0x40000000;
            let ws_visible: isize = 0x10000000;
            let mut style = get_window_long(hwnd as HWND, gwl_style);
            style |= ws_child;
            style |= ws_visible;
            set_window_long(hwnd as HWND, gwl_style, style);

            let swp_framechanged: UINT = 0x0020;
            SetWindowPos(
                hwnd as HWND,
                HWND_TOP as HWND,
                v_x,
                v_y,
                v_width,
                v_height,
                swp_framechanged,
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

            // 启动时清理旧版 Windows 服务（如果存在）
            crate::commands::system::cleanup_old_service();

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
                
                // 在主线程立刻注入子类化
                win_layer::subclass_window(hwnd);

                // 在新线程中执行嵌入操作
                std::thread::spawn(move || {
                    // 设置全屏覆盖整个屏幕
                    let _ = window_clone.set_fullscreen(true);
                    let _ = window_clone.set_decorations(false);
                    let _ = window_clone.set_resizable(false);
                    
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    
                    // 尝试嵌入到壁纸层 WorkerW
                    let max_retries = 3;
                    let mut success = false;
                    
                    for attempt in 1..=max_retries {
                        eprintln!("[DeskZero] Attempt {} to embed into icon layer...", attempt);
                        if win_layer::embed_into_icon_layer(hwnd) {
                            success = true;
                            break;
                        }
                        if attempt < max_retries {
                            std::thread::sleep(std::time::Duration::from_millis(500));
                        }
                    }
                    
                    if success {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        let _ = window_clone.show();
                        eprintln!("[DeskZero] Window shown after successful embedding");
                        
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        win_layer::strip_window_chrome(hwnd);
                        win_layer::subclass_window(hwnd);
                        win_layer::fix_window_after_embed(hwnd, true);
                        eprintln!("[DeskZero] Window styles fixed after show()");
                        eprintln!("[DeskZero] Window styles fixed after show()");
                    } else {
                        eprintln!("[DeskZero] WARNING: Failed to embed, showing as normal window");
                        let fallback = window_clone.clone();
                        let _ = window_clone.run_on_main_thread(move || {
                            let _ = fallback.set_fullscreen(false);
                            let _ = fallback.set_decorations(false);
                            let _ = fallback.show();
                            win_layer::strip_window_chrome(hwnd);
                            win_layer::subclass_window(hwnd);
                        });
                    }
                });
            }

            // 启动自动备份定时器
            crate::backup_timer::start_backup_timer(app.handle().clone());

            Ok(())
        })
        .on_window_event(|_window, event| match event {
            tauri::WindowEvent::Destroyed => {
                #[cfg(target_os = "windows")]
                win_layer::restore_desktop_icons();
            }
            _ => {}
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
            commands::system::set_window_focus,
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

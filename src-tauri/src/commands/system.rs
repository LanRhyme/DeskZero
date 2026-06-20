use crate::models::Settings;
use crate::storage::settings_store;
use std::sync::{LazyLock, Mutex};
use sysinfo::System;
use tauri::Manager;

static SETTINGS_LOCK: Mutex<()> = Mutex::new(());

static SYSTEM: LazyLock<Mutex<System>> = LazyLock::new(|| Mutex::new(System::new_all()));

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    let _lock = SETTINGS_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    settings_store::load_settings()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    let _lock = SETTINGS_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    settings_store::save_settings(&settings)
}

#[tauri::command]
pub fn close_settings_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.close();
    }
}

#[tauri::command]
pub fn drag_settings_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.start_dragging();
    }
}

#[cfg(target_os = "windows")]
extern "system" {
    fn SystemParametersInfoW(uiAction: u32, uiParam: u32, pvParam: *mut u16, fWinIni: u32) -> i32;
}

/// 系统监控信息
#[derive(serde::Serialize)]
pub struct SystemInfo {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub disk_used: u64,
    pub disk_total: u64,
    pub cpu_brand: String,
    pub cpu_cores: usize,
    pub cpu_threads: usize,
    pub uptime: u64,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    use sysinfo::Disks;

    let mut sys = SYSTEM.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();

    let cpu_brand = sys.cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    
    let cpu_cores = sys.physical_core_count().unwrap_or(0);
    let cpu_threads = sys.cpus().len();
    let uptime = System::uptime();

    // Windows 下查找 C:\ 盘，其他平台查找 / 挂载点
    #[cfg(target_os = "windows")]
    let root_path = std::path::Path::new("C:\\");
    #[cfg(not(target_os = "windows"))]
    let root_path = std::path::Path::new("/");

    let disks = Disks::new_with_refreshed_list();
    let (disk_used, disk_total) = disks
        .iter()
        .filter(|d| d.mount_point() == root_path)
        .map(|d| (d.total_space() - d.available_space(), d.total_space()))
        .next()
        .unwrap_or_else(|| {
            // 未找到根磁盘，汇总所有磁盘
            disks
                .iter()
                .map(|d| (d.total_space() - d.available_space(), d.total_space()))
                .fold((0, 0), |(a_used, a_total), (used, total)| {
                    (a_used + used, a_total + total)
                })
        });

    Ok(SystemInfo {
        cpu_usage,
        memory_used,
        memory_total,
        disk_used,
        disk_total,
        cpu_brand,
        cpu_cores,
        cpu_threads,
        uptime,
    })
}

#[tauri::command]
pub fn get_wallpaper_base64() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;

        let mut path_buf = [0u16; 512];
        let result = unsafe {
            SystemParametersInfoW(0x0073, path_buf.len() as u32, path_buf.as_mut_ptr(), 0)
        };

        if result != 0 {
            let len = path_buf
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(path_buf.len());
            let os_string = OsString::from_wide(&path_buf[..len]);
            if let Ok(path) = os_string.into_string() {
                if let Ok(bytes) = std::fs::read(&path) {
                    use base64::Engine;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    let ext = std::path::Path::new(&path)
                        .extension()
                        .and_then(|s| s.to_str())
                        .unwrap_or("jpg")
                        .to_lowercase();
                    let mime = match ext.as_str() {
                        "png" => "image/png",
                        "bmp" => "image/bmp",
                        _ => "image/jpeg",
                    };
                    return Ok(format!("data:{};base64,{}", mime, b64));
                }
            }
        }
    }
    Err("Could not get wallpaper".to_string())
}

#[tauri::command]
pub fn get_wallpaper_engine_preview() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::PathBuf;
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let steam_key = hkcu
            .open_subkey("Software\\Valve\\Steam")
            .map_err(|_| "Could not find Steam registry key".to_string())?;

        let steam_path: String = steam_key
            .get_value("SteamPath")
            .map_err(|_| "Could not read SteamPath".to_string())?;

        let mut config_path = PathBuf::from(&steam_path);
        config_path.push("steamapps");
        config_path.push("common");
        config_path.push("wallpaper_engine");
        config_path.push("config.json");

        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(selected) = json
                    .get("a")
                    .and_then(|a| a.get("general"))
                    .and_then(|g| g.get("wallpaperconfig"))
                    .and_then(|w| w.get("selectedwallpapers"))
                    .and_then(|s| s.as_object())
                {
                    let mut paths = Vec::new();
                    for (_monitor, data) in selected {
                        if let Some(file) = data.get("file").and_then(|f| f.as_str()) {
                            paths.push(file.to_string());
                        }
                    }

                    for path_str in paths {
                        let wp_path = PathBuf::from(path_str);
                        if let Some(dir) = wp_path.parent() {
                            let preview_jpg = dir.join("preview.jpg");
                            let preview_png = dir.join("preview.png");
                            let preview_gif = dir.join("preview.gif");
                            let preview_webp = dir.join("preview.webp");

                            let target = if preview_jpg.exists() {
                                Some((preview_jpg, "image/jpeg"))
                            } else if preview_png.exists() {
                                Some((preview_png, "image/png"))
                            } else if preview_gif.exists() {
                                Some((preview_gif, "image/gif"))
                            } else if preview_webp.exists() {
                                Some((preview_webp, "image/webp"))
                            } else {
                                None
                            };

                            if let Some((target_path, mime)) = target {
                                if let Ok(bytes) = std::fs::read(&target_path) {
                                    use base64::Engine;
                                    let b64 =
                                        base64::engine::general_purpose::STANDARD.encode(&bytes);
                                    return Ok(format!("data:{};base64,{}", mime, b64));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Err("Could not find Wallpaper Engine preview".to_string())
}

#[tauri::command]
pub fn capture_desktop_background(app: tauri::AppHandle) -> Result<String, String> {
    use image::{imageops::overlay, RgbaImage};
    use std::ffi::c_void;
    use std::io::Cursor;
    use std::ptr;
    use tauri::Manager;

    type HWND = *mut c_void;
    type LPCSTR = *const i8;

    #[link(name = "user32")]
    #[link(name = "gdi32")]
    extern "system" {
        fn FindWindowA(lpClassName: LPCSTR, lpWindowName: LPCSTR) -> HWND;
        fn FindWindowExA(
            hWndParent: HWND,
            hWndChildAfter: HWND,
            lpszClass: LPCSTR,
            lpszWindow: LPCSTR,
        ) -> HWND;
        fn GetClassNameA(hWnd: HWND, lpClassName: *mut i8, nMaxCount: i32) -> i32;
        fn GetWindowRect(hWnd: HWND, lpRect: *mut RECT) -> i32;
        fn GetDC(hWnd: HWND) -> *mut c_void;
        fn CreateCompatibleDC(hDC: *mut c_void) -> *mut c_void;
        fn CreateCompatibleBitmap(hDC: *mut c_void, cx: i32, cy: i32) -> *mut c_void;
        fn SelectObject(hDC: *mut c_void, h: *mut c_void) -> *mut c_void;
        fn PrintWindow(hwnd: HWND, hdcBlt: *mut c_void, nFlags: u32) -> i32;
        fn ReleaseDC(hWnd: HWND, hDC: *mut c_void) -> i32;
        fn DeleteDC(hdc: *mut c_void) -> i32;
        fn DeleteObject(ho: *mut c_void) -> i32;
        fn GetDIBits(
            hdc: *mut c_void,
            hbm: *mut c_void,
            start: u32,
            cLines: u32,
            lpvBits: *mut c_void,
            lpbmi: *mut BITMAPINFO,
            usage: u32,
        ) -> i32;
        fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> i32;
    }

    #[repr(C)]
    struct RECT {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    struct BITMAPINFOHEADER {
        bi_size: u32,
        bi_width: i32,
        bi_height: i32,
        bi_planes: u16,
        bi_bit_count: u16,
        bi_compression: u32,
        bi_size_image: u32,
        bi_xpels_per_meter: i32,
        bi_ypels_per_meter: i32,
        bi_clr_used: u32,
        bi_clr_important: u32,
    }

    #[repr(C)]
    struct BITMAPINFO {
        bmi_header: BITMAPINFOHEADER,
        bmi_colors: [u32; 1],
    }

    unsafe fn get_class_name(hwnd: HWND) -> String {
        let mut buf = [0u8; 256];
        let len = GetClassNameA(hwnd, buf.as_mut_ptr() as *mut i8, 256);
        if len > 0 {
            String::from_utf8_lossy(&buf[..len as usize]).to_string()
        } else {
            String::new()
        }
    }

    let mut native_icons_hwnd = ptr::null_mut();
    let mut wallpaper_hwnds = Vec::new();

    unsafe {
        let progman = FindWindowA(b"Progman\0".as_ptr() as LPCSTR, ptr::null());
        if !progman.is_null() {
            wallpaper_hwnds.push(progman);
            let mut child = ptr::null_mut();
            loop {
                child = FindWindowExA(progman, child, ptr::null(), ptr::null());
                if child.is_null() {
                    break;
                }
                if get_class_name(child) == "SHELLDLL_DefView" {
                    native_icons_hwnd = child;
                }
            }
        }
        let mut worker = ptr::null_mut();
        loop {
            worker = FindWindowExA(
                ptr::null_mut(),
                worker,
                b"WorkerW\0".as_ptr() as LPCSTR,
                ptr::null(),
            );
            if worker.is_null() {
                break;
            }
            wallpaper_hwnds.push(worker);
            let mut child = ptr::null_mut();
            loop {
                child = FindWindowExA(worker, child, ptr::null(), ptr::null());
                if child.is_null() {
                    break;
                }
                if get_class_name(child) == "SHELLDLL_DefView" {
                    native_icons_hwnd = child;
                }
            }
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        unsafe {
            if !native_icons_hwnd.is_null() {
                ShowWindow(native_icons_hwnd, 0); // SW_HIDE
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(150));
    }

    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;

    let mut rects = Vec::new();

    for &hwnd in &wallpaper_hwnds {
        unsafe {
            let mut rect = RECT {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            GetWindowRect(hwnd, &mut rect);
            let w = rect.right - rect.left;
            let h = rect.bottom - rect.top;
            if w > 0 && h > 0 {
                if rect.left < min_x {
                    min_x = rect.left;
                }
                if rect.top < min_y {
                    min_y = rect.top;
                }
                if rect.right > max_x {
                    max_x = rect.right;
                }
                if rect.bottom > max_y {
                    max_y = rect.bottom;
                }
                rects.push((hwnd, rect));
            }
        }
    }

    if min_x == i32::MAX {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            unsafe {
                if !native_icons_hwnd.is_null() {
                    ShowWindow(native_icons_hwnd, 5); // SW_SHOW
                }
            }
        }
        return Err("No wallpaper windows found".to_string());
    }

    let virtual_w = (max_x - min_x) as u32;
    let virtual_h = (max_y - min_y) as u32;

    let mut canvas = RgbaImage::new(virtual_w, virtual_h);

    for (hwnd, rect) in rects {
        unsafe {
            let w = rect.right - rect.left;
            let h = rect.bottom - rect.top;

            let hdc_screen = GetDC(ptr::null_mut());
            let hdc_mem = CreateCompatibleDC(hdc_screen);
            let hbm = CreateCompatibleBitmap(hdc_screen, w, h);

            SelectObject(hdc_mem, hbm);
            PrintWindow(hwnd, hdc_mem, 2); // 2 = PW_RENDERFULLCONTENT

            let mut bmi = BITMAPINFO {
                bmi_header: BITMAPINFOHEADER {
                    bi_size: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    bi_width: w,
                    bi_height: -h,
                    bi_planes: 1,
                    bi_bit_count: 32,
                    bi_compression: 0,
                    bi_size_image: 0,
                    bi_xpels_per_meter: 0,
                    bi_ypels_per_meter: 0,
                    bi_clr_used: 0,
                    bi_clr_important: 0,
                },
                bmi_colors: [0; 1],
            };

            let mut pixels: Vec<u8> = vec![0; (w * h * 4) as usize];
            GetDIBits(
                hdc_mem,
                hbm,
                0,
                h as u32,
                pixels.as_mut_ptr() as *mut c_void,
                &mut bmi,
                0,
            );

            for chunk in pixels.chunks_exact_mut(4) {
                let b = chunk[0];
                let r = chunk[2];
                chunk[0] = r;
                chunk[2] = b;
                chunk[3] = 255;
            }

            if let Some(capture) = RgbaImage::from_raw(w as u32, h as u32, pixels) {
                let offset_x = (rect.left - min_x) as i64;
                let offset_y = (rect.top - min_y) as i64;
                overlay(&mut canvas, &capture, offset_x, offset_y);
            }

            DeleteObject(hbm);
            DeleteDC(hdc_mem);
            ReleaseDC(ptr::null_mut(), hdc_screen);
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        unsafe {
            if !native_icons_hwnd.is_null() {
                ShowWindow(native_icons_hwnd, 5); // SW_SHOW
            }
        }
    }

    let mut buf = Cursor::new(Vec::new());
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 80);
    encoder.encode_image(&canvas).map_err(|e| e.to_string())?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());

    Ok(format!("data:image/jpeg;base64,{}", b64))
}

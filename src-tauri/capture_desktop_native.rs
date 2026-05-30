#[tauri::command]
pub fn capture_desktop_background(app: tauri::AppHandle) -> Result<String, String> {
    use image::{RgbaImage, imageops::overlay};
    use std::io::Cursor;
    use std::ffi::c_void;
    use std::ptr;
    use tauri::Manager;

    type HWND = *mut c_void;
    type LPCSTR = *const i8;

    #[link(name = "user32")]
    #[link(name = "gdi32")]
    extern "system" {
        fn FindWindowA(lpClassName: LPCSTR, lpWindowName: LPCSTR) -> HWND;
        fn FindWindowExA(hWndParent: HWND, hWndChildAfter: HWND, lpszClass: LPCSTR, lpszWindow: LPCSTR) -> HWND;
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
        fn GetDIBits(hdc: *mut c_void, hbm: *mut c_void, start: u32, cLines: u32, lpvBits: *mut c_void, lpbmi: *mut BITMAPINFO, usage: u32) -> i32;
        fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> i32;
    }

    #[repr(C)]
    struct RECT {
        left: i32, top: i32, right: i32, bottom: i32,
    }

    #[repr(C)]
    struct BITMAPINFOHEADER {
        bi_size: u32, bi_width: i32, bi_height: i32, bi_planes: u16, bi_bit_count: u16, bi_compression: u32,
        bi_size_image: u32, bi_xpels_per_meter: i32, bi_ypels_per_meter: i32, bi_clr_used: u32, bi_clr_important: u32,
    }

    #[repr(C)]
    struct BITMAPINFO {
        bmi_header: BITMAPINFOHEADER, bmi_colors: [u32; 1],
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
                if child.is_null() { break; }
                if get_class_name(child) == "SHELLDLL_DefView" {
                    native_icons_hwnd = child;
                }
            }
        }
        let mut worker = ptr::null_mut();
        loop {
            worker = FindWindowExA(ptr::null_mut(), worker, b"WorkerW\0".as_ptr() as LPCSTR, ptr::null());
            if worker.is_null() { break; }
            wallpaper_hwnds.push(worker);
            let mut child = ptr::null_mut();
            loop {
                child = FindWindowExA(worker, child, ptr::null(), ptr::null());
                if child.is_null() { break; }
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
            let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            GetWindowRect(hwnd, &mut rect);
            let w = rect.right - rect.left;
            let h = rect.bottom - rect.top;
            if w > 0 && h > 0 {
                if rect.left < min_x { min_x = rect.left; }
                if rect.top < min_y { min_y = rect.top; }
                if rect.right > max_x { max_x = rect.right; }
                if rect.bottom > max_y { max_y = rect.bottom; }
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
            GetDIBits(hdc_mem, hbm, 0, h as u32, pixels.as_mut_ptr() as *mut c_void, &mut bmi, 0);
            
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

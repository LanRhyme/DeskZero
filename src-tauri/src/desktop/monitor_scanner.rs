use crate::models::monitor::Monitor;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;

#[cfg(target_os = "windows")]
mod winapi {
    use std::ffi::c_void;

    pub type HDC = *mut c_void;
    pub type HMONITOR = *mut c_void;
    pub type BOOL = i32;
    pub type LPARAM = isize;
    pub type MONITORENUMPROC = Option<unsafe extern "system" fn(HMONITOR, HDC, *mut RECT, LPARAM) -> BOOL>;

    #[repr(C)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    pub struct MONITORINFOEXW {
        pub cbSize: u32,
        pub rcMonitor: RECT,
        pub rcWork: RECT,
        pub dwFlags: u32,
        pub szDevice: [u16; 32],
    }

    impl Default for MONITORINFOEXW {
        fn default() -> Self {
            unsafe { std::mem::zeroed() }
        }
    }

    extern "system" {
        pub fn EnumDisplayMonitors(
            hdc: HDC,
            lprcClip: *const RECT,
            lpfnEnum: MONITORENUMPROC,
            dwData: LPARAM,
        ) -> BOOL;

        pub fn GetMonitorInfoW(
            hMonitor: HMONITOR,
            lpmi: *mut MONITORINFOEXW,
        ) -> BOOL;

        pub fn GetDpiForMonitor(
            hmonitor: HMONITOR,
            dpiType: u32,
            dpiX: *mut u32,
            dpiY: *mut u32,
        ) -> i32;
    }
}

#[cfg(target_os = "windows")]
static MONITORS_RESULT: Mutex<Vec<Monitor>> = Mutex::new(Vec::new());

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_monitor_proc(
    hmonitor: *mut std::ffi::c_void,
    _hdc: *mut std::ffi::c_void,
    _rect: *mut winapi::RECT,
    _lparam: isize,
) -> i32 {
    let mut info = winapi::MONITORINFOEXW::default();
    info.cbSize = std::mem::size_of::<winapi::MONITORINFOEXW>() as u32;

    if unsafe { winapi::GetMonitorInfoW(hmonitor, &mut info as *mut winapi::MONITORINFOEXW as *mut _) } != 0 {
        let rect = info.rcMonitor;
        let work = info.rcWork;

        // 获取 DPI 缩放因子（MDT_EFFECTIVE_DPI = 0）
        let mut dpi_x: u32 = 96;
        let mut dpi_y: u32 = 96;
        let scale_factor = unsafe {
            let hr = winapi::GetDpiForMonitor(hmonitor, 0, &mut dpi_x, &mut dpi_y);
            if hr == 0 { dpi_x as f64 / 96.0 } else { 1.0 }
        };

        // 将物理像素转换为逻辑像素（CSS 像素），与浏览器坐标系一致
        let to_logical = |v: i32| (v as f64 / scale_factor).round() as i32;
        let to_logical_u = |v: i32| (v as f64 / scale_factor).round() as u32;

        let width = to_logical_u(rect.right - rect.left);
        let height = to_logical_u(rect.bottom - rect.top);
        let is_primary = (info.dwFlags & 1) != 0;

        // 生成稳定的显示器 ID（基于物理像素位置和尺寸，避免缩放导致 ID 变化）
        let mut hasher = DefaultHasher::new();
        rect.left.hash(&mut hasher);
        rect.top.hash(&mut hasher);
        (rect.right - rect.left).hash(&mut hasher);
        (rect.bottom - rect.top).hash(&mut hasher);
        let id = format!("monitor_{:x}", hasher.finish());

        // 获取显示器名称
        let name_raw = info.szDevice;
        let name = String::from_utf16_lossy(
            &name_raw[..name_raw.iter().position(|&c| c == 0).unwrap_or(name_raw.len())],
        );

        let work_area = crate::models::monitor::WorkArea {
            x: to_logical(work.left),
            y: to_logical(work.top),
            width: to_logical_u(work.right - work.left),
            height: to_logical_u(work.bottom - work.top),
        };

        let monitor = Monitor {
            id,
            name,
            x: to_logical(rect.left),
            y: to_logical(rect.top),
            width,
            height,
            is_primary,
            scale_factor,
            work_area,
            extra: std::collections::HashMap::new(),
        };

        if let Ok(mut monitors) = MONITORS_RESULT.lock() {
            monitors.push(monitor);
        }
    }

    1 // 继续枚举
}

#[cfg(target_os = "windows")]
pub fn enumerate_monitors() -> Result<Vec<Monitor>, String> {
    // 清空之前的结果
    if let Ok(mut monitors) = MONITORS_RESULT.lock() {
        monitors.clear();
    }

    let result = unsafe {
        winapi::EnumDisplayMonitors(
            std::ptr::null_mut(),
            std::ptr::null(),
            Some(enum_monitor_proc),
            0,
        )
    };

    if result == 0 {
        return Err("EnumDisplayMonitors 失败".to_string());
    }

    let monitors = MONITORS_RESULT.lock().map_err(|e| e.to_string())?;
    if monitors.is_empty() {
        return Err("未检测到任何显示器".to_string());
    }

    Ok(monitors.clone())
}

#[cfg(not(target_os = "windows"))]
pub fn enumerate_monitors() -> Result<Vec<Monitor>, String> {
    // 非 Windows 平台返回单个默认显示器
    Ok(vec![Monitor {
        id: "monitor_default".to_string(),
        name: "Default".to_string(),
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        is_primary: true,
        scale_factor: 1.0,
        work_area: crate::models::monitor::WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        },
        extra: std::collections::HashMap::new(),
    }])
}

/// 根据坐标判断属于哪个显示器
pub fn find_monitor_for_point(
    monitors: &[Monitor],
    x: f64,
    y: f64,
) -> Option<&Monitor> {
    let ix = x as i32;
    let iy = y as i32;

    monitors.iter().find(|m| {
        ix >= m.x && ix < m.x + m.width as i32 && iy >= m.y && iy < m.y + m.height as i32
    })
}

/// 找到主显示器
pub fn find_primary_monitor(monitors: &[Monitor]) -> Option<&Monitor> {
    monitors.iter().find(|m| m.is_primary)
}

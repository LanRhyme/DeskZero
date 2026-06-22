use std::ffi::c_void;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[repr(C)]
struct RECT {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

type HWND = *mut c_void;
type BOOL = i32;
type DWORD = u32;

const SM_CXSCREEN: i32 = 0;
const SM_CYSCREEN: i32 = 1;

extern "system" {
    fn GetForegroundWindow() -> HWND;
    fn GetWindowRect(hWnd: HWND, lpRect: *mut RECT) -> BOOL;
    fn GetSystemMetrics(nIndex: i32) -> i32;
    fn IsZoomed(hWnd: HWND) -> BOOL;
    fn GetWindowThreadProcessId(hWnd: HWND, lpdwProcessId: *mut DWORD) -> DWORD;
    fn GetCurrentProcessId() -> DWORD;
}

/// 检查前台窗口是否全屏（窗口矩形覆盖整个主屏幕）
fn is_foreground_fullscreen() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return false;
        }

        // 排除自身进程
        let mut pid: DWORD = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == GetCurrentProcessId() {
            return false;
        }

        let screen_w = GetSystemMetrics(SM_CXSCREEN);
        let screen_h = GetSystemMetrics(SM_CYSCREEN);
        if screen_w == 0 || screen_h == 0 {
            return false;
        }

        let mut rect: RECT = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return false;
        }

        rect.left <= 0
            && rect.top <= 0
            && rect.right >= screen_w
            && rect.bottom >= screen_h
    }
}

/// 检查前台窗口是否最大化
fn is_foreground_maximized() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return false;
        }

        // 排除自身进程
        let mut pid: DWORD = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == GetCurrentProcessId() {
            return false;
        }

        IsZoomed(hwnd) != 0
    }
}

/// 根据检测模式判断是否应激活性能模式
pub fn should_activate_performance_mode(mode: &str) -> bool {
    match mode {
        "fullscreenOnly" => is_foreground_fullscreen(),
        "fullscreenAndMaximized" => is_foreground_fullscreen() || is_foreground_maximized(),
        _ => is_foreground_fullscreen() || is_foreground_maximized(),
    }
}

/// 启动全屏检测后台线程，每 500ms 轮询前台窗口状态，
/// 状态变化时通过 Tauri 事件 `fullscreen-state-changed` 通知前端
pub fn start_fullscreen_detector(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut last_state = false;

        eprintln!("[DeskZero] 全屏检测器已启动");

        loop {
            std::thread::sleep(Duration::from_millis(500));

            // 从设置中读取启用状态和检测模式
            let (enabled, mode) = match crate::storage::settings_store::load_settings() {
                Ok(settings) => (
                    settings.performance_mode_enabled,
                    match &settings.fullscreen_detection_mode {
                        crate::models::settings::FullscreenDetectionMode::FullscreenOnly => {
                            "fullscreenOnly".to_string()
                        }
                        crate::models::settings::FullscreenDetectionMode::FullscreenAndMaximized => {
                            "fullscreenAndMaximized".to_string()
                        }
                        crate::models::settings::FullscreenDetectionMode::Other(s) => s.clone(),
                    },
                ),
                Err(_) => (false, "fullscreenOnly".to_string()),
            };

            let current_state = if enabled {
                should_activate_performance_mode(&mode)
            } else {
                false
            };

            if current_state != last_state {
                last_state = current_state;
                eprintln!(
                    "[DeskZero] 全屏状态变化: {}",
                    if current_state { "激活性能模式" } else { "恢复常规模式" }
                );
                if let Err(e) = app_handle.emit("fullscreen-state-changed", current_state) {
                    eprintln!("[DeskZero] 全屏状态事件发送失败: {}", e);
                }
            }
        }
    });
}

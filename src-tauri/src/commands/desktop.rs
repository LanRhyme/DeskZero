use crate::desktop::icon_scanner;
use crate::models::Item;
use std::collections::HashMap;
use std::sync::Mutex;

static DESKTOP_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub async fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    tokio::task::spawn_blocking(|| icon_scanner::scan_desktop_icons())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scan_directory_icons(path: String) -> Result<Vec<Item>, String> {
    tokio::task::spawn_blocking(move || icon_scanner::scan_directory_icons(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_desktop_dir() -> Result<String, String> {
    dirs::desktop_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "找不到桌面目录".to_string())
}

#[tauri::command]
pub fn get_desktop_layout() -> Result<HashMap<String, crate::models::container::Position>, String> {
    let _lock = DESKTOP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    crate::storage::desktop_store::load_layout()
}

#[tauri::command]
pub fn save_desktop_layout(layout: HashMap<String, crate::models::container::Position>) -> Result<(), String> {
    let _lock = DESKTOP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    crate::storage::desktop_store::save_layout(&layout)
}

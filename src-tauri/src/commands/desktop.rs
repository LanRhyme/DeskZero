use crate::desktop::icon_scanner;
use crate::models::Item;
use std::collections::HashMap;

#[tauri::command]
pub async fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    tokio::task::spawn_blocking(|| icon_scanner::scan_desktop_icons())
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
    crate::storage::desktop_store::load_layout()
}

#[tauri::command]
pub fn save_desktop_layout(layout: HashMap<String, crate::models::container::Position>) -> Result<(), String> {
    crate::storage::desktop_store::save_layout(&layout)
}

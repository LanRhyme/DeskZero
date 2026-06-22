use crate::desktop::monitor_scanner;
use crate::models::monitor::Monitor;
use crate::storage::monitor_store;

#[tauri::command]
pub fn get_monitors() -> Result<Vec<Monitor>, String> {
    monitor_store::load_monitors()
}

#[tauri::command]
pub fn refresh_monitors() -> Result<Vec<Monitor>, String> {
    let monitors = monitor_scanner::enumerate_monitors()?;
    monitor_store::save_monitors(&monitors)?;
    Ok(monitors)
}

#[tauri::command]
pub fn get_monitor_for_point(x: f64, y: f64) -> Result<Option<Monitor>, String> {
    let monitors = monitor_store::load_monitors()?;
    Ok(monitor_scanner::find_monitor_for_point(&monitors, x, y).cloned())
}

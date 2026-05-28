use crate::models::Settings;
use crate::storage::settings_store;
use tauri::Manager;

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    settings_store::load_settings()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
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

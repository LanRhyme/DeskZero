use crate::models::Settings;
use crate::storage::settings_store;

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    settings_store::load_settings()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    settings_store::save_settings(&settings)
}

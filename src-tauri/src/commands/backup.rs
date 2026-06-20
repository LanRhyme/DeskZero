use crate::models::backup::{BackupRecord, BackupSettings, BackupSnapshot};
use crate::storage::backup_store;

#[tauri::command]
pub fn create_backup(name: Option<String>) -> Result<BackupRecord, String> {
    let backup_name = name.unwrap_or_else(|| {
        let now = chrono::Local::now();
        now.format("备份 %Y-%m-%d %H:%M").to_string()
    });
    backup_store::create_backup(&backup_name, "manual")
}

#[tauri::command]
pub fn list_backups() -> Result<Vec<BackupRecord>, String> {
    backup_store::list_backups()
}

#[tauri::command]
pub fn restore_backup(id: String) -> Result<(), String> {
    backup_store::restore_backup(&id)
}

#[tauri::command]
pub fn delete_backup(id: String) -> Result<(), String> {
    backup_store::delete_backup(&id)
}

#[tauri::command]
pub fn get_backup_data(id: String) -> Result<BackupSnapshot, String> {
    backup_store::get_backup_data(&id)
}

#[tauri::command]
pub fn get_backup_settings() -> Result<BackupSettings, String> {
    Ok(backup_store::load_backup_settings())
}

#[tauri::command]
pub fn save_backup_settings(
    auto_backup_enabled: Option<bool>,
    auto_backup_hours: Option<u32>,
    max_backups: Option<u32>,
) -> Result<(), String> {
    backup_store::save_backup_settings(auto_backup_enabled, auto_backup_hours, max_backups)
}

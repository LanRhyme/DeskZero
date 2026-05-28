use crate::desktop::icon_scanner;
use crate::models::Item;

#[tauri::command]
pub async fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    tokio::task::spawn_blocking(|| icon_scanner::scan_desktop_icons())
        .await
        .map_err(|e| e.to_string())?
}

use crate::desktop::icon_scanner;
use crate::models::Item;

#[tauri::command]
pub fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    icon_scanner::scan_desktop_icons()
}

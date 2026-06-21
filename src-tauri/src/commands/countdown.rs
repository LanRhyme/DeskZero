use crate::models::countdown::CountdownEvent;
use crate::storage::{db, countdown_store};

#[tauri::command]
pub fn get_countdown_events() -> Result<Vec<CountdownEvent>, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    countdown_store::get_countdown_events(&conn)
}

#[tauri::command]
pub fn add_countdown_event(event: CountdownEvent) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    countdown_store::add_countdown_event(&conn, &event)
}

#[tauri::command]
pub fn update_countdown_event(event: CountdownEvent) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    countdown_store::update_countdown_event(&conn, &event)
}

#[tauri::command]
pub fn delete_countdown_event(id: String) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    countdown_store::delete_countdown_event(&conn, &id)
}

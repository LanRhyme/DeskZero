use crate::models::calendar::CalendarEvent;
use crate::storage::{db, calendar_store};

#[tauri::command]
pub fn get_calendar_events(container_id: String, year: i32, month: u32) -> Result<Vec<CalendarEvent>, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    calendar_store::get_calendar_events(&conn, &container_id, year, month)
}

#[tauri::command]
pub fn add_calendar_event(event: CalendarEvent) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    calendar_store::add_calendar_event(&conn, &event)
}

#[tauri::command]
pub fn delete_calendar_event(id: String) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    calendar_store::delete_calendar_event(&conn, &id)
}

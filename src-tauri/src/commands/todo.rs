use crate::models::todo::TodoItem;
use crate::storage::{db, todo_store};

#[tauri::command]
pub fn get_todo_items(container_id: String) -> Result<Vec<TodoItem>, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    todo_store::get_todo_items(&conn, &container_id)
}

#[tauri::command]
pub fn add_todo_item(item: TodoItem) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    todo_store::add_todo_item(&conn, &item)
}

#[tauri::command]
pub fn update_todo_item(item: TodoItem) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    todo_store::update_todo_item(&conn, &item)
}

#[tauri::command]
pub fn delete_todo_item(id: String) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    todo_store::delete_todo_item(&conn, &id)
}

#[tauri::command]
pub fn reorder_todo_items(ids: Vec<String>) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    todo_store::reorder_todo_items(&conn, &ids)
}

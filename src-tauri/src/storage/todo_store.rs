use rusqlite::{Connection, params};
use crate::models::todo::TodoItem;

pub fn get_todo_items(conn: &Connection, container_id: &str) -> Result<Vec<TodoItem>, String> {
    let mut stmt = conn
        .prepare("SELECT id, container_id, text, completed, priority, due_date, order_index FROM todo_items WHERE container_id=?1 ORDER BY order_index")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![container_id], |row| {
            Ok(TodoItem {
                id: row.get(0)?,
                container_id: row.get(1)?,
                text: row.get(2)?,
                completed: row.get::<_, i32>(3)? != 0,
                priority: row.get(4)?,
                due_date: row.get(5)?,
                order_index: row.get(6)?,
                extra: std::collections::HashMap::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

pub fn add_todo_item(conn: &Connection, item: &TodoItem) -> Result<(), String> {
    conn.execute(
        "INSERT INTO todo_items (id, container_id, text, completed, priority, due_date, order_index) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET text=excluded.text, completed=excluded.completed, priority=excluded.priority, due_date=excluded.due_date, order_index=excluded.order_index",
        params![item.id, item.container_id, item.text, item.completed as i32, item.priority, item.due_date, item.order_index],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_todo_item(conn: &Connection, item: &TodoItem) -> Result<(), String> {
    conn.execute(
        "UPDATE todo_items SET text=?1, completed=?2, priority=?3, due_date=?4, order_index=?5 WHERE id=?6",
        params![item.text, item.completed as i32, item.priority, item.due_date, item.order_index, item.id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_todo_item(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM todo_items WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn reorder_todo_items(conn: &Connection, ids: &[String]) -> Result<(), String> {
    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE todo_items SET order_index=?1 WHERE id=?2",
            params![i as i32, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

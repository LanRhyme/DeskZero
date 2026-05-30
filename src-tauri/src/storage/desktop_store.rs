use std::collections::HashMap;
use super::db::get_connection;

pub fn load_layout() -> Result<HashMap<String, crate::models::container::Position>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT item_id, x, y FROM desktop_layout").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let x: f64 = row.get(1)?;
        let y: f64 = row.get(2)?;
        Ok((id, crate::models::container::Position { x, y }))
    }).map_err(|e| e.to_string())?;
    
    let mut layout = HashMap::new();
    for row in rows {
        if let Ok((id, pos)) = row {
            layout.insert(id, pos);
        }
    }
    
    Ok(layout)
}

pub fn save_layout(layout: &HashMap<String, crate::models::container::Position>) -> Result<(), String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    tx.execute("DELETE FROM desktop_layout", []).map_err(|e| e.to_string())?;
    
    for (id, pos) in layout {
        tx.execute(
            "INSERT INTO desktop_layout (item_id, x, y) VALUES (?1, ?2, ?3)",
            (id, pos.x, pos.y),
        ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

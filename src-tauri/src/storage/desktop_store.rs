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

/// 保存桌面布局 — 使用差异删除 + UPSERT 策略替代全量 DELETE + INSERT，
/// 保护未来版本可能在 desktop_layout 表中新增的列。
pub fn save_layout(layout: &HashMap<String, crate::models::container::Position>) -> Result<(), String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // 收集当前要保存的 item_id
    let new_ids: Vec<&str> = layout.keys().map(|k| k.as_str()).collect();
    
    // 差异删除：只删除不再存在的布局条目
    {
        let mut existing_stmt = tx.prepare("SELECT item_id FROM desktop_layout").map_err(|e| e.to_string())?;
        let existing_ids: Vec<String> = existing_stmt.query_map([], |row| {
            row.get::<_, String>(0)
        }).map_err(|e| e.to_string())?
          .filter_map(|r| r.ok())
          .collect();
        
        for eid in &existing_ids {
            if !new_ids.contains(&eid.as_str()) {
                tx.execute("DELETE FROM desktop_layout WHERE item_id = ?1", [eid]).map_err(|e| e.to_string())?;
            }
        }
    }
    
    // UPSERT：只更新已知列
    for (id, pos) in layout {
        tx.execute(
            "INSERT INTO desktop_layout (item_id, x, y) VALUES (?1, ?2, ?3)
             ON CONFLICT(item_id) DO UPDATE SET x = excluded.x, y = excluded.y",
            (id, pos.x, pos.y),
        ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

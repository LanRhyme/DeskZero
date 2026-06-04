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
    

    // 移除差异删除逻辑：桌面布局更像是一个缓存，
    // 如果某个文件暂时被移动或扫描失败，保留其布局可以防止重启后布局丢失。
    // 这也更符合 Windows 桌面的行为（记住曾经出现过的图标位置）。
    
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

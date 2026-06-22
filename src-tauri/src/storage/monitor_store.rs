use crate::models::monitor::{Monitor, WorkArea};
use std::collections::HashMap;

use super::db::get_connection;

pub fn load_monitors() -> Result<Vec<Monitor>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, x, y, width, height, is_primary, scale_factor FROM monitors")
        .map_err(|e| e.to_string())?;

    let monitors = stmt
        .query_map([], |row| {
            let width: u32 = row.get(4)?;
            let height: u32 = row.get(5)?;
            Ok(Monitor {
                id: row.get(0)?,
                name: row.get(1)?,
                x: row.get(2)?,
                y: row.get(3)?,
                width,
                height,
                is_primary: row.get::<_, i32>(6)? != 0,
                scale_factor: row.get(7)?,
                work_area: WorkArea {
                    x: row.get(2)?,
                    y: row.get(3)?,
                    width,
                    height: height.saturating_sub(48),
                },
                extra: HashMap::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(monitors)
}

pub fn save_monitors(monitors: &[Monitor]) -> Result<(), String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 获取现有 ID
    let existing_ids: Vec<String> = {
        let mut stmt = tx
            .prepare("SELECT id FROM monitors")
            .map_err(|e| e.to_string())?;
        let ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        ids
    };

    let new_ids: Vec<&str> = monitors.iter().map(|m| m.id.as_str()).collect();

    // 删除不再存在的显示器
    for id in &existing_ids {
        if !new_ids.contains(&id.as_str()) {
            tx.execute("DELETE FROM monitors WHERE id = ?1", [id])
                .map_err(|e| e.to_string())?;
        }
    }

    // UPSERT 显示器
    for m in monitors {
        tx.execute(
            "INSERT INTO monitors (id, name, x, y, width, height, is_primary, scale_factor)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name,
                 x = excluded.x,
                 y = excluded.y,
                 width = excluded.width,
                 height = excluded.height,
                 is_primary = excluded.is_primary,
                 scale_factor = excluded.scale_factor",
            (
                &m.id,
                &m.name,
                m.x,
                m.y,
                m.width,
                m.height,
                m.is_primary as i32,
                m.scale_factor,
            ),
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

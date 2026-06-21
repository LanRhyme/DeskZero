use rusqlite::{Connection, params};
use crate::models::countdown::CountdownEvent;

pub fn get_countdown_events(conn: &Connection) -> Result<Vec<CountdownEvent>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, target_date, mode, color FROM countdown_events ORDER BY target_date")
        .map_err(|e| e.to_string())?;

    let events = stmt
        .query_map([], |row| {
            Ok(CountdownEvent {
                id: row.get(0)?,
                name: row.get(1)?,
                target_date: row.get(2)?,
                mode: row.get(3)?,
                color: row.get(4)?,
                extra: std::collections::HashMap::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(events)
}

pub fn add_countdown_event(conn: &Connection, event: &CountdownEvent) -> Result<(), String> {
    conn.execute(
        "INSERT INTO countdown_events (id, name, target_date, mode, color) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, target_date=excluded.target_date, mode=excluded.mode, color=excluded.color",
        params![event.id, event.name, event.target_date, event.mode, event.color],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_countdown_event(conn: &Connection, event: &CountdownEvent) -> Result<(), String> {
    conn.execute(
        "UPDATE countdown_events SET name=?1, target_date=?2, mode=?3, color=?4 WHERE id=?5",
        params![event.name, event.target_date, event.mode, event.color, event.id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_countdown_event(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM countdown_events WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

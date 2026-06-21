use rusqlite::{Connection, params};
use crate::models::calendar::CalendarEvent;

pub fn get_calendar_events(conn: &Connection, container_id: &str, year: i32, month: u32) -> Result<Vec<CalendarEvent>, String> {
    let start = format!("{:04}-{:02}-01", year, month);
    let (end_year, end_month) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let end = format!("{:04}-{:02}-01", end_year, end_month);

    let mut stmt = conn
        .prepare("SELECT id, container_id, date, title, color FROM calendar_events WHERE container_id=?1 AND date>=?2 AND date<?3 ORDER BY date")
        .map_err(|e| e.to_string())?;

    let events = stmt
        .query_map(params![container_id, start, end], |row| {
            Ok(CalendarEvent {
                id: row.get(0)?,
                container_id: row.get(1)?,
                date: row.get(2)?,
                title: row.get(3)?,
                color: row.get(4)?,
                extra: std::collections::HashMap::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(events)
}

pub fn add_calendar_event(conn: &Connection, event: &CalendarEvent) -> Result<(), String> {
    conn.execute(
        "INSERT INTO calendar_events (id, container_id, date, title, color) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET date=excluded.date, title=excluded.title, color=excluded.color",
        params![event.id, event.container_id, event.date, event.title, event.color],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_calendar_event(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM calendar_events WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

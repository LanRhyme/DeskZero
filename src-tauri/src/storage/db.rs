use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;

pub fn get_data_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("DeskZero");
    fs::create_dir_all(&path).ok();
    path
}

fn get_db_path() -> PathBuf {
    get_data_dir().join("deskzero.db")
}

pub fn get_connection() -> Result<Connection> {
    let conn = Connection::open(get_db_path())?;
    // 启用 WAL 模式：允许并发读写，减少 SQLITE_BUSY 错误
    conn.pragma_update(None, "journal_mode", "wal")?;
    // 设置忙等待超时为 5 秒，避免立即返回 SQLITE_BUSY
    conn.pragma_update(None, "busy_timeout", 5000)?;
    Ok(conn)
}

pub fn init_db() -> Result<()> {
    let conn = get_connection()?;
    
    // Settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Desktop Layout table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS desktop_layout (
            item_id TEXT PRIMARY KEY,
            x REAL NOT NULL,
            y REAL NOT NULL
        )",
        [],
    )?;

    // Containers table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS containers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            width REAL NOT NULL,
            height REAL NOT NULL,
            style TEXT NOT NULL,
            folder_path TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Container items table 
    conn.execute(
        "CREATE TABLE IF NOT EXISTS container_items (
            id TEXT PRIMARY KEY,
            container_id TEXT NOT NULL,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            icon_path TEXT NOT NULL,
            item_type TEXT NOT NULL,
            target_path TEXT,
            size INTEGER,
            modified_at INTEGER,
            x REAL,
            y REAL,
            order_index INTEGER NOT NULL
        )",
        [],
    )?;

    Ok(())
}

use crate::models::Settings;
use super::db::get_connection;

/// 加载设置 — 依赖 serde 的 `#[serde(default)]` 和 `extra` 字段自动处理缺失/未知属性，
/// 不再手动逐字段补全，降低维护成本并天然兼容未来版本。
pub fn load_settings() -> Result<Settings, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(["global"]).map_err(|e| e.to_string())?;
    
    let data = if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        row.get::<_, String>(0).unwrap_or_else(|_| "{}".to_string())
    } else {
        return Ok(Settings::default());
    };

    // serde(default) 会自动为缺失字段填充默认值，
    // serde(flatten) extra 会自动保留未知字段，
    // 不需要手动逐字段补全
    match serde_json::from_str::<Settings>(&data) {
        Ok(settings) => Ok(settings),
        Err(e) => {
            eprintln!("设置反序列化失败，使用默认值: {}", e);
            Ok(Settings::default())
        }
    }
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let data = serde_json::to_string(settings).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        ("global", &data),
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

use crate::models::Settings;
use super::db::get_connection;

pub fn load_settings() -> Result<Settings, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(["global"]).map_err(|e| e.to_string())?;
    
    let data = if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        row.get::<_, String>(0).unwrap_or_else(|_| "{}".to_string())
    } else {
        return Ok(Settings::default());
    };

    // 使用serde_json::Value来处理缺少的字段
    let mut value: serde_json::Value = serde_json::from_str(&data).unwrap_or_else(|_| serde_json::json!({}));

    // 确保所有必需的字段都存在
    if let Some(obj) = value.as_object_mut() {
        if !obj.contains_key("selectedItemBackground") {
            obj.insert(
                "selectedItemBackground".to_string(),
                serde_json::Value::String("white".to_string()),
            );
        }
        if !obj.contains_key("selectedItemBlur") {
            obj.insert(
                "selectedItemBlur".to_string(),
                serde_json::Value::Bool(false),
            );
        }
        if !obj.contains_key("globalBlur") {
            obj.insert("globalBlur".to_string(), serde_json::Value::Bool(true));
        }
        if !obj.contains_key("wallpaperCompatible") {
            obj.insert(
                "wallpaperCompatible".to_string(),
                serde_json::Value::Bool(false),
            );
        }
        if !obj.contains_key("gridWidth") {
            obj.insert(
                "gridWidth".to_string(),
                serde_json::Value::Number(serde_json::Number::from(80)),
            );
        }
        if !obj.contains_key("gridHeight") {
            obj.insert(
                "gridHeight".to_string(),
                serde_json::Value::Number(serde_json::Number::from(104)),
            );
        }
        if !obj.contains_key("gridGapX") {
            obj.insert(
                "gridGapX".to_string(),
                serde_json::Value::Number(serde_json::Number::from(20)),
            );
        }
        if !obj.contains_key("gridGapY") {
            obj.insert(
                "gridGapY".to_string(),
                serde_json::Value::Number(serde_json::Number::from(20)),
            );
        }
        if !obj.contains_key("fontSize") {
            obj.insert(
                "fontSize".to_string(),
                serde_json::Value::Number(serde_json::Number::from(12)),
            );
        }
    }

    serde_json::from_value(value).map_err(|e| e.to_string())
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

use std::fs;
use std::path::PathBuf;
use crate::models::Settings;

fn get_data_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("DeskZero");
    fs::create_dir_all(&path).ok();
    path
}

fn get_settings_path() -> PathBuf {
    get_data_dir().join("settings.json")
}

pub fn load_settings() -> Result<Settings, String> {
    let path = get_settings_path();
    if !path.exists() {
        return Ok(Settings::default());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    // 使用serde_json::Value来处理缺少的字段
    let mut value: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    
    // 确保所有必需的字段都存在
    if let Some(obj) = value.as_object_mut() {
        if !obj.contains_key("selectedItemBackground") {
            obj.insert("selectedItemBackground".to_string(), serde_json::Value::String("white".to_string()));
        }
        if !obj.contains_key("selectedItemBlur") {
            obj.insert("selectedItemBlur".to_string(), serde_json::Value::Bool(false));
        }
        if !obj.contains_key("globalBlur") {
            obj.insert("globalBlur".to_string(), serde_json::Value::Bool(true));
        }
        if !obj.contains_key("wallpaperCompatible") {
            obj.insert("wallpaperCompatible".to_string(), serde_json::Value::Bool(false));
        }
        if !obj.contains_key("gridWidth") {
            obj.insert("gridWidth".to_string(), serde_json::Value::Number(serde_json::Number::from(80)));
        }
        if !obj.contains_key("gridHeight") {
            obj.insert("gridHeight".to_string(), serde_json::Value::Number(serde_json::Number::from(104)));
        }
        if !obj.contains_key("gridGapX") {
            obj.insert("gridGapX".to_string(), serde_json::Value::Number(serde_json::Number::from(20)));
        }
        if !obj.contains_key("gridGapY") {
            obj.insert("gridGapY".to_string(), serde_json::Value::Number(serde_json::Number::from(20)));
        }
        if !obj.contains_key("fontSize") {
            obj.insert("fontSize".to_string(), serde_json::Value::Number(serde_json::Number::from(12)));
        }
    }
    
    serde_json::from_value(value).map_err(|e| e.to_string())
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let path = get_settings_path();
    let data = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

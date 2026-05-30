use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

fn get_data_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("DeskZero");
    fs::create_dir_all(&path).ok();
    path
}

fn get_layout_path() -> PathBuf {
    get_data_dir().join("desktop_layout.json")
}

pub fn load_layout() -> Result<HashMap<String, crate::models::container::Position>, String> {
    let path = get_layout_path();
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

pub fn save_layout(layout: &HashMap<String, crate::models::container::Position>) -> Result<(), String> {
    let path = get_layout_path();
    let data = serde_json::to_string_pretty(layout).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

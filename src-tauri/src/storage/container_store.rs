use crate::models::Container;
use std::fs;
use std::path::PathBuf;

fn get_data_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("DeskZero");
    fs::create_dir_all(&path).ok();
    path
}

fn get_containers_path() -> PathBuf {
    get_data_dir().join("containers.json")
}

fn get_backup_path() -> PathBuf {
    get_data_dir().join("containers.backup.json")
}

pub fn load_containers() -> Result<Vec<Container>, String> {
    let path = get_containers_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

pub fn save_containers(containers: &[Container]) -> Result<(), String> {
    let path = get_containers_path();
    let backup_path = get_backup_path();

    if path.exists() {
        fs::copy(&path, &backup_path).ok();
    }

    let data = serde_json::to_string_pretty(containers).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

pub fn restore_from_backup() -> Result<Vec<Container>, String> {
    let backup_path = get_backup_path();
    if !backup_path.exists() {
        return Err("备份文件不存在".to_string());
    }
    let data = fs::read_to_string(&backup_path).map_err(|e| e.to_string())?;
    let containers: Vec<Container> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    save_containers(&containers)?;
    Ok(containers)
}

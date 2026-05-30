use std::path::Path;

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_file(path: String, new_name: String) -> Result<String, String> {
    let old_path = Path::new(&path);
    let parent = old_path.parent().ok_or("无法获取父目录")?;
    let new_path = parent.join(&new_name);
    std::fs::rename(old_path, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn trash_file(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        trash::delete(&path).map_err(|e| format!("Failed to move to trash: {}", e))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn move_file(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_folder(path: String) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_empty_file(path: String) -> Result<(), String> {
    std::fs::File::create(path).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_terminal(shell: String, path: String) -> Result<(), String> {
    let mut c = std::process::Command::new("cmd");
    c.arg("/c").arg("start");
    
    if shell.to_lowercase() == "cmd" {
        c.arg("cmd.exe").arg("/K").arg(format!("cd /d \"{}\"", path));
    } else {
        c.arg("powershell.exe").arg("-NoExit").arg("-Command").arg(format!("Set-Location -LiteralPath '{}'", path));
    }
    
    c.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

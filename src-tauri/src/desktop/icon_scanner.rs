use std::path::PathBuf;

use crate::models::{Item, ItemType};

pub fn get_desktop_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(desktop) = dirs::desktop_dir() {
        paths.push(desktop);
    }

    let public_desktop = PathBuf::from(r"C:\Users\Public\Desktop");
    if public_desktop.exists() {
        paths.push(public_desktop);
    }

    paths
}

pub fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    let desktop_paths = get_desktop_paths();
    let mut items = Vec::new();

    for desktop_path in &desktop_paths {
        let entries = std::fs::read_dir(desktop_path)
            .map_err(|e| format!("读取桌面目录失败: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let item_type = if path.extension().map_or(false, |ext| ext == "lnk") {
                ItemType::Shortcut
            } else if path.extension().map_or(false, |ext| ext == "url") {
                ItemType::Url
            } else if path.is_dir() {
                ItemType::Folder
            } else {
                ItemType::File
            };

            let target_path = if item_type == ItemType::Shortcut {
                crate::desktop::shortcut::resolve_shortcut(&path).ok()
            } else {
                None
            };

            let mut icon_path = String::new();
            
            // Try to extract icon based on target path or file path
            let extract_path = target_path.as_ref().map(|s| s.clone()).unwrap_or_else(|| path.to_string_lossy().to_string());
            if let Ok(base64_img) = win_icon_extractor::extract_icon_webp_base64(&extract_path) {
                icon_path = format!("data:image/webp;base64,{}", base64_img);
            }

            items.push(Item {
                id: uuid::Uuid::new_v4().to_string(),
                name,
                path: path.to_string_lossy().to_string(),
                icon_path,
                item_type,
                target_path,
                is_in_container: false,
                container_id: None,
            });
        }
    }

    Ok(items)
}

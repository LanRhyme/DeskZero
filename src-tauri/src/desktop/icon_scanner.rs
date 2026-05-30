use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;

use crate::models::{Item, ItemType};

static ICON_CACHE: Lazy<Mutex<HashMap<String, CacheEntry>>> = Lazy::new(|| {
    let cache = load_cache_from_disk();
    Mutex::new(cache)
});

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct CacheEntry {
    icon_data: String,
    mtime: u64,
}

fn get_cache_path() -> PathBuf {
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("DeskZero");
    std::fs::create_dir_all(&cache_dir).ok();
    cache_dir.join("icon_cache.json")
}

fn load_cache_from_disk() -> HashMap<String, CacheEntry> {
    let path = get_cache_path();
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(cache) = serde_json::from_str(&data) {
            return cache;
        }
    }
    HashMap::new()
}

fn save_cache_to_disk(cache: &HashMap<String, CacheEntry>) {
    let path = get_cache_path();
    if let Ok(data) = serde_json::to_string(cache) {
        let _ = std::fs::write(&path, data);
    }
}

fn get_file_mtime(path: &std::path::Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn get_file_size(path: &std::path::Path) -> u64 {
    std::fs::metadata(path)
        .map(|m| m.len())
        .unwrap_or(0)
}

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

struct PreparedEntry {
    path: PathBuf,
    name: String,
    item_type: ItemType,
    target_path: Option<String>,
    mtime: u64,
    size: u64,
    cache_key: String,
    cached_icon: Option<String>,
}

pub fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    let desktop_paths = get_desktop_paths();

    let mut all_entries = Vec::new();
    for desktop_path in &desktop_paths {
        if let Ok(entries) = std::fs::read_dir(desktop_path) {
            for entry in entries.flatten() {
                all_entries.push(entry);
            }
        }
    }

    // Step 1: Collect metadata (sequential, fast)
    let mut cache = ICON_CACHE.lock().map_err(|e| e.to_string())?;
    let mut cache_dirty = false;

    let mut prepared = Vec::with_capacity(all_entries.len());
    for entry in all_entries {
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
            crate::desktop::shortcut::resolve_shortcut_icon(&path)
                .or_else(|| crate::desktop::shortcut::resolve_shortcut(&path).ok())
        } else if item_type == ItemType::Url {
            crate::desktop::shortcut::resolve_url_icon(&path)
        } else {
            None
        };

        let mtime = get_file_mtime(&path);
        let size = get_file_size(&path);
        let cache_key = path.to_string_lossy().to_string();

        let cached_icon = cache.get(&cache_key).and_then(|entry| {
            if entry.mtime == mtime && !entry.icon_data.is_empty() {
                Some(entry.icon_data.clone())
            } else {
                None
            }
        });

        prepared.push(PreparedEntry {
            path,
            name,
            item_type,
            target_path,
            mtime,
            size,
            cache_key,
            cached_icon,
        });
    }

    // Step 2: Extract icons for cache misses in parallel
    use rayon::prelude::*;

    let icon_results: Vec<(usize, String)> = prepared
        .par_iter()
        .enumerate()
        .filter_map(|(idx, entry)| {
            if entry.cached_icon.is_some() {
                return None;
            }
            let icon = extract_icon_for_path(&entry.path, &entry.target_path);
            Some((idx, icon))
        })
        .collect();

    // Step 3: Merge results and update cache (sequential)
    for (idx, icon) in icon_results {
        cache.insert(
            prepared[idx].cache_key.clone(),
            CacheEntry {
                icon_data: icon.clone(),
                mtime: prepared[idx].mtime,
            },
        );
        prepared[idx].cached_icon = Some(icon);
        cache_dirty = true;
    }

    if cache_dirty {
        save_cache_to_disk(&cache);
    }

    // Release lock before building items
    drop(cache);

    // Step 4: Build final items
    let mut items: Vec<Item> = prepared
        .into_iter()
        .map(|entry| {
            let icon_path = entry.cached_icon.unwrap_or_default();

            Item {
                id: {
                    use base64::{Engine as _, engine::general_purpose::STANDARD};
                    STANDARD.encode(entry.path.to_string_lossy().as_bytes())
                },
                name: entry.name,
                path: entry.path.to_string_lossy().to_string(),
                icon_path,
                item_type: entry.item_type,
                target_path: entry.target_path,
                is_in_container: false,
                container_id: None,
                position: None,
                size: Some(entry.size),
                modified_at: Some(entry.mtime),
            }
        })
        .collect();

    // Add System Icons based on registry visibility
    let is_hidden = |clsid: &str, default_hidden: bool| -> bool {
        let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
        
        // 1. Check NewStartPanel
        if let Ok(key) = hkcu.open_subkey(r#"Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel"#) {
            if let Ok(val) = key.get_value::<u32, _>(clsid) {
                return val == 1;
            }
        }
        
        // 2. Check ClassicStartMenu
        if let Ok(key) = hkcu.open_subkey(r#"Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\ClassicStartMenu"#) {
            if let Ok(val) = key.get_value::<u32, _>(clsid) {
                return val == 1;
            }
        }
        
        default_hidden
    };

    let get_stock_icon_base64 = |stock_icon: win_icon_extractor::StockIcon| -> String {
        if let Ok(icon_data) = win_icon_extractor::extract_stock_icon(stock_icon) {
            if let Ok(webp_bytes) = win_icon_extractor::encode_webp(&icon_data.rgba, icon_data.width, icon_data.height) {
                use base64::Engine;
                let b64 = base64::engine::general_purpose::STANDARD.encode(&webp_bytes);
                return format!("data:image/webp;base64,{}", b64);
            }
        }
        String::new()
    };

    // This PC (hidden by default)
    if !is_hidden("{20D04FE0-3AEA-1069-A2D8-08002B30309D}", true) {
        items.push(Item {
            id: "system-this-pc".to_string(),
            name: "此电脑".to_string(),
            path: "shell:::{20D04FE0-3AEA-1069-A2D8-08002B30309D}".to_string(),
            icon_path: get_stock_icon_base64(win_icon_extractor::StockIcon::DesktopPc),
            item_type: ItemType::System,
            target_path: Some("{20D04FE0-3AEA-1069-A2D8-08002B30309D}".to_string()),
            is_in_container: false,
            container_id: None,
            position: None,
            size: None,
            modified_at: None,
        });
    }

    // Recycle Bin (shown by default)
    if !is_hidden("{645FF040-5081-101B-9F08-00AA002F954E}", false) {
        // We could check if it's full or not, but Recycler is fine.
        items.push(Item {
            id: "system-recycle-bin".to_string(),
            name: "回收站".to_string(),
            path: "shell:::{645FF040-5081-101B-9F08-00AA002F954E}".to_string(),
            icon_path: get_stock_icon_base64(win_icon_extractor::StockIcon::Recycler),
            item_type: ItemType::System,
            target_path: Some("{645FF040-5081-101B-9F08-00AA002F954E}".to_string()),
            is_in_container: false,
            container_id: None,
            position: None,
            size: None,
            modified_at: None,
        });
    }

    Ok(items)
}

fn extract_icon_for_path(
    path: &std::path::Path,
    target_path: &Option<String>,
) -> String {
    let extract_path = target_path
        .as_ref()
        .cloned()
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    // Try extracting icon from the target path (only if it exists)
    let target_exists = std::path::Path::new(&extract_path).exists();
    if target_exists {
        match win_icon_extractor::extract_icon_webp_base64(&extract_path) {
            Ok(base64_img) => {
                return format!("data:image/webp;base64,{}", base64_img);
            }
            Err(e) => {
                eprintln!("[DeskZero] extract_icon_webp_base64 failed for {}: {:?}", extract_path, e);
            }
        }
    } else {
        eprintln!("[DeskZero] target path does not exist: {}", extract_path);
    }

    // Fallback: try to extract from the file itself
    let file_path = path.to_string_lossy().to_string();
    if file_path != extract_path && path.exists() {
        match win_icon_extractor::extract_icon_webp_base64(&file_path) {
            Ok(base64_img) => {
                return format!("data:image/webp;base64,{}", base64_img);
            }
            Err(_) => {}
        }
    }

    // Fallback: try to get icon from target file's extension (e.g. .ico, .exe)
    let target_ext = std::path::Path::new(&extract_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if !target_ext.is_empty() {
        let ext_with_dot = format!(".{}", target_ext);
        match win_icon_extractor::extract_icon_for_extension(&ext_with_dot) {
            Ok(icon_data) => {
                match win_icon_extractor::encode_webp(&icon_data.rgba, icon_data.width, icon_data.height) {
                    Ok(webp_bytes) => {
                        use base64::Engine;
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&webp_bytes);
                        return format!("data:image/webp;base64,{}", b64);
                    }
                    Err(_) => {}
                }
            }
            Err(e) => {
                eprintln!("[DeskZero] Failed to extract icon for extension {}: {:?}", ext_with_dot, e);
            }
        }
    }

    // Fallback: try to get icon from the file's own extension
    let file_ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !file_ext.is_empty() && file_ext != target_ext {
        let ext_with_dot = format!(".{}", file_ext);
        match win_icon_extractor::extract_icon_for_extension(&ext_with_dot) {
            Ok(icon_data) => {
                match win_icon_extractor::encode_webp(&icon_data.rgba, icon_data.width, icon_data.height) {
                    Ok(webp_bytes) => {
                        use base64::Engine;
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&webp_bytes);
                        return format!("data:image/webp;base64,{}", b64);
                    }
                    Err(_) => {}
                }
            }
            Err(_) => {}
        }
    }

    eprintln!("[DeskZero] All icon extraction methods failed for: {}", path.display());
    String::new()
}

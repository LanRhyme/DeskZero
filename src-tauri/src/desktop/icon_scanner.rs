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
            crate::desktop::shortcut::resolve_shortcut(&path).ok()
        } else {
            None
        };

        let mtime = get_file_mtime(&path);
        let cache_key = path.to_string_lossy().to_string();

        let cached_icon = cache.get(&cache_key).and_then(|entry| {
            if entry.mtime == mtime {
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
    let items: Vec<Item> = prepared
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
            }
        })
        .collect();

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

    if let Ok(base64_img) = win_icon_extractor::extract_icon_webp_base64(&extract_path) {
        format!("data:image/webp;base64,{}", base64_img)
    } else {
        String::new()
    }
}

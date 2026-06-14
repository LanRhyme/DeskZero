use crate::desktop::icon_scanner;
use crate::models::Item;
use std::collections::HashMap;
use std::sync::Mutex;

static DESKTOP_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub async fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    tokio::task::spawn_blocking(|| icon_scanner::scan_desktop_icons())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scan_directory_icons(path: String) -> Result<Vec<Item>, String> {
    tokio::task::spawn_blocking(move || icon_scanner::scan_directory_icons(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_desktop_dir() -> Result<String, String> {
    dirs::desktop_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "找不到桌面目录".to_string())
}

#[tauri::command]
pub fn get_desktop_layout() -> Result<HashMap<String, crate::models::container::Position>, String> {
    let _lock = DESKTOP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    crate::storage::desktop_store::load_layout()
}

#[tauri::command]
pub fn save_desktop_layout(layout: HashMap<String, crate::models::container::Position>) -> Result<(), String> {
    let _lock = DESKTOP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    crate::storage::desktop_store::save_layout(&layout)
}

#[tauri::command]
pub fn sync_windows_layout(
    window: tauri::Window,
    multiplier: f64,
) -> Result<(crate::models::settings::Settings, HashMap<String, crate::models::container::Position>), String> {
    let _lock = DESKTOP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    // Effective scale factor = system scale factor / multiplier
    // Higher multiplier makes the layout grid and positions larger in CSS pixels.
    let effective_scale = scale_factor / multiplier.max(0.1);
    eprintln!(
        "[DeskZero] System scale factor: {}, Multiplier: {}, Effective scale: {}",
        scale_factor, multiplier, effective_scale
    );

    // 1. Get Windows Layout
    let windows_layout = crate::desktop::layout_sync::get_windows_desktop_layout()?;
    
    // Convert physical layout positions to logical (CSS) pixels based on effective scale factor
    let mut logical_layout = HashMap::new();
    for (id, pos) in windows_layout {
        logical_layout.insert(id, crate::models::container::Position {
            x: pos.x / effective_scale,
            y: pos.y / effective_scale,
        });
    }

    eprintln!("[DeskZero] Fetched {} items from Windows layout:", logical_layout.len());
    for (name, pos) in &logical_layout {
        eprintln!("  - {}: ({}, {})", name, pos.x, pos.y);
    }


    
    crate::storage::desktop_store::save_layout(&logical_layout)?;
    eprintln!("[DeskZero] Synced {} items to database", logical_layout.len());
    
    // 3. Get Grid Metrics & Update Settings
    let mut current_settings = crate::storage::settings_store::load_settings()?;
    if let Ok((width, height)) = crate::desktop::layout_sync::get_windows_grid_metrics() {
        let raw_logical_width = (width as f64 / scale_factor).round() as u32;
        let raw_logical_height = (height as f64 / scale_factor).round() as u32;
        
        // Define base presets based on Windows Desktop Icon Spacing metrics
        // raw_logical_width <= 85 typically corresponds to Windows Small Icons (spacing around 75-80px)
        let (base_w, base_h, base_gap_x, base_gap_y) = if raw_logical_width <= 85 {
            (70, 75, 10, 20)
        } else {
            (80, 104, 20, 20)
        };
        
        // Apply user-defined multiplier on top of these optimal base configurations
        let grid_w = ((base_w as f64 * multiplier).round() as u32).max(20);
        let grid_h = ((base_h as f64 * multiplier).round() as u32).max(20);
        let gap_x = ((base_gap_x as f64 * multiplier).round() as u32).max(5);
        let gap_y = ((base_gap_y as f64 * multiplier).round() as u32).max(5);
        
        eprintln!(
            "[DeskZero] Spacing: {}x{} (raw logical: {}x{}). Presets: grid: {}x{}, gap: {}x{}. Applied multiplier {}: grid: {}x{}, gap: {}x{}",
            width, height, raw_logical_width, raw_logical_height, base_w, base_h, base_gap_x, base_gap_y, multiplier, grid_w, grid_h, gap_x, gap_y
        );
        
        current_settings.grid_width = grid_w;
        current_settings.grid_height = grid_h;
        current_settings.grid_gap_x = gap_x;
        current_settings.grid_gap_y = gap_y;
        crate::storage::settings_store::save_settings(&current_settings)?;
    }
    
    // Broadcast setting and layout changes to all windows (e.g. desktop window)
    use tauri::Emitter;
    window.emit("settings-updated", &current_settings).ok();
    window.emit("sync-desktop-layout", ()).ok();
    
    Ok((current_settings, logical_layout))
}

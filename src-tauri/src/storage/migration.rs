use std::fs;
use std::collections::HashMap;
use crate::models::container::Container;
use super::db::{get_connection, get_data_dir};

pub fn run_migrations() {
    let _ = migrate_settings();
    let _ = migrate_desktop_layout();
    let _ = migrate_containers();
}

fn migrate_settings() -> Result<(), String> {
    let data_dir = get_data_dir();
    let json_path = data_dir.join("settings.json");
    let legacy_path = data_dir.join("settings.legacy.bak");
    
    if json_path.exists() {
        if let Ok(data) = fs::read_to_string(&json_path) {
            // 解析为 Value 兼容缺省字段
            if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Ok(conn) = get_connection() {
                    let settings_str = serde_json::to_string(&settings).unwrap_or_else(|_| "{}".to_string());
                    let _ = conn.execute(
                        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                        ("global", &settings_str),
                    );
                }
            }
        }
        let _ = fs::rename(&json_path, &legacy_path);
    }
    Ok(())
}

fn migrate_desktop_layout() -> Result<(), String> {
    let data_dir = get_data_dir();
    let json_path = data_dir.join("desktop_layout.json");
    let legacy_path = data_dir.join("desktop_layout.legacy.bak");
    
    if json_path.exists() {
        if let Ok(data) = fs::read_to_string(&json_path) {
            if let Ok(layout) = serde_json::from_str::<HashMap<String, crate::models::container::Position>>(&data) {
                if let Ok(mut conn) = get_connection() {
                    if let Ok(tx) = conn.transaction() {
                        for (id, pos) in layout {
                            let _ = tx.execute(
                                "INSERT OR REPLACE INTO desktop_layout (item_id, x, y) VALUES (?1, ?2, ?3)",
                                (&id, pos.x, pos.y),
                            );
                        }
                        let _ = tx.commit();
                    }
                }
            }
        }
        let _ = fs::rename(&json_path, &legacy_path);
    }
    Ok(())
}

fn migrate_containers() -> Result<(), String> {
    let data_dir = get_data_dir();
    let json_path = data_dir.join("containers.json");
    let legacy_path = data_dir.join("containers.legacy.bak");
    
    if json_path.exists() {
        if let Ok(data) = fs::read_to_string(&json_path) {
            if let Ok(containers) = serde_json::from_str::<Vec<Container>>(&data) {
                if let Ok(mut conn) = get_connection() {
                    if let Ok(tx) = conn.transaction() {
                        for container in containers {
                            let type_str = serde_json::to_string(&container.container_type)
                                .unwrap_or_else(|_| "\"normal\"".to_string()).replace("\"", "");
                            let style_str = serde_json::to_string(&container.style)
                                .unwrap_or_else(|_| "{}".to_string());
                            
                            let _ = tx.execute(
                                "INSERT OR REPLACE INTO containers (id, name, type, x, y, width, height, style, folder_path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                                (
                                    &container.id,
                                    &container.name,
                                    &type_str,
                                    container.position.x,
                                    container.position.y,
                                    container.size.width,
                                    container.size.height,
                                    &style_str,
                                    &container.folder_path,
                                    container.created_at,
                                    container.updated_at
                                ),
                            );
                            
                            for (i, item) in container.items.iter().enumerate() {
                                let item_type_str = serde_json::to_string(&item.item_type)
                                    .unwrap_or_else(|_| "\"file\"".to_string()).replace("\"", "");
                                let pos_x = item.position.as_ref().map(|p| p.x).unwrap_or(0.0);
                                let pos_y = item.position.as_ref().map(|p| p.y).unwrap_or(0.0);
                                
                                let _ = tx.execute(
                                    "INSERT OR REPLACE INTO container_items (id, container_id, name, path, icon_path, item_type, target_path, size, modified_at, x, y, order_index) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                                    (
                                        &item.id,
                                        &container.id,
                                        &item.name,
                                        &item.path,
                                        &item.icon_path,
                                        &item_type_str,
                                        &item.target_path,
                                        item.size.map(|s| s as i64),
                                        item.modified_at.map(|m| m as i64),
                                        pos_x,
                                        pos_y,
                                        i as i64
                                    ),
                                );
                            }
                        }
                        let _ = tx.commit();
                    }
                }
            }
        }
        let _ = fs::rename(&json_path, &legacy_path);
    }
    Ok(())
}

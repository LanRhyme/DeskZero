use crate::models::{Container, container::{ContainerType, ContainerStyle, Position, Size}, item::{Item, ItemType}};
use super::db::get_connection;

pub fn load_containers() -> Result<Vec<Container>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    // Read containers
    let mut stmt = conn.prepare("SELECT id, name, type, x, y, width, height, style, folder_path, created_at, updated_at FROM containers").map_err(|e| e.to_string())?;
    let container_rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let name: String = row.get(1)?;
        let type_str: String = row.get(2)?;
        let x: f64 = row.get(3)?;
        let y: f64 = row.get(4)?;
        let width: f64 = row.get(5)?;
        let height: f64 = row.get(6)?;
        let style_str: String = row.get(7)?;
        let folder_path: Option<String> = row.get(8)?;
        let created_at: i64 = row.get(9)?;
        let updated_at: i64 = row.get(10)?;
        
        let container_type: ContainerType = serde_json::from_str(&format!("\"{}\"", type_str)).unwrap_or(ContainerType::Normal);
        let style: ContainerStyle = serde_json::from_str(&style_str).unwrap_or_default();
        
        Ok(Container {
            id,
            name,
            container_type,
            position: Position { x, y },
            size: Size { width, height },
            items: Vec::new(),
            style,
            folder_path,
            created_at: created_at as u64,
            updated_at: updated_at as u64,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut containers = Vec::new();
    for row in container_rows {
        if let Ok(c) = row {
            containers.push(c);
        }
    }
    
    // Read items
    let mut item_stmt = conn.prepare("SELECT id, container_id, name, path, icon_path, item_type, target_path, size, modified_at, x, y, order_index FROM container_items ORDER BY container_id, order_index").map_err(|e| e.to_string())?;
    
    let item_rows = item_stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let container_id: String = row.get(1)?;
        let name: String = row.get(2)?;
        let path: String = row.get(3)?;
        let icon_path: String = row.get(4)?;
        let item_type_str: String = row.get(5)?;
        let target_path: Option<String> = row.get(6)?;
        let size: Option<i64> = row.get(7)?;
        let modified_at: Option<i64> = row.get(8)?;
        let x: Option<f64> = row.get(9)?;
        let y: Option<f64> = row.get(10)?;
        
        let item_type: ItemType = serde_json::from_str(&format!("\"{}\"", item_type_str)).unwrap_or(ItemType::File);
        let position = match (x, y) {
            (Some(px), Some(py)) => Some(Position { x: px, y: py }),
            _ => None,
        };
        
        Ok((container_id.clone(), Item {
            id,
            name,
            path,
            icon_path,
            item_type,
            target_path,
            is_in_container: true,
            container_id: Some(container_id),
            position,
            size: size.map(|s| s as u64),
            modified_at: modified_at.map(|m| m as u64),
        }))
    }).map_err(|e| e.to_string())?;
    
    for row in item_rows {
        if let Ok((cid, item)) = row {
            if let Some(c) = containers.iter_mut().find(|c| c.id == cid) {
                c.items.push(item);
            }
        }
    }
    
    Ok(containers)
}

pub fn save_containers(containers: &[Container]) -> Result<(), String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // Clear old data
    tx.execute("DELETE FROM containers", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM container_items", []).map_err(|e| e.to_string())?;
    
    for container in containers {
        let type_str = serde_json::to_string(&container.container_type).unwrap_or_else(|_| "\"normal\"".to_string()).replace("\"", "");
        let style_str = serde_json::to_string(&container.style).unwrap_or_else(|_| "{}".to_string());
        
        tx.execute(
            "INSERT INTO containers (id, name, type, x, y, width, height, style, folder_path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
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
                container.created_at as i64,
                container.updated_at as i64
            ),
        ).map_err(|e| e.to_string())?;
        
        for (i, item) in container.items.iter().enumerate() {
            let item_type_str = serde_json::to_string(&item.item_type).unwrap_or_else(|_| "\"file\"".to_string()).replace("\"", "");
            let pos_x = item.position.as_ref().map(|p| p.x);
            let pos_y = item.position.as_ref().map(|p| p.y);
            
            tx.execute(
                "INSERT INTO container_items (id, container_id, name, path, icon_path, item_type, target_path, size, modified_at, x, y, order_index) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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
            ).map_err(|e| e.to_string())?;
        }
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

use crate::models::{Container, container::{ContainerType, ContainerStyle, Position, Size}, item::{Item, ItemType}};
use std::collections::HashMap;
use super::db::get_connection;

pub fn load_containers() -> Result<Vec<Container>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    // 读取容器
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
        
        // 使用自定义反序列化：未知类型会被保留为 Other(String)，不会丢失
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
            extra: HashMap::new(),
        })
    }).map_err(|e| e.to_string())?;
    
    let mut containers = Vec::new();
    for row in container_rows {
        if let Ok(c) = row {
            containers.push(c);
        }
    }
    
    // 读取项目
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
        
        // 使用自定义反序列化：未知类型会被保留为 Other(String)
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

/// 保存容器数据 — 使用差异删除 + UPSERT 策略替代全量 DELETE + INSERT，
/// 确保未来版本新增的数据库列不会被老版本误删。
pub fn save_containers(containers: &[Container]) -> Result<(), String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // 危险的全量差异删除已移除：
    // 我们不再扫描现有容器并删除不在传入列表中的容器。
    // 这防止了由于 load_containers 意外跳过某个损坏的容器导致它被永久删除。
    // 容器的删除必须通过显式的 delete_container_by_id 来完成。
    
    // UPSERT 容器：只更新自己认识的列，不影响未来版本新增的列
    for container in containers {
        let type_str = serde_json::to_string(&container.container_type).unwrap_or_else(|_| "\"normal\"".to_string()).replace("\"", "");
        let style_str = serde_json::to_string(&container.style).unwrap_or_else(|_| "{}".to_string());
        
        // 只针对当前这个容器执行项目差异删除，避免误删其他容器的项目
        let new_item_ids: Vec<&str> = container.items.iter().map(|i| i.id.as_str()).collect();
        let mut existing_items_stmt = tx.prepare("SELECT id FROM container_items WHERE container_id = ?1").map_err(|e| e.to_string())?;
        let existing_items: Vec<String> = existing_items_stmt.query_map([&container.id], |row| row.get(0)).map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
            
        for eid in &existing_items {
            if !new_item_ids.contains(&eid.as_str()) {
                tx.execute("DELETE FROM container_items WHERE id = ?1", [eid]).map_err(|e| e.to_string())?;
            }
        }
        
        tx.execute(
            "INSERT INTO containers (id, name, type, x, y, width, height, style, folder_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                x = excluded.x,
                y = excluded.y,
                width = excluded.width,
                height = excluded.height,
                style = excluded.style,
                folder_path = excluded.folder_path,
                updated_at = excluded.updated_at",
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
        
        // UPSERT 项目
        for (i, item) in container.items.iter().enumerate() {
            let item_type_str = serde_json::to_string(&item.item_type).unwrap_or_else(|_| "\"file\"".to_string()).replace("\"", "");
            let pos_x = item.position.as_ref().map(|p| p.x);
            let pos_y = item.position.as_ref().map(|p| p.y);
            
            tx.execute(
                "INSERT INTO container_items (id, container_id, name, path, icon_path, item_type, target_path, size, modified_at, x, y, order_index)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                 ON CONFLICT(id) DO UPDATE SET
                    container_id = excluded.container_id,
                    name = excluded.name,
                    path = excluded.path,
                    icon_path = excluded.icon_path,
                    item_type = excluded.item_type,
                    target_path = excluded.target_path,
                    size = excluded.size,
                    modified_at = excluded.modified_at,
                    x = excluded.x,
                    y = excluded.y,
                    order_index = excluded.order_index",
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

pub fn delete_container_by_id(id: &str) -> Result<(), String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM container_items WHERE container_id = ?1", [id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM containers WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

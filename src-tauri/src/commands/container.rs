use crate::models::{Container, ContainerStyle, ContainerType, Position, Size};
use crate::storage::container_store;
use std::collections::HashMap;
use std::sync::Mutex;

/// 全局互斥锁，防止并发读写容器数据导致竞态条件。
/// 前端的多个 persistContainer 调用可能同时触发 load+save，
/// 没有锁的话后到的操作会覆盖先到的操作的修改。
static CONTAINER_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub fn get_all_containers() -> Result<Vec<Container>, String> {
    let _lock = CONTAINER_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    container_store::load_containers()
}

#[tauri::command]
pub fn create_container(
    name: String,
    container_type: ContainerType,
    position: Position,
    monitor_id: Option<String>,
) -> Result<Container, String> {
    let _lock = CONTAINER_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    let now = chrono::Utc::now().timestamp_millis() as u64;
    let mut style = ContainerStyle::default();
    let mut size = Size {
        width: 200.0,
        height: 300.0,
    };

    if container_type == ContainerType::Game {
        style.background_opacity = 1.0;
    } else if container_type == ContainerType::IconShow {
        style.background_opacity = 0.3;
        style.feather_x = Some(0.0);
        style.feather_y = Some(0.0);
        style.icon_opacity_inside = Some(1.0);
        style.icon_size_inside = Some(64.0);
        style.hover_animation = Some("scale".to_string());
        style.show_names_inside = Some(false);
        style.icon_gap_ratio = Some(1.0);

        // 加载当前数据库中的网格设置以精确计算 2x2 像素大小
        let settings = crate::storage::settings_store::load_settings().unwrap_or_default();
        let step_x = (settings.grid_width + settings.grid_gap_x) as f64;
        let step_y = (settings.grid_height + settings.grid_gap_y) as f64;
        size = Size {
            width: 2.0 * step_x - settings.grid_gap_x as f64,
            height: 2.0 * step_y - settings.grid_gap_y as f64,
        };
    } else if container_type == ContainerType::Widget {
        style.background_opacity = 0.5;
        style.corner_radius = 12.0;
        // Widget 默认大小由前端根据具体小组件类型设置
        // Rust 端使用通用默认值，前端会在创建后根据 widgetType 调整
    }

    let container = Container {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        container_type,
        position,
        size,
        items: Vec::new(),
        style,
        folder_path: None,
        monitor_id,
        created_at: now,
        updated_at: now,
        extra: HashMap::new(),
    };

    let mut containers = container_store::load_containers()?;
    containers.push(container.clone());
    container_store::save_containers(&containers)?;
    Ok(container)
}

#[tauri::command]
pub fn update_container(
    id: String,
    name: Option<String>,
    position: Option<Position>,
    size: Option<Size>,
    monitor_id: Option<Option<String>>,
) -> Result<Container, String> {
    let _lock = CONTAINER_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    let mut containers = container_store::load_containers()?;
    let container = containers
        .iter_mut()
        .find(|c| c.id == id)
        .ok_or("容器不存在")?;

    if let Some(n) = name {
        container.name = n;
    }
    if let Some(p) = position {
        container.position = p;
    }
    if let Some(s) = size {
        container.size = s;
    }
    if let Some(m) = monitor_id {
        container.monitor_id = m;
    }
    container.updated_at = chrono::Utc::now().timestamp_millis() as u64;

    let result = container.clone();
    container_store::save_containers(&containers)?;
    Ok(result)
}

#[tauri::command]
pub fn update_container_full(container: Container) -> Result<(), String> {
    let _lock = CONTAINER_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    let mut containers = container_store::load_containers()?;
    if let Some(pos) = containers.iter().position(|c| c.id == container.id) {
        let mut updated = container.clone();
        updated.updated_at = chrono::Utc::now().timestamp_millis() as u64;
        containers[pos] = updated;
        container_store::save_containers(&containers)?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_container(id: String) -> Result<(), String> {
    let _lock = CONTAINER_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    container_store::delete_container_by_id(&id)
}

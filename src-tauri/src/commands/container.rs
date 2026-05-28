use crate::models::{Container, ContainerType, Position, Size};
use crate::storage::container_store;

#[tauri::command]
pub fn get_all_containers() -> Result<Vec<Container>, String> {
    container_store::load_containers()
}

#[tauri::command]
pub fn create_container(
    name: String,
    container_type: ContainerType,
    position: Position,
) -> Result<Container, String> {
    let now = chrono::Utc::now().timestamp_millis() as u64;
    let container = Container {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        container_type,
        position,
        size: Size {
            width: 200.0,
            height: 300.0,
        },
        items: Vec::new(),
        style: Default::default(),
        folder_path: None,
        created_at: now,
        updated_at: now,
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
) -> Result<Container, String> {
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
    container.updated_at = chrono::Utc::now().timestamp_millis() as u64;

    let result = container.clone();
    container_store::save_containers(&containers)?;
    Ok(result)
}

#[tauri::command]
pub fn delete_container(id: String) -> Result<(), String> {
    let mut containers = container_store::load_containers()?;
    containers.retain(|c| c.id != id);
    container_store::save_containers(&containers)
}

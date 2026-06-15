#[cfg(test)]
mod tests {
    use crate::models::*;
    use crate::storage::container_store::*;
    use std::collections::HashMap;

    #[test]
    fn test_load_empty_containers() {
        let result = load_containers();
        assert!(result.is_ok());
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let containers = vec![Container {
            id: "test-1".to_string(),
            name: "测试".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 10.0, y: 20.0 },
            size: Size {
                width: 200.0,
                height: 300.0,
            },
            items: vec![],
            style: ContainerStyle::default(),
            folder_path: None,
            created_at: 1234567890,
            updated_at: 1234567890,
            extra: HashMap::new(),
        }];

        save_containers(&containers).unwrap();
        let loaded = load_containers().unwrap();
        let loaded_container = loaded.iter().find(|c| c.id == "test-1").expect("未找到测试写入的容器");
        assert_eq!(loaded_container.name, "测试");
        assert_eq!(loaded_container.position.x, 10.0);
        
        // 清理测试数据
        delete_container_by_id("test-1").unwrap();
    }
}


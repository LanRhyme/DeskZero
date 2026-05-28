#[cfg(test)]
mod tests {
    use crate::models::*;
    use crate::storage::container_store::*;

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
            size: Size { width: 200.0, height: 300.0 },
            items: vec![],
            style: ContainerStyle::default(),
            folder_path: None,
            created_at: 1234567890,
            updated_at: 1234567890,
        }];

        save_containers(&containers).unwrap();
        let loaded = load_containers().unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].name, "测试");
        assert_eq!(loaded[0].position.x, 10.0);
    }
}

#[cfg(test)]
mod tests {
    use crate::models::container::*;
    use crate::models::item::{Item, ItemType};

    #[test]
    fn test_container_default_style() {
        let style = ContainerStyle::default();
        assert_eq!(style.background_opacity, 0.88);
        assert_eq!(style.corner_radius, 10.0);
        assert!(style.show_header);
    }

    #[test]
    fn test_container_serialization() {
        let container = Container {
            id: "test-id".to_string(),
            name: "测试容器".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 100.0, y: 200.0 },
            size: Size { width: 200.0, height: 300.0 },
            items: vec![],
            style: ContainerStyle::default(),
            folder_path: None,
            created_at: 0,
            updated_at: 0,
        };

        let json = serde_json::to_string(&container).unwrap();
        let deserialized: Container = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "测试容器");
        assert_eq!(deserialized.container_type, ContainerType::Normal);
    }

    #[test]
    fn test_container_with_items() {
        let item = Item {
            id: "item-1".to_string(),
            name: "test.txt".to_string(),
            path: "C:\\test.txt".to_string(),
            icon_path: String::new(),
            item_type: ItemType::File,
            target_path: None,
            is_in_container: true,
            container_id: Some("test-id".to_string()),
        };

        let container = Container {
            id: "test-id".to_string(),
            name: "容器".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 0.0, y: 0.0 },
            size: Size { width: 200.0, height: 300.0 },
            items: vec![item],
            style: ContainerStyle::default(),
            folder_path: None,
            created_at: 0,
            updated_at: 0,
        };

        let json = serde_json::to_string(&container).unwrap();
        let deserialized: Container = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.items.len(), 1);
        assert_eq!(deserialized.items[0].name, "test.txt");
    }
}

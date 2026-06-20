#[cfg(test)]
mod tests {
    use crate::models::container::*;
    use crate::models::item::{Item, ItemType};
    use std::collections::HashMap;

    #[test]
    fn test_container_default_style() {
        let style = ContainerStyle::default();
        assert_eq!(style.background_opacity, 0.3);
        assert_eq!(style.corner_radius, 10.0);
        assert!(style.show_header);
        assert!(style.extra.is_empty());
    }

    #[test]
    fn test_container_serialization() {
        let container = Container {
            id: "test-id".to_string(),
            name: "测试容器".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 100.0, y: 200.0 },
            size: Size {
                width: 200.0,
                height: 300.0,
            },
            items: vec![],
            style: ContainerStyle::default(),
            folder_path: None,
            created_at: 0,
            updated_at: 0,
            extra: HashMap::new(),
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
            modified_at: None,
            position: None,
            size: None,
            extra: HashMap::new(),
        };

        let container = Container {
            id: "test-id".to_string(),
            name: "容器".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 0.0, y: 0.0 },
            size: Size {
                width: 200.0,
                height: 300.0,
            },
            items: vec![item],
            style: ContainerStyle::default(),
            folder_path: None,
            created_at: 0,
            updated_at: 0,
            extra: HashMap::new(),
        };

        let json = serde_json::to_string(&container).unwrap();
        let deserialized: Container = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.items.len(), 1);
        assert_eq!(deserialized.items[0].name, "test.txt");
    }

    /// 测试未知容器类型不会丢失 — 核心兼容性测试
    #[test]
    fn test_unknown_container_type_preserved() {
        let json = r#"{"id":"w1","name":"Widget","type":"widget","position":{"x":0,"y":0},"size":{"width":200,"height":300},"items":[],"style":{},"createdAt":0,"updatedAt":0}"#;
        let container: Container = serde_json::from_str(json).unwrap();
        assert_eq!(container.container_type, ContainerType::Other("widget".to_string()));
        
        // 重新序列化后类型应保持为 "widget"，不会变成 "normal"
        let re_json = serde_json::to_string(&container).unwrap();
        assert!(re_json.contains("\"widget\""));
    }

    /// 测试未知样式字段不会丢失 — 核心兼容性测试
    #[test]
    fn test_unknown_style_fields_preserved() {
        let json = r#"{"backgroundOpacity":0.5,"cornerRadius":8.0,"showHeader":true,"futureFeature":"value123","anotherNew":42}"#;
        let style: ContainerStyle = serde_json::from_str(json).unwrap();
        assert_eq!(style.background_opacity, 0.5);
        // 未知字段应被保留在 extra 中
        assert_eq!(style.extra.get("futureFeature").unwrap(), &serde_json::json!("value123"));
        assert_eq!(style.extra.get("anotherNew").unwrap(), &serde_json::json!(42));
        
        // 重新序列化后未知字段应保留
        let re_json = serde_json::to_string(&style).unwrap();
        assert!(re_json.contains("futureFeature"));
        assert!(re_json.contains("anotherNew"));
    }
}

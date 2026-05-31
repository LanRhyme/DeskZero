use serde::{Deserialize, Serialize};

/// 项目类型枚举 — 通过自定义序列化支持未知类型，
/// 避免新版本添加的类型在老版本中被强制回退为 File 导致数据损坏。
#[derive(Debug, Clone, PartialEq)]
pub enum ItemType {
    File,
    Folder,
    Shortcut,
    Url,
    System,
    /// 保留未知类型的原始字符串，防止跨版本数据丢失
    Other(String),
}

impl Serialize for ItemType {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let s = match self {
            ItemType::File => "file",
            ItemType::Folder => "folder",
            ItemType::Shortcut => "shortcut",
            ItemType::Url => "url",
            ItemType::System => "system",
            ItemType::Other(raw) => raw.as_str(),
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for ItemType {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "file" => ItemType::File,
            "folder" => ItemType::Folder,
            "shortcut" => ItemType::Shortcut,
            "url" => ItemType::Url,
            "system" => ItemType::System,
            _ => ItemType::Other(s),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(alias = "icon_path")]
    pub icon_path: String,
    #[serde(rename = "type", alias = "item_type")]
    pub item_type: ItemType,
    #[serde(alias = "target_path")]
    pub target_path: Option<String>,
    #[serde(alias = "is_in_container")]
    pub is_in_container: bool,
    #[serde(alias = "container_id")]
    pub container_id: Option<String>,
    pub position: Option<super::container::Position>,
    pub size: Option<u64>,
    #[serde(alias = "modified_at")]
    pub modified_at: Option<u64>,
}

impl Default for Item {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            path: String::new(),
            icon_path: String::new(),
            item_type: ItemType::File,
            target_path: None,
            is_in_container: false,
            container_id: None,
            position: None,
            size: None,
            modified_at: None,
        }
    }
}

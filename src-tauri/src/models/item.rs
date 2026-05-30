use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ItemType {
    File,
    Folder,
    Shortcut,
    Url,
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

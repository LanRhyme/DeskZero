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
pub struct Item {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon_path: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub target_path: Option<String>,
    pub is_in_container: bool,
    pub container_id: Option<String>,
}

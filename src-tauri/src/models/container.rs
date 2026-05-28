use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ContainerType {
    Normal,
    Mapping,
    Folder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerStyle {
    pub background_opacity: f64,
    pub corner_radius: f64,
    pub show_header: bool,
}

impl Default for ContainerStyle {
    fn default() -> Self {
        Self {
            background_opacity: 0.88,
            corner_radius: 10.0,
            show_header: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Container {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub container_type: ContainerType,
    pub position: Position,
    pub size: Size,
    pub items: Vec<super::item::Item>,
    pub style: ContainerStyle,
    pub folder_path: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ContainerType {
    Normal,
    Mapping,
    Folder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

impl Default for Position {
    fn default() -> Self {
        Self { x: 0.0, y: 0.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

impl Default for Size {
    fn default() -> Self {
        Self { width: 200.0, height: 300.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct ContainerStyle {
    pub background_opacity: f64,
    pub background_color: Option<String>,
    pub corner_radius: f64,
    pub show_header: bool,
    pub layout: Option<String>, // 'grid' | 'list'
    pub grid_enabled: Option<bool>,
    pub grid_width: Option<f64>,
    pub grid_height: Option<f64>,
    pub grid_gap_x: Option<f64>,
    pub grid_gap_y: Option<f64>,
    pub icon_size: Option<String>,
    pub show_details: Option<bool>,
    pub hide_app_names: Option<bool>,
}

impl Default for ContainerStyle {
    fn default() -> Self {
        Self {
            background_opacity: 0.3,
            background_color: None,
            corner_radius: 10.0,
            show_header: true,
            layout: None,
            grid_enabled: None,
            grid_width: None,
            grid_height: None,
            grid_gap_x: None,
            grid_gap_y: None,
            icon_size: None,
            show_details: None,
            hide_app_names: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
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
    #[serde(alias = "created_at")]
    pub created_at: u64,
    #[serde(alias = "updated_at")]
    pub updated_at: u64,
}

impl Default for Container {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: "New Container".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 0.0, y: 0.0 },
            size: Size { width: 200.0, height: 300.0 },
            items: Vec::new(),
            style: Default::default(),
            folder_path: None,
            created_at: 0,
            updated_at: 0,
        }
    }
}

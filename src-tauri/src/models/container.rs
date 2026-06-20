use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 容器类型枚举 — 通过自定义序列化支持未知类型，
/// 避免新版本添加的类型在老版本中被强制回退为 Normal 导致数据损坏。
#[derive(Debug, Clone, PartialEq)]
pub enum ContainerType {
    Normal,
    Mapping,
    Folder,
    Game,
    IconShow,
    Widget,
    /// 保留未知类型的原始字符串，防止跨版本数据丢失
    Other(String),
}

impl Serialize for ContainerType {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let s = match self {
            ContainerType::Normal => "normal",
            ContainerType::Mapping => "mapping",
            ContainerType::Folder => "folder",
            ContainerType::Game => "game",
            ContainerType::IconShow => "iconShow",
            ContainerType::Widget => "widget",
            ContainerType::Other(raw) => raw.as_str(),
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for ContainerType {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "normal" => ContainerType::Normal,
            "mapping" => ContainerType::Mapping,
            "folder" => ContainerType::Folder,
            "game" => ContainerType::Game,
            "iconShow" => ContainerType::IconShow,
            "widget" => ContainerType::Widget,
            _ => ContainerType::Other(s),
        })
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
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
        Self {
            width: 200.0,
            height: 300.0,
        }
    }
}

/// 容器样式 — 使用 `extra` 字段（`#[serde(flatten)]`）保留当前版本不认识的 JSON 属性，
/// 确保新版本写入的样式配置不会在老版本读写后丢失。
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
    pub list_height: Option<f64>,
    pub grid_gap_x: Option<f64>,
    pub grid_gap_y: Option<f64>,
    pub icon_size: Option<String>,
    pub show_details: Option<bool>,
    pub hide_app_names: Option<bool>,
    pub cover_image: Option<String>,
    pub sort_by: Option<String>,
    pub sort_desc: Option<bool>,
    pub feather_x: Option<f64>,
    pub feather_y: Option<f64>,
    pub icon_opacity_inside: Option<f64>,
    pub icon_size_inside: Option<f64>,
    pub hover_animation: Option<String>,
    pub show_names_inside: Option<bool>,
    pub icon_gap_ratio: Option<f64>,
    /// 保留当前版本未定义的样式属性，防止跨版本丢失
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
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
            list_height: None,
            grid_gap_x: None,
            grid_gap_y: None,
            icon_size: None,
            show_details: None,
            hide_app_names: None,
            cover_image: None,
            sort_by: None,
            sort_desc: None,
            feather_x: None,
            feather_y: None,
            icon_opacity_inside: None,
            icon_size_inside: None,
            hover_animation: None,
            show_names_inside: None,
            icon_gap_ratio: None,
            extra: HashMap::new(),
        }
    }
}

/// 容器结构体 — 使用 `extra` 字段保留未来版本可能添加的顶层属性
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
    /// 保留当前版本未定义的容器属性，防止跨版本丢失
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl Default for Container {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: "New Container".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 0.0, y: 0.0 },
            size: Size {
                width: 200.0,
                height: 300.0,
            },
            items: Vec::new(),
            style: Default::default(),
            folder_path: None,
            created_at: 0,
            updated_at: 0,
            extra: HashMap::new(),
        }
    }
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::backup::BackupSettings;

#[derive(Debug, Clone, PartialEq)]
pub enum Theme {
    Light,
    Dark,
    System,
    Other(String),
}

impl Serialize for Theme {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let s = match self {
            Theme::Light => "light",
            Theme::Dark => "dark",
            Theme::System => "system",
            Theme::Other(raw) => raw.as_str(),
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for Theme {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "light" => Theme::Light,
            "dark" => Theme::Dark,
            "system" => Theme::System,
            _ => Theme::Other(s),
        })
    }
}

impl Default for Theme {
    fn default() -> Self { Theme::System }
}

#[derive(Debug, Clone, PartialEq)]
pub enum IconSize {
    Small,
    Medium,
    Large,
    Other(String),
}

impl Serialize for IconSize {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let s = match self {
            IconSize::Small => "small",
            IconSize::Medium => "medium",
            IconSize::Large => "large",
            IconSize::Other(raw) => raw.as_str(),
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for IconSize {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "small" => IconSize::Small,
            "medium" => IconSize::Medium,
            "large" => IconSize::Large,
            _ => IconSize::Other(s),
        })
    }
}

impl Default for IconSize {
    fn default() -> Self { IconSize::Medium }
}

#[derive(Debug, Clone, PartialEq)]
pub enum ItemBackground {
    Transparent,
    Subtle,
    Visible,
    Other(String),
}

impl Serialize for ItemBackground {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let s = match self {
            ItemBackground::Transparent => "transparent",
            ItemBackground::Subtle => "subtle",
            ItemBackground::Visible => "visible",
            ItemBackground::Other(raw) => raw.as_str(),
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for ItemBackground {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "transparent" => ItemBackground::Transparent,
            "subtle" => ItemBackground::Subtle,
            "visible" => ItemBackground::Visible,
            _ => ItemBackground::Other(s),
        })
    }
}

impl Default for ItemBackground {
    fn default() -> Self { ItemBackground::Transparent }
}

#[derive(Debug, Clone, PartialEq)]
pub enum SelectedItemBackground {
    White,
    Black,
    Other(String),
}

impl Serialize for SelectedItemBackground {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let s = match self {
            SelectedItemBackground::White => "white",
            SelectedItemBackground::Black => "black",
            SelectedItemBackground::Other(raw) => raw.as_str(),
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for SelectedItemBackground {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "white" => SelectedItemBackground::White,
            "black" => SelectedItemBackground::Black,
            _ => SelectedItemBackground::Other(s),
        })
    }
}

impl Default for SelectedItemBackground {
    fn default() -> Self { SelectedItemBackground::White }
}

/// 全屏检测模式 — 控制性能模式何时激活
#[derive(Debug, Clone, PartialEq)]
pub enum FullscreenDetectionMode {
    FullscreenOnly,
    FullscreenAndMaximized,
    Other(String),
}

impl Serialize for FullscreenDetectionMode {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let s = match self {
            FullscreenDetectionMode::FullscreenOnly => "fullscreenOnly",
            FullscreenDetectionMode::FullscreenAndMaximized => "fullscreenAndMaximized",
            FullscreenDetectionMode::Other(raw) => raw.as_str(),
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for FullscreenDetectionMode {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "fullscreenOnly" => FullscreenDetectionMode::FullscreenOnly,
            "fullscreenAndMaximized" => FullscreenDetectionMode::FullscreenAndMaximized,
            _ => FullscreenDetectionMode::Other(s),
        })
    }
}

impl Default for FullscreenDetectionMode {
    fn default() -> Self { FullscreenDetectionMode::FullscreenAndMaximized }
}

/// 全局设置 — 使用 `extra` 字段（`#[serde(flatten)]`）保留当前版本不认识的设置属性，
/// 确保新版本写入的设置配置不会在老版本读写后丢失。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct Settings {
    pub theme: Theme,
    pub accent_color: String,
    pub grid_enabled: bool,
    #[serde(rename = "gridWidth")]
    pub grid_width: u32,
    #[serde(rename = "gridHeight")]
    pub grid_height: u32,
    #[serde(rename = "gridGapX")]
    pub grid_gap_x: u32,
    #[serde(rename = "gridGapY")]
    pub grid_gap_y: u32,
    pub icon_size: IconSize,
    pub corner_radius: f64,
    pub background_blur: bool,
    pub wallpaper_compatible: bool,
    pub item_background: ItemBackground,
    pub selected_item_background: SelectedItemBackground,
    pub selected_item_blur: bool,
    pub global_blur: bool,
    pub font_size: u32,
    pub hide_shortcut_badge: bool,
    pub hide_file_extensions: bool,
    pub icon_opacity: f64,
    pub text_opacity: f64,
    pub icon_glow: bool,
    pub icon_glow_radius: f64,
    pub icon_glow_intensity: f64,
    pub double_click_hide: bool,
    #[serde(default)]
    pub auto_start: bool,
    #[serde(default)]
    pub auto_start_high_priority: bool,
    #[serde(default)]
    pub parallax_enabled: bool,
    #[serde(default)]
    pub parallax_intensity: u32,
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub backup_settings: Option<BackupSettings>,
    /// 性能模式：全屏应用时自动暂停桌面特效
    #[serde(default)]
    pub performance_mode_enabled: bool,
    /// 全屏检测模式
    #[serde(default)]
    pub fullscreen_detection_mode: FullscreenDetectionMode,
    /// 保留当前版本未定义的设置属性，防止跨版本丢失
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            accent_color: "#0078d4".to_string(),
            grid_enabled: true,
            grid_width: 80,
            grid_height: 104,
            grid_gap_x: 20,
            grid_gap_y: 20,
            icon_size: IconSize::Medium,
            corner_radius: 10.0,
            background_blur: true,
            wallpaper_compatible: false,
            item_background: ItemBackground::Transparent,
            selected_item_background: SelectedItemBackground::White,
            selected_item_blur: false,
            global_blur: true,
            font_size: 12,
            hide_shortcut_badge: false,
            hide_file_extensions: true,
            icon_opacity: 1.0,
            text_opacity: 1.0,
            icon_glow: false,
            icon_glow_radius: 12.0,
            icon_glow_intensity: 0.6,
            double_click_hide: true,
            auto_start: false,
            auto_start_high_priority: false,
            parallax_enabled: false,
            parallax_intensity: 2,
            language: "zh".to_string(),
            backup_settings: None,
            performance_mode_enabled: true,
            fullscreen_detection_mode: FullscreenDetectionMode::FullscreenAndMaximized,
            extra: HashMap::new(),
        }
    }
}

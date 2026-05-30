use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IconSize {
    Small,
    Medium,
    Large,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ItemBackground {
    Transparent,
    Subtle,
    Visible,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SelectedItemBackground {
    White,
    Black,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    pub icon_opacity: f64,
    pub text_opacity: f64,
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
            icon_opacity: 1.0,
            text_opacity: 1.0,
        }
    }
}

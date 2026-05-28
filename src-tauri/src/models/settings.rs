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
pub struct Settings {
    pub theme: Theme,
    pub accent_color: String,
    pub grid_enabled: bool,
    pub grid_size: u32,
    pub icon_size: IconSize,
    pub corner_radius: f64,
    pub background_blur: bool,
    pub wallpaper_compatible: bool,
    pub item_background: ItemBackground,
    pub selected_item_background: SelectedItemBackground,
    pub selected_item_blur: bool,
    pub global_blur: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            accent_color: "#0078d4".to_string(),
            grid_enabled: true,
            grid_size: 80,
            icon_size: IconSize::Medium,
            corner_radius: 10.0,
            background_blur: true,
            wallpaper_compatible: true,
            item_background: ItemBackground::Transparent,
            selected_item_background: SelectedItemBackground::White,
            selected_item_blur: false,
            global_blur: true,
        }
    }
}

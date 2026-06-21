use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicStatus {
    pub is_playing: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_art_url: Option<String>, // base64 data URL or null
    pub position_ms: u64,
    pub duration_ms: u64,
}

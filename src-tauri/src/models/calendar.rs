use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub container_id: String,
    pub date: String,   // YYYY-MM-DD
    pub title: String,
    pub color: String,  // hex color
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

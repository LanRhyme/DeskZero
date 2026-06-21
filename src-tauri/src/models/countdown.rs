use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountdownEvent {
    pub id: String,
    pub name: String,
    pub target_date: String, // ISO date string YYYY-MM-DD
    pub mode: String,        // "countdown" or "anniversary"
    pub color: String,       // hex color for the event
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

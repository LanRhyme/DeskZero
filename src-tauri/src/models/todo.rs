use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub id: String,
    pub container_id: String,
    pub text: String,
    pub completed: bool,
    pub priority: String,          // "high", "medium", "low"
    pub due_date: Option<String>,  // ISO date string YYYY-MM-DD
    pub order_index: i32,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

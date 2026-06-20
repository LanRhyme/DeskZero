use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::container::Container;

/// 备份类型枚举 — 通过自定义序列化支持未知类型，
/// 避免新版本添加的类型在老版本中被强制回退导致数据损坏。
#[derive(Debug, Clone, PartialEq)]
pub enum BackupType {
    Manual,
    Auto,
    /// 保留未知类型的原始字符串，防止跨版本数据丢失
    Other(String),
}

impl Serialize for BackupType {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let s = match self {
            BackupType::Manual => "manual",
            BackupType::Auto => "auto",
            BackupType::Other(raw) => raw.as_str(),
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for BackupType {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "manual" => BackupType::Manual,
            "auto" => BackupType::Auto,
            _ => BackupType::Other(s),
        })
    }
}

/// 备份记录元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub id: String,
    pub name: String,
    pub remark: String,
    #[serde(rename = "type", alias = "backup_type")]
    pub backup_type: BackupType,
    #[serde(alias = "created_at")]
    pub created_at: u64,
    /// 保留当前版本未定义的属性，防止跨版本丢失
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// 备份快照 — 包含全部持久化数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSnapshot {
    pub version: String,
    pub settings: serde_json::Value,
    pub desktop_layout: serde_json::Value,
    pub containers: Vec<Container>,
    /// 保留当前版本未定义的属性，防止跨版本丢失
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// 备份相关设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct BackupSettings {
    pub auto_backup_enabled: bool,
    pub auto_backup_hours: u32,
    pub max_backups: u32,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl Default for BackupSettings {
    fn default() -> Self {
        Self {
            auto_backup_enabled: true,
            auto_backup_hours: 6,
            max_backups: 20,
            extra: HashMap::new(),
        }
    }
}

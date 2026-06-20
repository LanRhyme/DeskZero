# 桌面布局备份系统设计

## 概述

为 DeskZero 添加完整的备份系统，支持手动/自动备份全部数据（桌面布局、容器、设置），以及备份管理和还原。

## 数据模型

### 数据库表 `backups`

```sql
CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,           -- 'manual' | 'auto'
    created_at INTEGER NOT NULL,  -- 毫秒时间戳
    data TEXT NOT NULL            -- JSON 快照
)
```

### JSON 快照结构

```json
{
  "version": 1,
  "settings": { /* Settings 对象完整序列化 */ },
  "desktop_layout": {
    "item_id": { "x": 0.0, "y": 0.0 }
  },
  "containers": [
    {
      "id": "...",
      "name": "...",
      "container_type": "normal",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 200, "height": 300 },
      "style": { ... },
      "items": [ ... ],
      "folder_path": null,
      "created_at": 0,
      "updated_at": 0
    }
  ]
}
```

### 设置扩展

在 `Settings` 结构体新增字段（利用 `#[serde(flatten)] extra` 天然兼容老版本）：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `backup_enabled` | `bool` | `true` | 自动备份开关 |
| `backup_interval_hours` | `u32` | `6` | 自动备份间隔（小时） |
| `backup_max_count` | `u32` | `20` | 最大保留备份数 |

前端 TypeScript Settings 类型同步新增对应字段。

## 后端模块

### 文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `storage/backup_store.rs` | 备份 CRUD |
| 新增 | `commands/backup.rs` | Tauri 命令 |
| 新增 | `backup_timer.rs` | 后台定时器 |
| 修改 | `storage/db.rs` | 建 backups 表 |
| 修改 | `storage/mod.rs` | 导出 backup_store |
| 修改 | `commands/mod.rs` | 导出 backup |
| 修改 | `lib.rs` | 注册命令 + 启动定时器 |
| 新增 | `src/types/backup.ts` | 前端类型 |
| 新增 | `src/services/backupService.ts` | 前端服务 |
| 修改 | `src/components/Settings/SettingsPage.tsx` | 新增备份管理标签 |

### `storage/backup_store.rs`

```rust
use crate::models::{Container, Settings};
use std::collections::HashMap;
use super::db::get_connection;

/// 备份记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRecord {
    pub id: String,
    pub name: String,
    pub backup_type: String,  // "manual" | "auto"
    pub created_at: u64,
}

/// 备份快照数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSnapshot {
    pub version: u32,
    pub settings: Settings,
    pub desktop_layout: HashMap<String, crate::models::container::Position>,
    pub containers: Vec<Container>,
}

// 核心函数：
pub fn create_backup(name: &str, backup_type: &str) -> Result<BackupRecord, String>
pub fn list_backups() -> Result<Vec<BackupRecord>, String>
pub fn get_backup_data(id: &str) -> Result<BackupSnapshot, String>
pub fn restore_backup(id: &str) -> Result<(), String>
pub fn delete_backup(id: &str) -> Result<(), String>
pub fn purge_old_backups(max_count: u32) -> Result<(), String>
```

**备份流程** (`create_backup`)：
1. 获取 `BACKUP_LOCK`
2. 读取 settings + desktop_layout + containers
3. 构建 `BackupSnapshot`，序列化为 JSON
4. INSERT 到 backups 表
5. 调用 `purge_old_backups` 清理超限备份

**还原流程** (`restore_backup`)：
1. 获取 `BACKUP_LOCK`
2. 从 backups 表读取 JSON 快照
3. 开启数据库事务
4. 清空并重写 settings 表（`INSERT OR REPLACE`）
5. 清空并重写 desktop_layout 表（差异删除 + UPSERT）
6. 清空并重写 containers + container_items 表（差异删除 + UPSERT）
7. 提交事务
8. **处理新文件**：扫描当前桌面文件，对比还原后布局，将无位置信息的新文件自动排列到网格空白位置
9. 保存更新后的布局
10. 返回（前端收到后刷新）

### `commands/backup.rs`

```rust
static BACKUP_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub fn create_backup(name: Option<String>) -> Result<BackupRecord, String>

#[tauri::command]
pub fn list_backups() -> Result<Vec<BackupRecord>, String>

#[tauri::command]
pub fn restore_backup(id: String) -> Result<(), String>

#[tauri::command]
pub fn delete_backup(id: String) -> Result<(), String>

#[tauri::command]
pub fn get_backup_settings() -> Result<BackupSettings, String>

#[tauri::command]
pub fn save_backup_settings(
    enabled: Option<bool>,
    interval_hours: Option<u32>,
    max_count: Option<u32>,
) -> Result<(), String>
```

### `backup_timer.rs`

```rust
use tokio::time::{self, Duration};
use tauri::Manager;

pub fn start_backup_timer(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(3600)); // 每小时检查
        loop {
            interval.tick().await;
            // 读取设置，检查 backup_enabled 和距离上次备份是否超过 interval_hours
            // 超过则执行 create_backup("自动备份", "auto")
        }
    });
}
```

### `lib.rs` 修改

在 `setup` 末尾添加：
```rust
crate::backup_timer::start_backup_timer(app.handle().clone());
```

在 `invoke_handler` 注册新命令：
```rust
commands::backup::create_backup,
commands::backup::list_backups,
commands::backup::restore_backup,
commands::backup::delete_backup,
commands::backup::get_backup_settings,
commands::backup::save_backup_settings,
```

## 前端

### `src/types/backup.ts`

```typescript
export interface BackupRecord {
  id: string;
  name: string;
  backupType: "manual" | "auto";
  createdAt: number;
}

export interface BackupSettings {
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupMaxCount: number;
}
```

### `src/services/backupService.ts`

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { BackupRecord, BackupSettings } from "@/types/backup";

export const createBackup = (name?: string) =>
  invoke<BackupRecord>("create_backup", { name });

export const listBackups = () =>
  invoke<BackupRecord[]>("list_backups");

export const restoreBackup = (id: string) =>
  invoke<void>("restore_backup", { id });

export const deleteBackup = (id: string) =>
  invoke<void>("delete_backup", { id });

export const getBackupSettings = () =>
  invoke<BackupSettings>("get_backup_settings");

export const saveBackupSettings = (settings: Partial<BackupSettings>) =>
  invoke<void>("save_backup_settings", settings);
```

### 设置页"备份管理"标签

新增第四个 Tab `backup`，图标 `Archive`：

**布局结构**：
1. **自动备份设置区**
   - 自动备份开关（SwitchToggle）
   - 备份间隔（Slider，1-24 小时）
   - 最大保留数（Slider，5-100）

2. **手动备份区**
   - "立即备份"按钮
   - 可选输入备注名称

3. **备份列表**
   - 每行显示：备份名称、类型标签（手动/自动）、创建时间、操作按钮（还原/删除）
   - 还原前弹出确认对话框

## 还原时新文件处理

还原备份后，桌面上可能存在备份中没有的新文件。处理流程：

1. 调用 `scan_desktop_icons()` 获取当前所有桌面文件
2. 从还原后的 `desktop_layout` 中过滤出已有位置的文件
3. 找出没有位置信息的新文件
4. 自动排列算法：
   - 根据当前 grid 设置（grid_width, grid_height, grid_gap_x, grid_gap_y）计算网格
   - 从左上角 (0,0) 开始逐行扫描
   - 找到第一个不与任何现有图标重叠的网格位置
   - 将新文件放置到该位置
5. 保存更新后的布局到数据库
6. 发送 `sync-desktop-layout` 事件刷新前端

## 错误处理

- 数据库操作失败返回 `Result::Err(String)`，前端通过 toast 提示
- 备份还原失败不会损坏当前数据（事务保证原子性）
- 定时器异常不影响主程序运行（`spawn` 隔离）

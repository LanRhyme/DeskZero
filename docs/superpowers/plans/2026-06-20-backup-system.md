# 桌面布局备份系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 DeskZero 实现完整的备份系统，支持手动/自动备份全部数据（桌面布局、容器、设置），以及备份管理和还原。

**Architecture:** 快照式备份——每次备份将 settings + desktop_layout + containers 序列化为 JSON 存入 SQLite backups 表。后端通过 `backup_store` 模块做 CRUD，`commands/backup` 暴露 Tauri 命令，`backup_timer` 负责定时自动备份。前端在设置页新增"备份管理"标签。

**Tech Stack:** Rust (rusqlite, serde_json, tokio), TypeScript (React, Zustand, Tauri invoke)

## Global Constraints

- 遵循项目中文注释风格
- Rust 枚举必须包含 `Other(String)` 变体
- JSON 序列化结构体必须包含 `#[serde(flatten)] extra: HashMap<String, serde_json::Value>`
- 数据库操作禁止全量 DELETE + INSERT，使用差异删除 + UPSERT
- 并发操作必须加互斥锁
- 前端高频操作必须防抖

---

### Task 1: 数据库建表 — backups 表

**Files:**
- Modify: `src-tauri/src/storage/db.rs:25-85` — 在 `init_db()` 末尾添加建表语句

**Interfaces:**
- Produces: `backups` 表结构供后续 task 使用

- [ ] **Step 1: 在 `init_db()` 中添加 backups 建表语句**

打开 `src-tauri/src/storage/db.rs`，在 `container_items` 建表之后、`Ok(())` 之前添加：

```rust
    // Backups table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS backups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            data TEXT NOT NULL
        )",
        [],
    )?;
```

- [ ] **Step 2: 验证编译通过**

```bash
cd src-tauri && cargo check
```

Expected: 编译成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/storage/db.rs
git commit -m "feat(storage): 添加 backups 备份表建表语句"
```

---

### Task 2: 备份模型定义

**Files:**
- Create: `src-tauri/src/models/backup.rs` — BackupRecord 和 BackupSnapshot 模型
- Modify: `src-tauri/src/models/mod.rs` — 导出 backup 模块

**Interfaces:**
- Produces: `BackupRecord`, `BackupSnapshot` 供 backup_store 和 commands 使用

- [ ] **Step 1: 创建 `src-tauri/src/models/backup.rs`**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::container::{Container, Position};
use super::settings::Settings;

/// 备份记录元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub id: String,
    pub name: String,
    #[serde(rename = "type", alias = "backup_type")]
    pub backup_type: String,
    #[serde(alias = "created_at")]
    pub created_at: u64,
}

/// 备份快照 — 包含全部持久化数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSnapshot {
    pub version: u32,
    pub settings: Settings,
    pub desktop_layout: HashMap<String, Position>,
    pub containers: Vec<Container>,
}

/// 备份相关设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct BackupSettings {
    pub backup_enabled: bool,
    pub backup_interval_hours: u32,
    pub backup_max_count: u32,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl Default for BackupSettings {
    fn default() -> Self {
        Self {
            backup_enabled: true,
            backup_interval_hours: 6,
            backup_max_count: 20,
            extra: HashMap::new(),
        }
    }
}
```

- [ ] **Step 2: 修改 `src-tauri/src/models/mod.rs` 添加导出**

在 `mod.rs` 中添加：

```rust
pub mod backup;
```

并确认已有的 `pub use` 或直接使用路径引用。当前 `mod.rs` 内容需要检查后补充导出。

- [ ] **Step 3: 验证编译通过**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/models/backup.rs src-tauri/src/models/mod.rs
git commit -m "feat(models): 添加备份系统数据模型"
```

---

### Task 3: 备份存储层 — backup_store

**Files:**
- Create: `src-tauri/src/storage/backup_store.rs` — 备份 CRUD 操作
- Modify: `src-tauri/src/storage/mod.rs` — 导出 backup_store

**Interfaces:**
- Consumes: `BackupRecord`, `BackupSnapshot`, `BackupSettings` from models/backup
- Consumes: `load_settings`, `save_settings` from storage/settings_store
- Consumes: `load_layout`, `save_layout` from storage/desktop_store
- Consumes: `load_containers`, `save_containers` from storage/container_store
- Produces: `create_backup`, `list_backups`, `get_backup_data`, `restore_backup`, `delete_backup`, `purge_old_backups`, `load_backup_settings`, `save_backup_settings`

- [ ] **Step 1: 创建 `src-tauri/src/storage/backup_store.rs`**

```rust
use crate::models::backup::{BackupRecord, BackupSettings, BackupSnapshot};
use crate::models::container::Position;
use std::collections::HashMap;
use super::db::get_connection;

/// 创建备份
pub fn create_backup(name: &str, backup_type: &str) -> Result<BackupRecord, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    // 读取当前全部数据
    let settings = super::settings_store::load_settings()?;
    let desktop_layout = super::desktop_store::load_layout()?;
    let containers = super::container_store::load_containers()?;

    let snapshot = BackupSnapshot {
        version: 1,
        settings,
        desktop_layout,
        containers,
    };

    let data = serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis() as u64;

    conn.execute(
        "INSERT INTO backups (id, name, type, created_at, data) VALUES (?1, ?2, ?3, ?4, ?5)",
        (&id, name, backup_type, now as i64, &data),
    ).map_err(|e| e.to_string())?;

    // 清理超限备份
    let max_count = load_backup_max_count();
    let _ = purge_old_backups(max_count);

    Ok(BackupRecord {
        id,
        name: name.to_string(),
        backup_type: backup_type.to_string(),
        created_at: now,
    })
}

/// 列出所有备份（按时间倒序）
pub fn list_backups() -> Result<Vec<BackupRecord>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, name, type, created_at FROM backups ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(BackupRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            backup_type: row.get(2)?,
            created_at: row.get::<_, i64>(3)? as u64,
        })
    }).map_err(|e| e.to_string())?;

    let mut backups = Vec::new();
    for row in rows {
        if let Ok(b) = row {
            backups.push(b);
        }
    }

    Ok(backups)
}

/// 获取备份快照数据
pub fn get_backup_data(id: &str) -> Result<BackupSnapshot, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT data FROM backups WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([id]).map_err(|e| e.to_string())?;

    let data = if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        row.get::<_, String>(0).map_err(|e| e.to_string())?
    } else {
        return Err("备份不存在".to_string());
    };

    serde_json::from_str(&data).map_err(|e| format!("备份数据解析失败: {}", e))
}

/// 还原备份 — 全量覆盖当前数据
pub fn restore_backup(id: &str) -> Result<(), String> {
    let snapshot = get_backup_data(id)?;

    // 1. 保存设置
    super::settings_store::save_settings(&snapshot.settings)?;

    // 2. 保存桌面布局
    super::desktop_store::save_layout(&snapshot.desktop_layout)?;

    // 3. 保存容器（需要先清空再写入，因为是全量还原）
    // 使用差异策略：删除不在快照中的容器，然后 UPSERT 快照中的容器
    let existing = super::container_store::load_containers().unwrap_or_default();
    let snapshot_ids: Vec<&str> = snapshot.containers.iter().map(|c| c.id.as_str()).collect();

    for existing_container in &existing {
        if !snapshot_ids.contains(&existing_container.id.as_str()) {
            let _ = super::container_store::delete_container_by_id(&existing_container.id);
        }
    }

    super::container_store::save_containers(&snapshot.containers)?;

    Ok(())
}

/// 删除单个备份
pub fn delete_backup(id: &str) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let affected = conn.execute("DELETE FROM backups WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("备份不存在".to_string());
    }

    Ok(())
}

/// 清理超限备份，保留最新的 max_count 个
pub fn purge_old_backups(max_count: u32) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM backups WHERE id NOT IN (
            SELECT id FROM backups ORDER BY created_at DESC LIMIT ?1
        )",
        [max_count],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// 从设置中读取最大备份数
fn load_backup_max_count() -> u32 {
    let settings = super::settings_store::load_settings().unwrap_or_default();
    // 从 extra 中读取，不存在则使用默认值 20
    settings.extra.get("backupMaxCount")
        .and_then(|v| v.as_u64())
        .unwrap_or(20) as u32
}

/// 读取备份设置
pub fn load_backup_settings() -> BackupSettings {
    let settings = super::settings_store::load_settings().unwrap_or_default();

    BackupSettings {
        backup_enabled: settings.extra.get("backupEnabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        backup_interval_hours: settings.extra.get("backupIntervalHours")
            .and_then(|v| v.as_u64())
            .unwrap_or(6) as u32,
        backup_max_count: settings.extra.get("backupMaxCount")
            .and_then(|v| v.as_u64())
            .unwrap_or(20) as u32,
        extra: HashMap::new(),
    }
}

/// 保存备份设置 — 更新 Settings 的 extra 字段
pub fn save_backup_settings(
    enabled: Option<bool>,
    interval_hours: Option<u32>,
    max_count: Option<u32>,
) -> Result<(), String> {
    let mut settings = super::settings_store::load_settings()?;

    if let Some(v) = enabled {
        settings.extra.insert("backupEnabled".to_string(), serde_json::Value::Bool(v));
    }
    if let Some(v) = interval_hours {
        settings.extra.insert("backupIntervalHours".to_string(), serde_json::json!(v));
    }
    if let Some(v) = max_count {
        settings.extra.insert("backupMaxCount".to_string(), serde_json::json!(v));
    }

    super::settings_store::save_settings(&settings)
}

/// 获取最后一次自动备份的时间戳
pub fn get_last_auto_backup_time() -> Option<u64> {
    let conn = get_connection().ok()?;

    let mut stmt = conn.prepare(
        "SELECT created_at FROM backups WHERE type = 'auto' ORDER BY created_at DESC LIMIT 1"
    ).ok()?;
    let mut rows = stmt.query([]).ok()?;

    if let Some(row) = rows.next().ok()? {
        Some(row.get::<_, i64>(0).ok()? as u64)
    } else {
        None
    }
}
```

- [ ] **Step 2: 修改 `src-tauri/src/storage/mod.rs` 添加导出**

```rust
pub mod backup_store;
```

- [ ] **Step 3: 验证编译通过**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/storage/backup_store.rs src-tauri/src/storage/mod.rs
git commit -m "feat(storage): 实现备份存储层 CRUD 操作"
```

---

### Task 4: Tauri 命令层 — commands/backup

**Files:**
- Create: `src-tauri/src/commands/backup.rs` — Tauri invoke 命令
- Modify: `src-tauri/src/commands/mod.rs` — 导出 backup 模块

**Interfaces:**
- Consumes: `backup_store` 全部函数
- Produces: Tauri commands 供前端 invoke 调用

- [ ] **Step 1: 创建 `src-tauri/src/commands/backup.rs`**

```rust
use crate::models::backup::{BackupRecord, BackupSettings};
use crate::storage::backup_store;
use std::sync::Mutex;

static BACKUP_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub fn create_backup(name: Option<String>) -> Result<BackupRecord, String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    let backup_name = name.unwrap_or_else(|| {
        let now = chrono::Local::now();
        now.format("备份 %Y-%m-%d %H:%M").to_string()
    });
    backup_store::create_backup(&backup_name, "manual")
}

#[tauri::command]
pub fn list_backups() -> Result<Vec<BackupRecord>, String> {
    backup_store::list_backups()
}

#[tauri::command]
pub fn restore_backup(id: String) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    backup_store::restore_backup(&id)
}

#[tauri::command]
pub fn delete_backup(id: String) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    backup_store::delete_backup(&id)
}

#[tauri::command]
pub fn get_backup_settings() -> BackupSettings {
    backup_store::load_backup_settings()
}

#[tauri::command]
pub fn save_backup_settings(
    enabled: Option<bool>,
    interval_hours: Option<u32>,
    max_count: Option<u32>,
) -> Result<(), String> {
    backup_store::save_backup_settings(enabled, interval_hours, max_count)
}
```

- [ ] **Step 2: 修改 `src-tauri/src/commands/mod.rs` 添加导出**

```rust
pub mod backup;
```

- [ ] **Step 3: 验证编译通过**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/backup.rs src-tauri/src/commands/mod.rs
git commit -m "feat(commands): 实现备份系统 Tauri 命令"
```

---

### Task 5: 注册命令到 lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs:369-410` — 注册新命令到 invoke_handler

**Interfaces:**
- Consumes: `commands::backup::*` 命令

- [ ] **Step 1: 在 `invoke_handler` 中注册备份命令**

在 `lib.rs` 的 `tauri::generate_handler!` 宏中添加以下命令（放在已有命令之后）：

```rust
            commands::backup::create_backup,
            commands::backup::list_backups,
            commands::backup::restore_backup,
            commands::backup::delete_backup,
            commands::backup::get_backup_settings,
            commands::backup::save_backup_settings,
```

- [ ] **Step 2: 验证编译通过**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(lib): 注册备份系统命令到 invoke_handler"
```

---

### Task 6: 后台定时器 — backup_timer

**Files:**
- Create: `src-tauri/src/backup_timer.rs` — 定时备份逻辑
- Modify: `src-tauri/src/lib.rs` — 在 setup 中启动定时器

**Interfaces:**
- Consumes: `backup_store::create_backup`, `backup_store::load_backup_settings`, `backup_store::get_last_auto_backup_time`
- Produces: `start_backup_timer(app_handle)` 在 lib.rs setup 中调用

- [ ] **Step 1: 创建 `src-tauri/src/backup_timer.rs`**

```rust
use tokio::time::{self, Duration};

/// 启动后台自动备份定时器
/// 每小时检查一次，如果满足条件则执行自动备份
pub fn start_backup_timer(_app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        // 启动后等待 60 秒再执行第一次检查，避免影响启动速度
        time::sleep(Duration::from_secs(60)).await;

        loop {
            // 检查是否需要备份
            if let Err(e) = check_and_backup() {
                eprintln!("[DeskZero] 自动备份检查失败: {}", e);
            }

            // 每小时检查一次
            time::sleep(Duration::from_secs(3600)).await;
        }
    });
}

fn check_and_backup() -> Result<(), String> {
    let settings = crate::storage::backup_store::load_backup_settings();

    if !settings.backup_enabled {
        return Ok(());
    }

    let interval_ms = settings.backup_interval_hours as u64 * 3600 * 1000;
    let now = chrono::Utc::now().timestamp_millis() as u64;

    let should_backup = match crate::storage::backup_store::get_last_auto_backup_time() {
        Some(last_time) => now - last_time >= interval_ms,
        None => true, // 从未自动备份过
    };

    if should_backup {
        eprintln!("[DeskZero] 执行自动备份...");
        let name = {
            let local_now = chrono::Local::now();
            local_now.format("自动备份 %Y-%m-%d %H:%M").to_string()
        };
        crate::storage::backup_store::create_backup(&name, "auto")?;
        eprintln!("[DeskZero] 自动备份完成");
    }

    Ok(())
}
```

- [ ] **Step 2: 在 `lib.rs` 中添加模块声明**

在 `lib.rs` 顶部模块声明区域添加：

```rust
mod backup_timer;
```

- [ ] **Step 3: 在 `setup` 末尾启动定时器**

在 `setup` 闭包的 `Ok(())` 之前、桌面嵌入线程之后添加：

```rust
            // 启动自动备份定时器
            crate::backup_timer::start_backup_timer(app.handle().clone());
```

- [ ] **Step 4: 验证编译通过**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/backup_timer.rs src-tauri/src/lib.rs
git commit -m "feat(backup): 实现后台自动备份定时器"
```

---

### Task 7: 前端类型和服务

**Files:**
- Create: `src/types/backup.ts` — TypeScript 类型定义
- Create: `src/services/backupService.ts` — 前端调用服务

**Interfaces:**
- Produces: `BackupRecord`, `BackupSettings` 类型和 `backupService` 函数供 UI 使用

- [ ] **Step 1: 创建 `src/types/backup.ts`**

```typescript
export interface BackupRecord {
  id: string;
  name: string;
  type: "manual" | "auto";
  createdAt: number;
}

export interface BackupSettings {
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupMaxCount: number;
}
```

- [ ] **Step 2: 创建 `src/services/backupService.ts`**

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { BackupRecord, BackupSettings } from "@/types/backup";

export const createBackup = (name?: string): Promise<BackupRecord> =>
  invoke("create_backup", { name });

export const listBackups = (): Promise<BackupRecord[]> =>
  invoke("list_backups");

export const restoreBackup = (id: string): Promise<void> =>
  invoke("restore_backup", { id });

export const deleteBackup = (id: string): Promise<void> =>
  invoke("delete_backup", { id });

export const getBackupSettings = (): Promise<BackupSettings> =>
  invoke("get_backup_settings");

export const saveBackupSettings = (
  settings: Partial<BackupSettings>
): Promise<void> =>
  invoke("save_backup_settings", {
    enabled: settings.backupEnabled,
    intervalHours: settings.backupIntervalHours,
    maxCount: settings.backupMaxCount,
  });
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/types/backup.ts src/services/backupService.ts
git commit -m "feat(frontend): 添加备份系统类型定义和服务层"
```

---

### Task 8: 设置页新增备份管理标签

**Files:**
- Modify: `src/components/Settings/SettingsPage.tsx` — 新增第四个 Tab

**Interfaces:**
- Consumes: `backupService` 全部函数, `BackupRecord`, `BackupSettings` 类型
- Consumes: `useSettingsStore`, `useToastStore` 现有 stores

- [ ] **Step 1: 添加导入**

在 `SettingsPage.tsx` 顶部添加导入：

```typescript
import { Archive, RotateCcw, Trash2, Plus } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type { BackupRecord, BackupSettings } from "@/types/backup";
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  getBackupSettings,
  saveBackupSettings,
} from "@/services/backupService";
import { ConfirmDialog } from "@/components/UI/ConfirmDialog";
```

- [ ] **Step 2: 在 tabs 数组中添加备份管理标签**

将 `tabs` 数组从 3 项改为 4 项：

```typescript
  const tabs = [
    { id: "general", name: "通用设置", icon: Settings },
    { id: "appearance", name: "外观个性化", icon: Palette },
    { id: "backup", name: "备份管理", icon: Archive },
    { id: "about", name: "关于 DeskZero", icon: Info },
  ];
```

- [ ] **Step 3: 添加备份管理状态和逻辑**

在 `SettingsPage` 组件函数内部、`scrollContainerRef` 之前添加：

```typescript
  // 备份管理状态
  const [backupList, setBackupList] = useState<BackupRecord[]>([]);
  const [backupSettings, setBackupSettingsState] = useState<BackupSettings>({
    backupEnabled: true,
    backupIntervalHours: 6,
    backupMaxCount: 20,
  });
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupNote, setBackupNote] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const loadBackupData = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([
        listBackups(),
        getBackupSettings(),
      ]);
      setBackupList(list);
      setBackupSettingsState(settings);
    } catch (err) {
      console.error("加载备份数据失败:", err);
    }
  }, []);

  useEffect(() => {
    loadBackupData();
  }, [loadBackupData]);

  const handleCreateBackup = async () => {
    try {
      setBackupLoading(true);
      const name = backupNote.trim() || undefined;
      await createBackup(name);
      setBackupNote("");
      await loadBackupData();
      useToastStore.getState().addToast("备份创建成功", "success");
    } catch (err: any) {
      useToastStore.getState().addToast("备份失败: " + err.toString(), "error");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = (backup: BackupRecord) => {
    setConfirmDialog({
      open: true,
      title: "还原备份",
      message: `确定要还原"${backup.name}"吗？当前的桌面布局、容器和设置将被覆盖。`,
      onConfirm: async () => {
        try {
          setBackupLoading(true);
          await restoreBackup(backup.id);
          await useSettingsStore.getState().loadSettings();
          useToastStore.getState().addToast("备份还原成功", "success");
        } catch (err: any) {
          useToastStore.getState().addToast("还原失败: " + err.toString(), "error");
        } finally {
          setBackupLoading(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleDeleteBackup = (backup: BackupRecord) => {
    setConfirmDialog({
      open: true,
      title: "删除备份",
      message: `确定要删除"${backup.name}"吗？此操作不可撤销。`,
      onConfirm: async () => {
        try {
          await deleteBackup(backup.id);
          await loadBackupData();
          useToastStore.getState().addToast("备份已删除", "success");
        } catch (err: any) {
          useToastStore.getState().addToast("删除失败: " + err.toString(), "error");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleSaveBackupSettings = async (changes: Partial<BackupSettings>) => {
    const newSettings = { ...backupSettings, ...changes };
    setBackupSettingsState(newSettings);
    try {
      await saveBackupSettings(changes);
    } catch (err: any) {
      useToastStore.getState().addToast("保存设置失败: " + err.toString(), "error");
    }
  };

  const formatBackupTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
```

- [ ] **Step 4: 添加备份管理 Tab Panel**

在"关于" Tab Panel（`<Tab.Panel className="p-10 max-w-4xl mx-auto min-h-full">` 第三个）之前，添加备份管理 Panel：

```tsx
						{/* Backup Settings */}
						<Tab.Panel className="p-10 max-w-4xl mx-auto min-h-full">
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
							>
								<h2 className="text-3xl font-extrabold mb-8 text-[var(--color-text)] tracking-tight">
									备份管理
								</h2>

								<div className="space-y-6">
									{/* 自动备份设置 */}
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
										<SettingRow
											title="自动备份"
											desc="定时自动备份桌面布局、容器和设置"
										>
											<CustomSwitch
												checked={backupSettings.backupEnabled}
												onChange={() =>
													handleSaveBackupSettings({
														backupEnabled: !backupSettings.backupEnabled,
													})
												}
											/>
										</SettingRow>

										{backupSettings.backupEnabled && (
											<>
												<SettingSliderRow
													title="备份间隔"
													desc="每隔多少小时自动备份一次"
													value={backupSettings.backupIntervalHours}
													onChange={(v: number) =>
														handleSaveBackupSettings({ backupIntervalHours: v })
													}
													min={1}
													max={24}
													step={1}
													format={(v: number) => `${v} 小时`}
												/>
												<SettingSliderRow
													title="最大保留数"
													desc="超出数量时自动删除最旧的备份"
													value={backupSettings.backupMaxCount}
													onChange={(v: number) =>
														handleSaveBackupSettings({ backupMaxCount: v })
													}
													min={5}
													max={100}
													step={5}
													format={(v: number) => `${v} 个`}
													noBorder
												/>
											</>
										)}
									</div>

									{/* 手动备份 */}
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-4 shadow-sm backdrop-blur-xl">
										<div className="flex items-center gap-3 mb-3">
											<input
												type="text"
												value={backupNote}
												onChange={(e) => setBackupNote(e.target.value)}
												placeholder="备份备注（可选）"
												className="flex-1 px-3 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]/50 outline-none border border-transparent focus:border-[var(--color-accent)]/30 transition-colors"
											/>
											<button
												onClick={handleCreateBackup}
												disabled={backupLoading}
												className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
											>
												<Plus size={14} />
												立即备份
											</button>
										</div>
									</div>

									{/* 备份列表 */}
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm backdrop-blur-xl overflow-hidden">
										<div className="px-6 py-3 border-b border-black/5 dark:border-white/5">
											<div className="text-sm font-medium text-[var(--color-text)]">
												备份历史
												<span className="ml-2 text-xs text-[var(--color-text-secondary)]">
													共 {backupList.length} 个备份
												</span>
											</div>
										</div>

										{backupList.length === 0 ? (
											<div className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]/60">
												暂无备份记录
											</div>
										) : (
											<div className="max-h-[400px] overflow-y-auto hidden-native-scrollbar">
												{backupList.map((backup) => (
													<div
														key={backup.id}
														className="flex items-center justify-between px-6 py-3 border-b border-black/5 dark:border-white/5 last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group"
													>
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2">
																<span className="text-sm font-medium text-[var(--color-text)] truncate">
																	{backup.name}
																</span>
																<span
																	className={cn(
																		"text-[10px] px-1.5 py-0.5 rounded-full font-medium",
																		backup.type === "manual"
																			? "bg-blue-500/10 text-blue-500"
																			: "bg-green-500/10 text-green-500"
																	)}
																>
																	{backup.type === "manual" ? "手动" : "自动"}
																</span>
															</div>
															<div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
																{formatBackupTime(backup.createdAt)}
															</div>
														</div>
														<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
															<button
																onClick={() => handleRestoreBackup(backup)}
																className="p-1.5 rounded-lg hover:bg-[var(--color-accent)]/10 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
																title="还原"
															>
																<RotateCcw size={14} />
															</button>
															<button
																onClick={() => handleDeleteBackup(backup)}
																className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
																title="删除"
															>
																<Trash2 size={14} />
															</button>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							</motion.div>
						</Tab.Panel>
```

- [ ] **Step 5: 添加 ConfirmDialog 渲染**

在组件 JSX 的末尾（`</div>` 关闭主 div 之前），添加确认对话框：

```tsx
			<ConfirmDialog
				isOpen={confirmDialog.open}
				title={confirmDialog.title}
				message={confirmDialog.message}
				onConfirm={confirmDialog.onConfirm}
				onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
			/>
```

- [ ] **Step 6: 验证 TypeScript 编译**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/components/Settings/SettingsPage.tsx
git commit -m "feat(settings): 添加备份管理标签页"
```

---

### Task 9: 还原时新文件自动排列

**Files:**
- Modify: `src-tauri/src/storage/backup_store.rs` — 在 `restore_backup` 中添加新文件排列逻辑

**Interfaces:**
- Consumes: `icon_scanner::scan_desktop_icons`, 当前 grid 设置

- [ ] **Step 1: 在 `restore_backup` 函数末尾添加新文件处理逻辑**

修改 `backup_store.rs` 的 `restore_backup` 函数，在 `save_containers` 之后添加：

```rust
    // 4. 处理还原后的新文件：扫描当前桌面，将无位置信息的文件自动排列
    if let Ok(current_items) = crate::desktop::icon_scanner::scan_desktop_icons() {
        let mut layout = super::desktop_store::load_layout().unwrap_or_default();
        let settings = super::settings_store::load_settings().unwrap_or_default();

        let step_x = (settings.grid_width + settings.grid_gap_x) as f64;
        let step_y = (settings.grid_height + settings.grid_gap_y) as f64;

        // 收集已占用的位置
        let mut occupied: std::collections::HashSet<(i32, i32)> = std::collections::HashSet::new();
        for pos in layout.values() {
            let col = (pos.x / step_x).round() as i32;
            let row = (pos.y / step_y).round() as i32;
            occupied.insert((col, row));
        }

        // 找出没有位置的新文件并自动排列
        let mut changed = false;
        for item in &current_items {
            if layout.contains_key(&item.id) {
                continue;
            }

            // 从左上角开始找第一个空位
            let mut placed = false;
            for row in 0..100 {
                for col in 0..50 {
                    if !occupied.contains(&(col, row)) {
                        layout.insert(item.id.clone(), Position {
                            x: col as f64 * step_x,
                            y: row as f64 * step_y,
                        });
                        occupied.insert((col, row));
                        placed = true;
                        changed = true;
                        break;
                    }
                }
                if placed {
                    break;
                }
            }
        }

        if changed {
            super::desktop_store::save_layout(&layout)?;
        }
    }
```

- [ ] **Step 2: 验证编译通过**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/storage/backup_store.rs
git commit -m "feat(backup): 还原时自动排列新文件到空白位置"
```

---

### Task 10: 端到端验证

- [ ] **Step 1: 编译 Rust 后端**

```bash
cd src-tauri && cargo build
```

- [ ] **Step 2: 编译前端**

```bash
npx tsc -b --noEmit && npm run build
```

- [ ] **Step 3: 启动应用验证**

```bash
npm run tauri dev
```

手动测试：
1. 打开设置页，确认"备份管理"标签存在
2. 点击"立即备份"，确认备份出现在列表中
3. 刷新页面，确认备份持久化
4. 测试还原功能
5. 测试删除功能
6. 测试自动备份设置保存

- [ ] **Step 4: Final Commit**

```bash
git add -A
git commit -m "feat: 完成桌面布局备份系统"
```

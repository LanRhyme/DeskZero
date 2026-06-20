# 备份恢复系统代码审查与优化实现计划

**Goal:** 修复备份系统中后台自动定时备份任务没有互斥锁保护的问题，并将 Item 结构体加上 extra 字段以完全符合代码健壮性规范。

**Architecture:** 将 `BACKUP_LOCK` 移入 `backup_store` 并采用公开方法加锁，内部 `_internal` 方法去锁调用的方式重构以避免死锁。同时为 `Item` 引入 `extra` 字段以提供完美的跨版本向前向后兼容性。

**Tech Stack:** Rust, Tauri, SQLite (rusqlite), Serde

---

## Proposed Changes

### 1. Item 结构体兼容性优化

#### [MODIFY] `src-tauri/src/models/item.rs`
- 在 `Item` 结构体中添加 `extra` 属性，并在 `Default` 实现中初始化它。

### 2. 备份存储层互斥锁重构 (解决定时任务未加锁的竞态)

#### [MODIFY] `src-tauri/src/storage/backup_store.rs`
- 在文件头部引入 `std::sync::Mutex` 并定义 `static BACKUP_LOCK: Mutex<()>`。
- 将已有的公开函数逻辑抽离出内部私有函数（如 `create_backup` -> `create_backup_internal`）。
- 内部相互调用改用 `_internal` 内部方法（例如 `create_backup_internal` 内部调用 `purge_old_backups_internal`，`restore_backup_internal` 内部调用 `get_backup_data_internal`），避免互斥锁重入死锁。
- 在所有对外导出的公开方法中，包裹 `let _lock = BACKUP_LOCK.lock().map_err(...)` 从而在底层实现完全的线程安全。

### 3. Tauri 命令层去锁

#### [MODIFY] `src-tauri/src/commands/backup.rs`
- 移除本地的 `BACKUP_LOCK`。
- 去除各个 Tauri command 内的手动锁获取，因为底层 `backup_store` 公开方法已经加锁。

---

## Detailed Task Breakdown

### Task 1: 优化 Item 数据模型

**Files:**
- Modify: `src-tauri/src/models/item.rs`

- [ ] **Step 1: 修改 `item.rs` 为 `Item` 结构体添加 `extra` 字段并引入必要依赖**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap; // 确保导入 HashMap
```

并在 `Item` 结构体尾部添加：
```rust
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
```

在 `impl Default for Item` 中初始化：
```rust
impl Default for Item {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            path: String::new(),
            icon_path: String::new(),
            item_type: ItemType::File,
            target_path: None,
            is_in_container: false,
            container_id: None,
            position: None,
            size: None,
            modified_at: None,
            extra: HashMap::new(), // 初始化 extra 字段
        }
    }
}
```

- [ ] **Step 2: 运行编译检查，确保模型修改后项目能正常通过编译**

在 `src-tauri` 目录下运行：
```powershell
cargo check
```
Expected: 编译通过且无 Error。

- [ ] **Step 3: 提交代码**

```bash
git add src-tauri/src/models/item.rs
git commit -m "refactor(models): 给 Item 结构体添加 extra 字段以完全符合健壮性规范"
```

---

### Task 2: 重构备份存储层，移入互斥锁并防范死锁

**Files:**
- Modify: `src-tauri/src/storage/backup_store.rs`

- [ ] **Step 1: 声明 `BACKUP_LOCK` 静态锁，并重构所有存储操作为 `_internal` 内部函数**

在 `backup_store.rs` 头部导入并声明：
```rust
use std::sync::Mutex;
static BACKUP_LOCK: Mutex<()> = Mutex::new(());
```

将所有会操作 backups 相关数据库的函数提取为对应的 `*_internal` 函数。
注意：
1. `create_backup` 的内部实现提取为 `create_backup_internal`，并在里面把对 `purge_old_backups` 的调用改为对 `purge_old_backups_internal` 的调用。
2. `restore_backup` 的内部实现提取为 `restore_backup_internal`，并在里面把对 `get_backup_data` 的调用改为对 `get_backup_data_internal` 的调用。
3. 其他函数同理（`list_backups` -> `list_backups_internal`，`get_backup_data` -> `get_backup_data_internal`，`delete_backup` -> `delete_backup_internal` Gord，`purge_old_backups` -> `purge_old_backups_internal`，`save_backup_settings` -> `save_backup_settings_internal`，`get_last_auto_backup_time` -> `get_last_auto_backup_time_internal`）。

公开暴露的接口在入口处加锁：
```rust
pub fn create_backup(name: &str, backup_type: &str) -> Result<BackupRecord, String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    create_backup_internal(name, backup_type)
}

pub fn list_backups() -> Result<Vec<BackupRecord>, String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    list_backups_internal()
}

pub fn get_backup_data(id: &str) -> Result<BackupSnapshot, String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    get_backup_data_internal(id)
}

pub fn restore_backup(id: &str) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    restore_backup_internal(id)
}

pub fn delete_backup(id: &str) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    delete_backup_internal(id)
}

pub fn purge_old_backups(max_count: u32) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    purge_old_backups_internal(max_count)
}

pub fn save_backup_settings(
    enabled: Option<bool>,
    interval_hours: Option<u32>,
    max_count: Option<u32>,
) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    save_backup_settings_internal(enabled, interval_hours, max_count)
}

pub fn get_last_auto_backup_time() -> Option<u64> {
    let _lock = BACKUP_LOCK.lock().ok()?;
    get_last_auto_backup_time_internal()
}
```

- [ ] **Step 2: 编译检查代码是否有语法错误**

在 `src-tauri` 目录下运行：
```powershell
cargo check
```
Expected: 编译通过且无 Error。

- [ ] **Step 3: 运行已有的备份单元测试，确保逻辑和锁正常无死锁**

在 `src-tauri` 目录下运行：
```powershell
cargo test -p app --lib storage::backup_store_test
```
Expected: 所有测试 PASS，且不发生死锁超时。

- [ ] **Step 4: 提交代码**

```bash
git add src-tauri/src/storage/backup_store.rs
git commit -m "refactor(storage): 将备份存储层全部操作收归互斥锁保护，支持定时任务并发安全"
```

---

### Task 3: 清理 Tauri 命令层的锁保护

**Files:**
- Modify: `src-tauri/src/commands/backup.rs`

- [ ] **Step 1: 移除 `commands/backup.rs` 中的 `BACKUP_LOCK` 定义及使用**

移除静态变量定义：
```rust
// 移除这行
static BACKUP_LOCK: Mutex<()> = Mutex::new(());
```

并移除各 `tauri::command` 对 `BACKUP_LOCK.lock()` 的获取。例如：
```rust
#[tauri::command]
pub fn create_backup(name: Option<String>) -> Result<BackupRecord, String> {
    let backup_name = name.unwrap_or_else(|| {
        let now = chrono::Local::now();
        now.format("备份 %Y-%m-%d %H:%M").to_string()
    });
    backup_store::create_backup(&backup_name, "manual")
}
```

- [ ] **Step 2: 编译检查**

在 `src-tauri` 目录下运行：
```powershell
cargo check
```
Expected: 编译通过且无 Error。

- [ ] **Step 3: 运行完整 Cargo 测试**

在 `src-tauri` 目录下运行：
```powershell
cargo test
```
Expected: 所有的 tests（包括 container 其它 store 等）全部 PASS。

- [ ] **Step 4: 提交代码**

```bash
git add src-tauri/src/commands/backup.rs
git commit -m "refactor(commands): 去除备份命令中多余的锁逻辑，交由存储层内聚管理"
```

---

## Verification Plan

### Automated Tests
1. 在 `src-tauri` 下执行 `cargo test`。
   - 验证备份还原与存储机制的功能以及多线程无死锁性。

### Manual Verification
1. 启动应用开发模式：`npm run tauri dev`
2. 打开设置页面，切到“备份管理”标签页。
3. 点击“立即备份”并确认列表更新；删除刚创建的备份。
4. 修改一处桌面设置（如将网格宽度调大），再次执行“还原”刚才的历史备份，观察页面和主窗口网格尺寸是否完美重载并且还原到修改前的数值。
5. 检查定时备份是否正常（设置备份间隔 1 小时，观察日志输出）。

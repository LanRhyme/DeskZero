# DeskZero

Tauri v2 桌面应用（仅 Windows）。React 19 + TypeScript 前端，Rust 后端。窗口嵌入 Windows 桌面图标层（壁纸与图标之间）。

## 命令

```bash
npm run dev          # Vite 开发服务器（端口 1420）
npm run build        # tsc -b && vite build
npm run tauri dev    # Tauri 开发模式（自动启动前端）
npm run tauri build  # 构建发布二进制
```

前端无 lint、typecheck、test、formatter 脚本。用 `tsc -b`（no emit）做类型检查。

Rust 测试：在 `src-tauri/` 下执行 `cargo test`。

## 架构

### 前端 (`src/`)

- 入口：`main.tsx` -> `App.tsx`，按 URL 路径路由（`/` = 桌面，`/settings` = 设置页）
- 状态管理：Zustand stores（`stores/`）：`containerStore`、`desktopStore`、`settingsStore`
- 服务层（`services/`）：通过 Tauri `invoke()` 与 Rust 后端 IPC 通信
- 路径别名：`@/*` 映射到 `./src/*`
- Tailwind CSS v4（CSS 配置，`styles/globals.css` 中 `@import "tailwindcss"`）
- 主题：CSS 变量在 `:root` 和 `[data-theme="dark"]`，通过 `data-theme` 属性切换
- 工具函数：`cn.ts` 使用 `clsx` + `tailwind-merge`

### Rust 后端 (`src-tauri/src/`)

- 入口：`main.rs` -> `lib.rs::run()` — 初始化 Tauri，嵌入窗口到 Windows 桌面层
- `commands/` — Tauri invoke 处理器：`container`、`desktop`、`file`、`system`、`backup`
- `models/` — 数据类型：`container`、`item`、`settings`、`backup`
- `storage/` — SQLite 持久化（`rusqlite` bundled）：`db.rs`（初始化/建表/PRAGMA 配置）、`container_store`、`settings_store`、`desktop_store`、`backup_store`、`migration`
- `backup_timer.rs` — 后台自动备份定时器（tokio 异步循环）
- `desktop/` — Windows 桌面集成：`icon_scanner`、`shortcut`、`watcher`
- `clipboard.rs` — 文件剪贴板操作
- `context_menu.rs` — Windows 右键菜单

### 关键行为

- 主窗口启动时隐藏，嵌入 Windows Progman/WorkerW 层（最多重试 3 次）
- 设置窗口是独立 Tauri 窗口，通过事件（`settings-updated`）与主窗口通信
- 桌面文件监视器通知前端文件系统变化
- Release 配置：`lto = true`、`opt-level = "s"`、`strip = true`
- 数据库路径：`%APPDATA%/DeskZero/deskzero.db`
- 存储初始化流程：`init_db()` 建表 -> `run_migrations()` 迁移
- 备份系统：`backup_store` 管理快照 CRUD，`backup_timer` 后台定时自动备份，`BACKUP_LOCK` 互斥锁保护所有存储操作

## 持久化规范

本项目全面采用 SQLite（通过 `rusqlite` + `bundled` 特性）作为本地唯一存储引擎，彻底摒弃手动读写 JSON 文件的做法。此规范适用于任何未来负责本项目的 AI 或开发者。

### 核心原则

1. **零文件操作**：绝对禁止直接使用 `fs::write` 或 `fs::read_to_string` 来保存/读取包含核心业务数据的配置文件。所有的持久化数据（布局、容器、设置、甚至后续的主题缓存等）必须进入 `deskzero.db`。
2. **ACID 事务安全**：针对批量插入或更新（如：保存容器及其内部的项目），必须开启数据库事务 `tx = conn.transaction()` 以保证原子性，防止一半写入成功一半失败。
3. **单向信任**：前端通过 Tauri 的 `invoke` 调用修改数据时，应该在后端验证数据的有效性然后使用带参数绑定的 SQL 语句插入数据库，绝不允许拼接 SQL（防注入）。

### 后端模块结构

- **`src/storage/db.rs`**：负责数据库初始化（`init_db`），包含所有 `CREATE TABLE IF NOT EXISTS` 语句。每次添加新表都必须在此注册。`get_connection()` 中必须执行 `PRAGMA foreign_keys = ON` 以确保外键约束生效。
- **`src/storage/migration.rs`**：用于处理老旧格式的迁移。
- **特定领域的 Store 文件**（如 `settings_store.rs`, `container_store.rs`）：存放领域模型的数据库 CRUD 方法，它们只应暴露出对模型的操作，如 `load_containers()` 和 `save_containers()`，而封装掉所有 SQL 细节。

### 添加新持久化特性的标准流程

假设你要添加一个“小部件（Widget）”特性：

1. **定义模型**
   在 `models/` 目录下定义你的 Rust `struct`，并实现 `Serialize` / `Deserialize`。
2. **定义表结构**
   在 `storage/db.rs` 的 `init_db` 中加入建表语句，如 `CREATE TABLE IF NOT EXISTS widgets (id TEXT PRIMARY KEY, type TEXT, x REAL, y REAL, config TEXT)`。如果属性灵活多变，可以使用 `config TEXT` 字段存放序列化的 JSON。
3. **实现 Store**
   创建 `storage/widget_store.rs`，编写 `load_widgets` 和 `save_widgets`。
   * 读取时使用 `stmt.query_map` 将 Row 映射为模型。
   * 写入时使用差异删除 + `INSERT ... ON CONFLICT(id) DO UPDATE SET ...`（UPSERT），禁止先全量 `DELETE` 再 `INSERT`（参见健壮性规范）。
4. **导出接口**
   如果需要在前端访问，通过 Tauri `#[tauri::command]` 暴露出去。

### 数据模型映射约定

- **基础数据类型**：对应 SQL 的 `TEXT`, `REAL`, `INTEGER`。
- **枚举 (Enum)**：序列化为字符串存入 `TEXT` 字段，读取时通过 `serde_json::from_str(&format!("\"{}\"", val))` 解析恢复。枚举必须包含 `Other(String)` 变体（参见健壮性规范）。
- **灵活的深层对象配置 (Styles/Config)**：对非核心检索字段，例如复杂的样式配置，允许将其序列化为 JSON 字符串存入 `TEXT` 字段，以规避建立过多关联表和提高扩展性。JSON 序列化的结构体必须包含 `#[serde(flatten)] extra: HashMap<String, serde_json::Value>` 字段（参见健壮性规范）。

## 约定

- 无 ESLint、Prettier、CI 配置
- Rust 和 TypeScript 代码注释使用中文，保持此风格
- Rust 测试：单独的 `*_test.rs` 文件，通过父模块 `mod.rs` 中 `#[cfg(test)] mod xxx_test;` 引入
- 前端无测试
- Rust 调试日志用 `eprintln!`（终端可见，应用内不显示）
- 提交信息应使用中文

## 可复用 UI 组件

所有设置面板和配置 UI 必须使用 `src/components/UI/` 下的共享组件，禁止内联重复实现。

### 组件清单

| 组件 | 文件 | 用途 |
|------|------|------|
| `SwitchToggle` | `UI/SwitchToggle.tsx` | 开关切换，封装 `@headlessui/react` Switch |
| `Slider` | `UI/Slider.tsx` | 滑块，自定义 pointer-event 实现 |
| `NumberInput` | `UI/NumberInput.tsx` | 数字步进器（+/- 按钮 + 文本输入） |
| `ColorPicker` | `UI/ColorPicker.tsx` | Canvas 2D 色板 + hex 输入 + 预设色块 |
| `SegmentedControl` | `UI/SegmentedControl.tsx` | 分段按钮组（如 主题切换 light/dark/system） |
| `CustomSelect` | `UI/CustomSelect.tsx` | 自定义下拉选择器，支持 top/bottom 定位 |
| `TextInput` / `TextArea` | `UI/TextInput.tsx` | 文本输入框 / 多行文本域 |
| `SettingRow` | `UI/SettingRow.tsx` | 设置行布局（标题 + 描述 + 控件），支持 horizontal/vertical |
| `ConfirmDialog` | `UI/ConfirmDialog.tsx` | 确认对话框，framer-motion 动画 |
| `ToastContainer` | `UI/ToastContainer.tsx` | Toast 通知 |

### 使用规范

1. **禁止内联重复实现**：不得在设置面板中自行实现 toggle、slider、color picker 等控件，必须引用共享组件。
2. **设置面板 portal 模式**：所有容器/小组件的设置面板必须通过 `createPortal` 渲染到 `document.body`，外层包裹 `<div className="fixed inset-0 z-[99] settings-backdrop">` 阻止事件穿透。
3. **事件隔离**：设置面板的 backdrop 必须阻止 `onPointerDown` 和 `onClick` 冒泡，桌面层的 `onPointerDown` / `onDoubleClick` / `handleContextMenu` 需检查 `.settings-backdrop` 守卫。
4. **容器 `touch-none`**：可拖拽容器的根 `motion.div` 必须包含 `touch-none` class，否则桌面框选会穿透。
5. **新增共享组件**：当两个及以上面板出现相同 UI 模式时，应提取为 `src/components/UI/` 下的共享组件。

## 代码健壮性规范

此规范确保数据在跨版本升级、功能增减时保持安全，不丢失、不损坏。适用于任何未来负责本项目的 AI 或开发者。

### 1. 前后兼容的序列化

#### 枚举必须包含 `Other(String)` 变体

所有用于持久化或 IPC 的枚举（如 `ContainerType`、`ItemType`）**禁止**使用 serde 自动派生的 `Serialize`/`Deserialize`，必须手动实现并包含 `Other(String)` 变体。

**原因**：未来版本可能新增枚举值（如 `Widget`），老版本如果遇到不认识的值会通过 `unwrap_or(Normal)` 强制回退，重新保存后数据被永久篡改。

```rust
// ✅ 正确做法
pub enum ContainerType {
    Normal, Mapping, Folder, Game,
    Other(String),  // 保留未知类型原始字符串
}
// 手动实现 Serialize/Deserialize，未知值 -> Other(s)

// ❌ 错误做法
#[derive(Serialize, Deserialize)]
pub enum ContainerType { Normal, Mapping, Folder, Game }
// 遇到 "widget" 会反序列化失败 -> unwrap_or(Normal) -> 数据损坏
```

#### JSON 序列化的结构体必须包含 `extra` 字段

所有序列化为 JSON 存储的结构体（如 `ContainerStyle`、`Settings`、`Container`）必须包含：

```rust
#[serde(flatten)]
pub extra: HashMap<String, serde_json::Value>,
```

**原因**：新版本可能在 JSON 中新增字段，老版本反序列化时会忽略这些字段，重新序列化保存后新字段数据丢失。`extra` 字段会自动收集并保留所有未知属性。

### 2. 数据库安全更新策略

#### 禁止全量 DELETE + INSERT

**禁止**在 `save_*` 方法中先 `DELETE FROM table` 再 `INSERT` 全量数据。必须使用以下策略：

1. **差异删除**：查出现存 ID，只 `DELETE` 那些真正被移除的条目。
2. **UPSERT**：使用 `INSERT INTO ... ON CONFLICT(id) DO UPDATE SET col1=excluded.col1, ...` 更新现有数据。
3. **只更新已知列**：UPSERT 的 `DO UPDATE SET` 只列出当前版本认识的列，不影响未来版本新增的列。

```sql
-- ✅ 正确做法
INSERT INTO containers (id, name, type, ...) VALUES (?1, ?2, ?3, ...)
ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, ...

-- ❌ 错误做法
DELETE FROM containers;
INSERT INTO containers (id, name, type, ...) VALUES (?1, ?2, ?3, ...);
-- 如果未来版本在 containers 表新增了 is_pinned 列，全量 DELETE 后新列数据全部丢失
```

#### 数据库初始化失败必须阻止启动

`storage::init()` 失败时必须返回错误阻止应用继续运行，禁止仅打日志后继续（否则后续所有存储操作都会失败）。

### 3. 并发安全

#### 后端命令必须加互斥锁

所有对同一数据存储执行 `load → modify → save` 操作的 Tauri 命令，必须共用一个 `Mutex` 锁，防止前端并发调用导致竞态覆盖。

```rust
static CONTAINER_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub fn update_container_full(container: Container) -> Result<(), String> {
    let _lock = CONTAINER_LOCK.lock().map_err(|e| ...)?;
    // load -> modify -> save 在锁保护下执行
}
```

#### 存储层也可内聚锁保护

备份系统采用锁在存储层（`backup_store`）而非命令层的模式，因为后台定时器也需调用存储方法。公开方法加锁，内部 `_internal` 方法去锁，内部方法之间相互调用以避免死锁：

```rust
static BACKUP_LOCK: Mutex<()> = Mutex::new(());

pub fn create_backup(name: &str, backup_type: &str) -> Result<BackupRecord, String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| ...)?;
    create_backup_internal(name, backup_type)
}
fn create_backup_internal(name: &str, backup_type: &str) -> Result<BackupRecord, String> {
    // 实际逻辑，内部调用 purge_old_backups_internal（不调用公开方法，避免死锁）
}
```

### 4. 前端防抖持久化

#### 高频操作必须防抖

拖拽、调整大小等高频操作触发的持久化调用（`invoke`）必须使用防抖（debounce），避免每帧都触发数据库写入。

- 容器持久化：每个容器独立 300ms 防抖定时器
- 桌面布局保存：全局 500ms 防抖定时器

```typescript
// ✅ 正确做法：防抖持久化
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const persistContainer = (container: Container) => {
  const existing = debounceTimers.get(container.id)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(async () => {
    await invoke('update_container_full', { container })
  }, 300)
  debounceTimers.set(container.id, timer)
}

// ❌ 错误做法：每次修改立即写入
const persistContainer = async (container: Container) => {
  await invoke('update_container_full', { container })
}
```


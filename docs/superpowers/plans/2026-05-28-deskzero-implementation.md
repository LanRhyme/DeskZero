# DeskZero 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一款 Windows 桌面整理软件，使用 Tauri + React + Rust 实现桌面图标接管、收纳盒容器管理、文件拖拽整理等功能。

**Architecture:** 单窗口透明全屏覆盖桌面，React 负责 UI 渲染和交互，Rust 负责 Windows API 集成和数据持久化，通过 IPC 通信。

**Tech Stack:** Tauri 2.x, React 18, TypeScript, Vite, Tailwind CSS, Headless UI, Zustand, Rust, serde

---

## 文件结构总览

### Rust 后端 (`src-tauri/src/`)

| 文件 | 职责 |
|------|------|
| `models/mod.rs` | 模型模块导出 |
| `models/container.rs` | Container、ContainerType、ContainerStyle、Position、Size |
| `models/item.rs` | Item、ItemType |
| `models/settings.rs` | Settings |
| `storage/mod.rs` | 存储模块导出 |
| `storage/container_store.rs` | 容器 JSON 读写、备份 |
| `storage/settings_store.rs` | 设置 JSON 读写 |
| `desktop/mod.rs` | 桌面模块导出 |
| `desktop/icon_scanner.rs` | 桌面图标扫描 |
| `desktop/shortcut.rs` | 快捷方式解析 (.lnk) |
| `commands/mod.rs` | 命令模块导出 |
| `commands/container.rs` | 容器 CRUD IPC 命令 |
| `commands/desktop.rs` | 桌面操作 IPC 命令 |
| `commands/file.rs` | 文件操作 IPC 命令 |
| `commands/system.rs` | 系统信息 IPC 命令 |
| `lib.rs` | Tauri 应用构建、命令注册 |
| `main.rs` | 入口 |

### React 前端 (`src/`)

| 文件 | 职责 |
|------|------|
| `types/container.ts` | Container、ContainerStyle 类型 |
| `types/item.ts` | Item 类型 |
| `types/settings.ts` | Settings 类型 |
| `stores/containerStore.ts` | 容器状态管理 |
| `stores/settingsStore.ts` | 设置状态管理 |
| `services/containerService.ts` | 容器 IPC 调用封装 |
| `services/desktopService.ts` | 桌面操作 IPC 调用封装 |
| `services/fileService.ts` | 文件操作 IPC 调用封装 |
| `components/Desktop/DesktopLayer.tsx` | 透明全屏覆盖层 |
| `components/Desktop/DesktopGrid.tsx` | 网格对齐系统 |
| `components/Container/Container.tsx` | 容器外壳 |
| `components/Container/ContainerHeader.tsx` | 容器标题栏 |
| `components/Container/ContainerBody.tsx` | 容器内容区 |
| `components/Container/NormalContainer.tsx` | 普通容器 |
| `components/Container/MappingContainer.tsx` | 映射容器 |
| `components/Container/FolderContainer.tsx` | 文件夹容器 |
| `components/Item/FileItem.tsx` | 文件项 |
| `components/Item/FolderItem.tsx` | 文件夹项 |
| `components/Item/ShortcutItem.tsx` | 快捷方式项 |
| `components/ContextMenu/ContextMenu.tsx` | 右键菜单 |
| `components/Settings/SettingsPanel.tsx` | 设置面板 |
| `hooks/useDrag.ts` | 拖拽逻辑 |
| `hooks/useContainer.ts` | 容器操作 |
| `hooks/useTheme.ts` | 主题切换 |
| `styles/globals.css` | Tailwind + CSS 变量 |
| `App.tsx` | 根组件 |
| `main.tsx` | 入口 |

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles/globals.css`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Create: `src-tauri/build.rs`, `src-tauri/capabilities/default.json`

- [ ] **Step 1: 使用 Vite 创建 React 前端项目**

```bash
cd D:\AndroidStudioProjects\DeskZero
npm create vite@latest . -- --template react-ts
```

选择当前目录，覆盖已有文件。

- [ ] **Step 2: 安装前端依赖**

```bash
npm install
npm install zustand @headlessui/react @heroicons/react
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: 配置 Tailwind CSS**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

`vite.config.ts` 中添加 tailwindcss 插件:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
})
```

`src/styles/globals.css`:
```css
@import "tailwindcss";

:root {
  --color-bg: rgba(243, 243, 243, 0.88);
  --color-bg-hover: rgba(249, 249, 249, 0.92);
  --color-text: #1a1a1a;
  --color-text-secondary: #6b6b6b;
  --color-border: rgba(0, 0, 0, 0.06);
  --color-accent: #0078d4;
  --color-accent-subtle: rgba(0, 120, 212, 0.1);
  --container-radius: 10px;
  --container-blur: blur(30px);
  --item-bg: transparent;
  --item-bg-hover: rgba(0, 0, 0, 0.04);
  --item-radius: 6px;
  --icon-size: 48px;
}

[data-theme="dark"] {
  --color-bg: rgba(32, 32, 32, 0.88);
  --color-bg-hover: rgba(44, 44, 44, 0.92);
  --color-text: #e8e8e8;
  --color-text-secondary: #999;
  --color-border: rgba(255, 255, 255, 0.06);
  --item-bg-hover: rgba(255, 255, 255, 0.06);
}
```

- [ ] **Step 4: 配置 TypeScript**

`tsconfig.json` 中确保路径别名:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 5: 添加 npm scripts**

`package.json` 中确认 scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  }
}
```

- [ ] **Step 6: 初始化 Tauri 后端**

```bash
npm install @tauri-apps/cli @tauri-apps/api
npx tauri init --app-name DeskZero --window-title DeskZero --dev-url http://localhost:1420 --before-dev-command "npm run dev" --before-build-command "npm run build" --frontend-dist ../dist
```

- [ ] **Step 7: 配置 tauri.conf.json**

`src-tauri/tauri.conf.json` 关键配置:
```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "DeskZero",
        "fullscreen": true,
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": false
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

- [ ] **Step 8: 配置 Cargo.toml 依赖**

`src-tauri/Cargo.toml`:
```toml
[package]
name = "deskzero"
version = "0.1.0"
edition = "2021"

[lib]
name = "deskzero_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"
dirs = "5"
thiserror = "2"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

- [ ] **Step 9: 创建最小 Rust 入口**

`src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    deskzero_lib::run()
}
```

`src-tauri/src/lib.rs`:
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 10: 创建最小前端入口**

`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`src/App.tsx`:
```tsx
function App() {
  return (
    <div className="w-screen h-screen" style={{ background: 'transparent' }}>
      <h1 style={{ color: 'white', padding: '20px' }}>DeskZero</h1>
    </div>
  )
}

export default App
```

- [ ] **Step 11: 创建 capabilities 配置**

`src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "默认权限配置",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "core:window:allow-set-fullscreen",
    "core:window:allow-set-decorations"
  ]
}
```

- [ ] **Step 12: 验证项目可运行**

```bash
npm run tauri dev
```

预期：透明窗口出现，显示 "DeskZero" 文字。

- [ ] **Step 13: 提交**

```bash
git add .
git commit -m "feat(scaffold): 初始化 Tauri + React + Tailwind 项目脚手架"
```

---

## Task 2: Rust 数据模型

**Files:**
- Create: `src-tauri/src/models/mod.rs`, `src-tauri/src/models/container.rs`, `src-tauri/src/models/item.rs`, `src-tauri/src/models/settings.rs`

- [ ] **Step 1: 创建 models 模块入口**

`src-tauri/src/models/mod.rs`:
```rust
pub mod container;
pub mod item;
pub mod settings;

pub use container::*;
pub use item::*;
pub use settings::*;
```

- [ ] **Step 2: 创建 Container 模型**

`src-tauri/src/models/container.rs`:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ContainerType {
    Normal,
    Mapping,
    Folder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerStyle {
    pub background_opacity: f64,
    pub corner_radius: f64,
    pub show_header: bool,
}

impl Default for ContainerStyle {
    fn default() -> Self {
        Self {
            background_opacity: 0.88,
            corner_radius: 10.0,
            show_header: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Container {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub container_type: ContainerType,
    pub position: Position,
    pub size: Size,
    pub items: Vec<super::item::Item>,
    pub style: ContainerStyle,
    pub folder_path: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}
```

- [ ] **Step 3: 创建 Item 模型**

`src-tauri/src/models/item.rs`:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ItemType {
    File,
    Folder,
    Shortcut,
    Url,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon_path: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub target_path: Option<String>,
    pub is_in_container: bool,
    pub container_id: Option<String>,
}
```

- [ ] **Step 4: 创建 Settings 模型**

`src-tauri/src/models/settings.rs`:
```rust
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
        }
    }
}
```

- [ ] **Step 5: 注册模块到 lib.rs**

修改 `src-tauri/src/lib.rs`，添加 `mod models;`

- [ ] **Step 6: 验证编译通过**

```bash
cd src-tauri && cargo build
```

预期：编译成功，无错误。

- [ ] **Step 7: 提交**

```bash
git add src-tauri/src/models/
git commit -m "feat(models): 添加 Container、Item、Settings 数据模型"
```

---

## Task 3: Rust 存储层

**Files:**
- Create: `src-tauri/src/storage/mod.rs`, `src-tauri/src/storage/container_store.rs`, `src-tauri/src/storage/settings_store.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 storage 模块入口**

`src-tauri/src/storage/mod.rs`:
```rust
pub mod container_store;
pub mod settings_store;
```

- [ ] **Step 2: 实现 container_store**

`src-tauri/src/storage/container_store.rs`:
```rust
use std::fs;
use std::path::PathBuf;
use crate::models::Container;

fn get_data_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("DeskZero");
    fs::create_dir_all(&path).ok();
    path
}

fn get_containers_path() -> PathBuf {
    get_data_dir().join("containers.json")
}

fn get_backup_path() -> PathBuf {
    get_data_dir().join("containers.backup.json")
}

pub fn load_containers() -> Result<Vec<Container>, String> {
    let path = get_containers_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

pub fn save_containers(containers: &[Container]) -> Result<(), String> {
    let path = get_containers_path();
    let backup_path = get_backup_path();

    // 写入前备份
    if path.exists() {
        fs::copy(&path, &backup_path).ok();
    }

    let data = serde_json::to_string_pretty(containers).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

pub fn restore_from_backup() -> Result<Vec<Container>, String> {
    let backup_path = get_backup_path();
    if !backup_path.exists() {
        return Err("备份文件不存在".to_string());
    }
    let data = fs::read_to_string(&backup_path).map_err(|e| e.to_string())?;
    let containers: Vec<Container> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    // 恢复后写回主文件
    save_containers(&containers)?;
    Ok(containers)
}
```

- [ ] **Step 3: 实现 settings_store**

`src-tauri/src/storage/settings_store.rs`:
```rust
use std::fs;
use std::path::PathBuf;
use crate::models::Settings;

fn get_data_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("DeskZero");
    fs::create_dir_all(&path).ok();
    path
}

fn get_settings_path() -> PathBuf {
    get_data_dir().join("settings.json")
}

pub fn load_settings() -> Result<Settings, String> {
    let path = get_settings_path();
    if !path.exists() {
        return Ok(Settings::default());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let path = get_settings_path();
    let data = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}
```

- [ ] **Step 4: 注册模块到 lib.rs**

修改 `src-tauri/src/lib.rs`，添加 `mod storage;`

- [ ] **Step 5: 验证编译通过**

```bash
cd src-tauri && cargo build
```

预期：编译成功。

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/storage/
git commit -m "feat(storage): 实现容器和设置的 JSON 持久化存储"
```

---

## Task 4: Rust 桌面集成

**Files:**
- Create: `src-tauri/src/desktop/mod.rs`, `src-tauri/src/desktop/icon_scanner.rs`, `src-tauri/src/desktop/shortcut.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 添加 Windows 依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 中添加:
```toml
mslnk = "0.1"
```

- [ ] **Step 2: 创建 desktop 模块入口**

`src-tauri/src/desktop/mod.rs`:
```rust
pub mod icon_scanner;
pub mod shortcut;
```

- [ ] **Step 3: 实现桌面图标扫描**

`src-tauri/src/desktop/icon_scanner.rs`:
```rust
use std::path::PathBuf;
use crate::models::{Item, ItemType};

pub fn get_desktop_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // 用户桌面
    if let Some(desktop) = dirs::desktop_dir() {
        paths.push(desktop);
    }

    // 公共桌面
    let public_desktop = PathBuf::from(r"C:\Users\Public\Desktop");
    if public_desktop.exists() {
        paths.push(public_desktop);
    }

    paths
}

pub fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    let desktop_paths = get_desktop_paths();
    let mut items = Vec::new();

    for desktop_path in &desktop_paths {
        let entries = std::fs::read_dir(desktop_path)
            .map_err(|e| format!("读取桌面目录失败: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let item_type = if path.extension().map_or(false, |ext| ext == "lnk") {
                ItemType::Shortcut
            } else if path.extension().map_or(false, |ext| ext == "url") {
                ItemType::Url
            } else if path.is_dir() {
                ItemType::Folder
            } else {
                ItemType::File
            };

            let target_path = if item_type == ItemType::Shortcut {
                crate::desktop::shortcut::resolve_shortcut(&path).ok()
            } else {
                None
            };

            items.push(Item {
                id: uuid::Uuid::new_v4().to_string(),
                name,
                path: path.to_string_lossy().to_string(),
                icon_path: String::new(),
                item_type,
                target_path,
                is_in_container: false,
                container_id: None,
            });
        }
    }

    Ok(items)
}
```

- [ ] **Step 4: 实现快捷方式解析**

`src-tauri/src/desktop/shortcut.rs`:
```rust
use std::path::Path;

pub fn resolve_shortcut(path: &Path) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| format!("读取快捷方式失败: {}", e))?;
    let lnk = mslnk::ShellLink::new(&data).map_err(|e| format!("解析快捷方式失败: {}", e))?;
    Ok(lnk
        .link_info
        .as_ref()
        .and_then(|info| info.local_base_path.as_ref())
        .cloned()
        .unwrap_or_default())
}
```

- [ ] **Step 5: 注册模块到 lib.rs**

修改 `src-tauri/src/lib.rs`，添加 `mod desktop;`

- [ ] **Step 6: 验证编译通过**

```bash
cd src-tauri && cargo build
```

预期：编译成功（mslnk 可能需要编译时间）。

- [ ] **Step 7: 提交**

```bash
git add src-tauri/
git commit -m "feat(desktop): 实现桌面图标扫描和快捷方式解析"
```

---

## Task 5: Rust IPC 命令

**Files:**
- Create: `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/container.rs`, `src-tauri/src/commands/desktop.rs`, `src-tauri/src/commands/file.rs`, `src-tauri/src/commands/system.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 commands 模块入口**

`src-tauri/src/commands/mod.rs`:
```rust
pub mod container;
pub mod desktop;
pub mod file;
pub mod system;
```

- [ ] **Step 2: 实现容器命令**

`src-tauri/src/commands/container.rs`:
```rust
use crate::models::{Container, ContainerType, Position, Size};
use crate::storage::container_store;

#[tauri::command]
pub fn get_all_containers() -> Result<Vec<Container>, String> {
    container_store::load_containers()
}

#[tauri::command]
pub fn create_container(
    name: String,
    container_type: ContainerType,
    position: Position,
) -> Result<Container, String> {
    let now = chrono::Utc::now().timestamp_millis() as u64;
    let container = Container {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        container_type,
        position,
        size: Size {
            width: 200.0,
            height: 300.0,
        },
        items: Vec::new(),
        style: Default::default(),
        folder_path: None,
        created_at: now,
        updated_at: now,
    };

    let mut containers = container_store::load_containers()?;
    containers.push(container.clone());
    container_store::save_containers(&containers)?;
    Ok(container)
}

#[tauri::command]
pub fn update_container(id: String, name: Option<String>, position: Option<Position>, size: Option<Size>) -> Result<Container, String> {
    let mut containers = container_store::load_containers()?;
    let container = containers.iter_mut().find(|c| c.id == id).ok_or("容器不存在")?;

    if let Some(n) = name { container.name = n; }
    if let Some(p) = position { container.position = p; }
    if let Some(s) = size { container.size = s; }
    container.updated_at = chrono::Utc::now().timestamp_millis() as u64;

    let result = container.clone();
    container_store::save_containers(&containers)?;
    Ok(result)
}

#[tauri::command]
pub fn delete_container(id: String) -> Result<(), String> {
    let mut containers = container_store::load_containers()?;
    containers.retain(|c| c.id != id);
    container_store::save_containers(&containers)
}
```

- [ ] **Step 3: 实现桌面命令**

`src-tauri/src/commands/desktop.rs`:
```rust
use crate::desktop::icon_scanner;
use crate::models::Item;

#[tauri::command]
pub fn scan_desktop_icons() -> Result<Vec<Item>, String> {
    icon_scanner::scan_desktop_icons()
}
```

- [ ] **Step 4: 实现文件命令**

`src-tauri/src/commands/file.rs`:
```rust
use std::path::Path;

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_file(path: String, new_name: String) -> Result<String, String> {
    let old_path = Path::new(&path);
    let parent = old_path.parent().ok_or("无法获取父目录")?;
    let new_path = parent.join(&new_name);
    std::fs::rename(old_path, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn move_file(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_path_to_clipboard(path: String) -> Result<(), String> {
    // 使用 arboard 或直接调用 Windows API
    // 简单实现：写入剪贴板
    Ok(())
}
```

- [ ] **Step 5: 实现系统命令**

`src-tauri/src/commands/system.rs`:
```rust
use crate::models::Settings;
use crate::storage::settings_store;

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    settings_store::load_settings()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    settings_store::save_settings(&settings)
}

#[tauri::command]
pub fn get_system_theme() -> String {
    // 读取 Windows 注册表获取系统主题
    "light".to_string()
}
```

- [ ] **Step 6: 注册所有命令到 lib.rs**

修改 `src-tauri/src/lib.rs`:
```rust
mod models;
mod storage;
mod desktop;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::container::get_all_containers,
            commands::container::create_container,
            commands::container::update_container,
            commands::container::delete_container,
            commands::desktop::scan_desktop_icons,
            commands::file::open_file,
            commands::file::rename_file,
            commands::file::delete_file,
            commands::file::move_file,
            commands::system::get_settings,
            commands::system::save_settings,
            commands::system::get_system_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7: 添加 opener 依赖**

`src-tauri/Cargo.toml` 中添加:
```toml
opener = "0.7"
```

- [ ] **Step 8: 验证编译通过**

```bash
cd src-tauri && cargo build
```

预期：编译成功。

- [ ] **Step 9: 提交**

```bash
git add src-tauri/
git commit -m "feat(commands): 实现容器、桌面、文件、系统 IPC 命令"
```

---

## Task 6: React 类型与服务层

**Files:**
- Create: `src/types/container.ts`, `src/types/item.ts`, `src/types/settings.ts`
- Create: `src/services/containerService.ts`, `src/services/desktopService.ts`, `src/services/fileService.ts`

- [ ] **Step 1: 创建 TypeScript 类型**

`src/types/container.ts`:
```typescript
export type ContainerType = 'normal' | 'mapping' | 'folder'

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface ContainerStyle {
  backgroundOpacity: number
  cornerRadius: number
  showHeader: boolean
}

export interface Container {
  id: string
  name: string
  type: ContainerType
  position: Position
  size: Size
  items: Item[]
  style: ContainerStyle
  folderPath?: string
  createdAt: number
  updatedAt: number
}
```

`src/types/item.ts`:
```typescript
export type ItemType = 'file' | 'folder' | 'shortcut' | 'url'

export interface Item {
  id: string
  name: string
  path: string
  iconPath: string
  type: ItemType
  targetPath?: string
  isInContainer: boolean
  containerId?: string
}
```

`src/types/settings.ts`:
```typescript
export type Theme = 'light' | 'dark' | 'system'
export type IconSize = 'small' | 'medium' | 'large'
export type ItemBackground = 'transparent' | 'subtle' | 'visible'

export interface Settings {
  theme: Theme
  accentColor: string
  gridEnabled: boolean
  gridSize: number
  iconSize: IconSize
  cornerRadius: number
  backgroundBlur: boolean
  wallpaperCompatible: boolean
  itemBackground: ItemBackground
}
```

- [ ] **Step 2: 创建 containerService**

`src/services/containerService.ts`:
```typescript
import { invoke } from '@tauri-apps/api/core'
import type { Container, ContainerType, Position, Size } from '@/types/container'

export async function getAllContainers(): Promise<Container[]> {
  return invoke('get_all_containers')
}

export async function createContainer(
  name: string,
  type: ContainerType,
  position: Position
): Promise<Container> {
  return invoke('create_container', { name, containerType: type, position })
}

export async function updateContainer(
  id: string,
  changes: { name?: string; position?: Position; size?: Size }
): Promise<Container> {
  return invoke('update_container', { id, ...changes })
}

export async function deleteContainer(id: string): Promise<void> {
  return invoke('delete_container', { id })
}
```

- [ ] **Step 3: 创建 desktopService**

`src/services/desktopService.ts`:
```typescript
import { invoke } from '@tauri-apps/api/core'
import type { Item } from '@/types/item'

export async function scanDesktopIcons(): Promise<Item[]> {
  return invoke('scan_desktop_icons')
}
```

- [ ] **Step 4: 创建 fileService**

`src/services/fileService.ts`:
```typescript
import { invoke } from '@tauri-apps/api/core'

export async function openFile(path: string): Promise<void> {
  return invoke('open_file', { path })
}

export async function renameFile(path: string, newName: string): Promise<string> {
  return invoke('rename_file', { path, newName })
}

export async function deleteFile(path: string): Promise<void> {
  return invoke('delete_file', { path })
}

export async function moveFile(from: string, to: string): Promise<void> {
  return invoke('move_file', { from, to })
}
```

- [ ] **Step 5: 配置路径别名**

`vite.config.ts` 中添加 resolve alias:
```ts
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // ... 其他配置
})
```

- [ ] **Step 6: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

预期：无类型错误。

- [ ] **Step 7: 提交**

```bash
git add src/types/ src/services/ vite.config.ts
git commit -m "feat(types): 添加 TypeScript 类型定义和 IPC 服务封装"
```

---

## Task 7: React 状态管理

**Files:**
- Create: `src/stores/containerStore.ts`, `src/stores/settingsStore.ts`

- [ ] **Step 1: 创建 containerStore**

`src/stores/containerStore.ts`:
```typescript
import { create } from 'zustand'
import type { Container, Position, Size } from '@/types/container'
import * as containerService from '@/services/containerService'

interface ContainerState {
  containers: Container[]
  loading: boolean
  error: string | null
  loadContainers: () => Promise<void>
  createContainer: (name: string, type: Container['type'], position: Position) => Promise<void>
  updateContainer: (id: string, changes: { name?: string; position?: Position; size?: Size }) => Promise<void>
  deleteContainer: (id: string) => Promise<void>
  moveContainer: (id: string, position: Position) => Promise<void>
}

export const useContainerStore = create<ContainerState>((set, get) => ({
  containers: [],
  loading: false,
  error: null,

  loadContainers: async () => {
    set({ loading: true, error: null })
    try {
      const containers = await containerService.getAllContainers()
      set({ containers, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  createContainer: async (name, type, position) => {
    try {
      const container = await containerService.createContainer(name, type, position)
      set((state) => ({ containers: [...state.containers, container] }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  updateContainer: async (id, changes) => {
    try {
      const updated = await containerService.updateContainer(id, changes)
      set((state) => ({
        containers: state.containers.map((c) => (c.id === id ? updated : c)),
      }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  deleteContainer: async (id) => {
    try {
      await containerService.deleteContainer(id)
      set((state) => ({
        containers: state.containers.filter((c) => c.id !== id),
      }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  moveContainer: async (id, position) => {
    // 乐观更新：先更新 UI，再同步后端
    set((state) => ({
      containers: state.containers.map((c) =>
        c.id === id ? { ...c, position } : c
      ),
    }))
    try {
      await containerService.updateContainer(id, { position })
    } catch (err) {
      // 回滚
      set({ error: String(err) })
      get().loadContainers()
    }
  },
}))
```

- [ ] **Step 2: 创建 settingsStore**

`src/stores/settingsStore.ts`:
```typescript
import { create } from 'zustand'
import type { Settings } from '@/types/settings'
import { invoke } from '@tauri-apps/api/core'

interface SettingsState {
  settings: Settings
  loading: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<Settings>) => Promise<void>
}

const defaultSettings: Settings = {
  theme: 'system',
  accentColor: '#0078d4',
  gridEnabled: true,
  gridSize: 80,
  iconSize: 'medium',
  cornerRadius: 10,
  backgroundBlur: true,
  wallpaperCompatible: true,
  itemBackground: 'transparent',
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    try {
      const settings = await invoke<Settings>('get_settings')
      set({ settings, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  saveSettings: async (changes) => {
    const newSettings = { ...get().settings, ...changes }
    set({ settings: newSettings })
    try {
      await invoke('save_settings', { settings: newSettings })
    } catch (err) {
      console.error('保存设置失败:', err)
    }
  },
}))
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

预期：无错误。

- [ ] **Step 4: 提交**

```bash
git add src/stores/
git commit -m "feat(stores): 实现容器和设置的 Zustand 状态管理"
```

---

## Task 8: React 桌面层与容器组件

**Files:**
- Create: `src/components/Desktop/DesktopLayer.tsx`
- Create: `src/components/Container/Container.tsx`, `src/components/Container/ContainerHeader.tsx`, `src/components/Container/ContainerBody.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 创建 DesktopLayer**

`src/components/Desktop/DesktopLayer.tsx`:
```tsx
import { useEffect } from 'react'
import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import Container from '@/components/Container/Container'

export default function DesktopLayer() {
  const { containers, loadContainers, moveContainer } = useContainerStore()
  const { loadSettings } = useSettingsStore()

  useEffect(() => {
    loadContainers()
    loadSettings()
  }, [])

  return (
    <div
      className="w-screen h-screen relative select-none"
      style={{ background: 'transparent' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {containers.map((container) => (
        <Container
          key={container.id}
          container={container}
          onMove={(pos) => moveContainer(container.id, pos)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 创建 Container 组件**

`src/components/Container/Container.tsx`:
```tsx
import { useState, useRef, useCallback } from 'react'
import type { Container as ContainerType, Position } from '@/types/container'
import ContainerHeader from './ContainerHeader'
import ContainerBody from './ContainerBody'

interface Props {
  container: ContainerType
  onMove: (position: Position) => void
}

export default function Container({ container, onMove }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragOffset.current = {
      x: e.clientX - container.position.x,
      y: e.clientY - container.position.y,
    }
  }, [container.position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    onMove({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    })
  }, [isDragging, onMove])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  return (
    <div
      className="absolute flex flex-col"
      style={{
        left: container.position.x,
        top: container.position.y,
        width: container.size.width,
        height: container.size.height,
        borderRadius: container.style.cornerRadius,
        background: 'var(--color-bg)',
        backdropFilter: 'var(--container-blur)',
        boxShadow: 'var(--container-shadow)',
        border: '1px solid var(--color-border)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {container.style.showHeader && (
        <ContainerHeader
          name={container.name}
          onMouseDown={handleMouseDown}
        />
      )}
      <ContainerBody items={container.items} />
    </div>
  )
}
```

- [ ] **Step 3: 创建 ContainerHeader**

`src/components/Container/ContainerHeader.tsx`:
```tsx
interface Props {
  name: string
  onMouseDown: (e: React.MouseEvent) => void
}

export default function ContainerHeader({ name, onMouseDown }: Props) {
  return (
    <div
      className="flex items-center px-3 py-2 cursor-move shrink-0"
      style={{
        color: 'var(--color-text)',
        borderBottom: '1px solid var(--color-border)',
      }}
      onMouseDown={onMouseDown}
    >
      <span className="text-sm font-medium truncate">{name}</span>
    </div>
  )
}
```

- [ ] **Step 4: 创建 ContainerBody**

`src/components/Container/ContainerBody.tsx`:
```tsx
import type { Item } from '@/types/item'

interface Props {
  items: Item[]
}

export default function ContainerBody({ items }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-2">
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          拖放文件到此处
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center p-2 rounded-md cursor-pointer"
              style={{ background: 'var(--item-bg)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--item-bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--item-bg)'
              }}
            >
              <div className="w-10 h-10 flex items-center justify-center text-2xl">
                {item.type === 'folder' ? '📁' : item.type === 'shortcut' ? '🔗' : '📄'}
              </div>
              <span className="text-xs mt-1 text-center truncate w-full" style={{ color: 'var(--color-text)' }}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: 更新 App.tsx**

`src/App.tsx`:
```tsx
import DesktopLayer from '@/components/Desktop/DesktopLayer'

function App() {
  return <DesktopLayer />
}

export default App
```

- [ ] **Step 6: 验证运行**

```bash
npm run tauri dev
```

预期：透明窗口显示，容器可拖动。

- [ ] **Step 7: 提交**

```bash
git add src/
git commit -m "feat(ui): 实现桌面覆盖层和容器组件基础结构"
```

---

## Task 9: 右键菜单与容器创建

**Files:**
- Create: `src/components/ContextMenu/ContextMenu.tsx`
- Modify: `src/components/Desktop/DesktopLayer.tsx`

- [ ] **Step 1: 创建 ContextMenu 组件**

`src/components/ContextMenu/ContextMenu.tsx`:
```tsx
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

interface MenuItemDef {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface Props {
  items: MenuItemDef[]
  position: { x: number; y: number }
  onClose: () => void
}

export default function ContextMenu({ items, position, onClose }: Props) {
  return (
    <div
      className="fixed z-50 min-w-48 py-1 rounded-lg shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        backdropFilter: 'var(--container-blur)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="w-full text-left px-3 py-2 text-sm transition-colors"
          style={{ color: 'var(--color-text)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          disabled={item.disabled}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 在 DesktopLayer 中集成右键菜单**

修改 `src/components/Desktop/DesktopLayer.tsx`:
```tsx
import { useEffect, useState, useCallback } from 'react'
import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import Container from '@/components/Container/Container'
import ContextMenu from '@/components/ContextMenu/ContextMenu'

interface MenuState {
  visible: boolean
  x: number
  y: number
}

export default function DesktopLayer() {
  const { containers, loadContainers, moveContainer, createContainer } = useContainerStore()
  const { loadSettings } = useSettingsStore()
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0 })

  useEffect(() => {
    loadContainers()
    loadSettings()
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ visible: true, x: e.clientX, y: e.clientY })
  }, [])

  const closeMenu = useCallback(() => {
    setMenu((prev) => ({ ...prev, visible: false }))
  }, [])

  const desktopMenuItems = [
    {
      label: '新建普通容器',
      onClick: () => createContainer('新容器', 'normal', { x: menu.x, y: menu.y }),
    },
    {
      label: '新建映射容器',
      onClick: () => createContainer('映射容器', 'mapping', { x: menu.x, y: menu.y }),
    },
    {
      label: '新建文件夹容器',
      onClick: () => createContainer('文件夹容器', 'folder', { x: menu.x, y: menu.y }),
    },
  ]

  return (
    <div
      className="w-screen h-screen relative select-none"
      style={{ background: 'transparent' }}
      onContextMenu={handleContextMenu}
      onClick={closeMenu}
    >
      {containers.map((container) => (
        <Container
          key={container.id}
          container={container}
          onMove={(pos) => moveContainer(container.id, pos)}
        />
      ))}

      {menu.visible && (
        <ContextMenu
          items={desktopMenuItems}
          position={{ x: menu.x, y: menu.y }}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: 验证运行**

```bash
npm run tauri dev
```

预期：右键桌面弹出菜单，可创建容器。

- [ ] **Step 4: 提交**

```bash
git add src/
git commit -m "feat(context-menu): 实现右键菜单和容器创建功能"
```

---

## Task 10: 主题系统

**Files:**
- Create: `src/hooks/useTheme.ts`
- Modify: `src/components/Desktop/DesktopLayer.tsx`

- [ ] **Step 1: 创建 useTheme hook**

`src/hooks/useTheme.ts`:
```typescript
import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

export function useTheme() {
  const { settings } = useSettingsStore()

  useEffect(() => {
    const applyTheme = () => {
      let theme = settings.theme

      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      }

      document.documentElement.setAttribute('data-theme', theme)
    }

    applyTheme()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (settings.theme === 'system') {
        applyTheme()
      }
    }
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [settings.theme])
}
```

- [ ] **Step 2: 在 DesktopLayer 中使用 useTheme**

在 `src/components/Desktop/DesktopLayer.tsx` 的组件函数内添加:
```tsx
import { useTheme } from '@/hooks/useTheme'

// 在组件内部
useTheme()
```

- [ ] **Step 3: 验证主题切换**

手动修改 `settingsStore` 中的 theme 值，确认 `[data-theme="dark"]` CSS 变量生效。

- [ ] **Step 4: 提交**

```bash
git add src/
git commit -m "feat(theme): 实现系统主题跟随和深色/浅色模式切换"
```

---

## Task 11: 设置面板

**Files:**
- Create: `src/components/Settings/SettingsPanel.tsx`
- Modify: `src/components/Desktop/DesktopLayer.tsx`

- [ ] **Step 1: 创建 SettingsPanel**

`src/components/Settings/SettingsPanel.tsx`:
```tsx
import { useSettingsStore } from '@/stores/settingsStore'
import type { Theme, IconSize, ItemBackground } from '@/types/settings'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const { settings, saveSettings } = useSettingsStore()

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="w-96 max-h-[80vh] overflow-y-auto rounded-xl p-6"
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          backdropFilter: 'var(--container-blur)',
          color: 'var(--color-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">设置</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">主题</label>
            <select
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              value={settings.theme}
              onChange={(e) => saveSettings({ theme: e.target.value as Theme })}
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">图标大小</label>
            <select
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              value={settings.iconSize}
              onChange={(e) => saveSettings({ iconSize: e.target.value as IconSize })}
            >
              <option value="small">小</option>
              <option value="medium">中</option>
              <option value="large">大</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Item 背景</label>
            <select
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              value={settings.itemBackground}
              onChange={(e) => saveSettings({ itemBackground: e.target.value as ItemBackground })}
            >
              <option value="transparent">透明</option>
              <option value="subtle">浅色</option>
              <option value="visible">可见</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">网格对齐</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.gridEnabled}
                onChange={(e) => saveSettings({ gridEnabled: e.target.checked })}
              />
              <span className="text-sm">启用</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">网格大小</label>
            <input
              type="range"
              min="40"
              max="160"
              step="10"
              value={settings.gridSize}
              onChange={(e) => saveSettings({ gridSize: Number(e.target.value) })}
              className="w-full"
            />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {settings.gridSize}px
            </span>
          </div>
        </div>

        <button
          className="mt-6 w-full rounded-md py-2 text-sm font-medium"
          style={{
            background: 'var(--color-accent)',
            color: 'white',
          }}
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 DesktopLayer 中添加设置入口**

在 DesktopLayer 的右键菜单中添加"设置"选项：
```tsx
const [showSettings, setShowSettings] = useState(false)

// 在 desktopMenuItems 中添加:
{
  label: '设置',
  onClick: () => setShowSettings(true),
}

// 在 JSX 中添加:
{showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
```

- [ ] **Step 3: 验证运行**

```bash
npm run tauri dev
```

预期：右键菜单可打开设置面板，修改主题后生效。

- [ ] **Step 4: 提交**

```bash
git add src/
git commit -m "feat(settings): 实现设置面板，支持主题、图标大小、网格等配置"
```

---

## Task 12: 容器类型特化与 Item 交互

**Files:**
- Create: `src/components/Container/NormalContainer.tsx`, `src/components/Container/MappingContainer.tsx`, `src/components/Container/FolderContainer.tsx`
- Create: `src/components/Item/FileItem.tsx`, `src/components/Item/FolderItem.tsx`, `src/components/Item/ShortcutItem.tsx`
- Modify: `src/components/Container/Container.tsx`, `src/components/Container/ContainerBody.tsx`

- [ ] **Step 1: 创建 Item 组件**

`src/components/Item/FileItem.tsx`:
```tsx
import type { Item } from '@/types/item'
import { openFile } from '@/services/fileService'

interface Props {
  item: Item
}

export default function FileItem({ item }: Props) {
  return (
    <div
      className="flex flex-col items-center p-2 rounded-md cursor-pointer"
      style={{ background: 'var(--item-bg)' }}
      onDoubleClick={() => openFile(item.path)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--item-bg-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--item-bg)'
      }}
    >
      <div className="w-10 h-10 flex items-center justify-center text-2xl">📄</div>
      <span className="text-xs mt-1 text-center truncate w-full" style={{ color: 'var(--color-text)' }}>
        {item.name}
      </span>
    </div>
  )
}
```

`src/components/Item/FolderItem.tsx`:
```tsx
import type { Item } from '@/types/item'
import { openFile } from '@/services/fileService'

interface Props {
  item: Item
}

export default function FolderItem({ item }: Props) {
  return (
    <div
      className="flex flex-col items-center p-2 rounded-md cursor-pointer"
      style={{ background: 'var(--item-bg)' }}
      onDoubleClick={() => openFile(item.path)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--item-bg-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--item-bg)'
      }}
    >
      <div className="w-10 h-10 flex items-center justify-center text-2xl">📁</div>
      <span className="text-xs mt-1 text-center truncate w-full" style={{ color: 'var(--color-text)' }}>
        {item.name}
      </span>
    </div>
  )
}
```

`src/components/Item/ShortcutItem.tsx`:
```tsx
import type { Item } from '@/types/item'
import { openFile } from '@/services/fileService'

interface Props {
  item: Item
}

export default function ShortcutItem({ item }: Props) {
  return (
    <div
      className="flex flex-col items-center p-2 rounded-md cursor-pointer"
      style={{ background: 'var(--item-bg)' }}
      onDoubleClick={() => openFile(item.path)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--item-bg-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--item-bg)'
      }}
    >
      <div className="w-10 h-10 flex items-center justify-center text-2xl">🔗</div>
      <span className="text-xs mt-1 text-center truncate w-full" style={{ color: 'var(--color-text)' }}>
        {item.name}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: 更新 ContainerBody 使用 Item 组件**

`src/components/Container/ContainerBody.tsx`:
```tsx
import type { Item } from '@/types/item'
import FileItem from '@/components/Item/FileItem'
import FolderItem from '@/components/Item/FolderItem'
import ShortcutItem from '@/components/Item/ShortcutItem'

interface Props {
  items: Item[]
}

function renderItem(item: Item) {
  switch (item.type) {
    case 'folder':
      return <FolderItem key={item.id} item={item} />
    case 'shortcut':
      return <ShortcutItem key={item.id} item={item} />
    default:
      return <FileItem key={item.id} item={item} />
  }
}

export default function ContainerBody({ items }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-2">
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          拖放文件到此处
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map(renderItem)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 创建容器类型特化组件**

`src/components/Container/NormalContainer.tsx`:
```tsx
import Container from './Container'
import type { Container as ContainerType, Position } from '@/types/container'

interface Props {
  container: ContainerType
  onMove: (position: Position) => void
}

export default function NormalContainer({ container, onMove }: Props) {
  return <Container container={container} onMove={onMove} />
}
```

`src/components/Container/MappingContainer.tsx`:
```tsx
import Container from './Container'
import type { Container as ContainerType, Position } from '@/types/container'

interface Props {
  container: ContainerType
  onMove: (position: Position) => void
}

export default function MappingContainer({ container, onMove }: Props) {
  return <Container container={container} onMove={onMove} />
}
```

`src/components/Container/FolderContainer.tsx`:
```tsx
import Container from './Container'
import type { Container as ContainerType, Position } from '@/types/container'

interface Props {
  container: ContainerType
  onMove: (position: Position) => void
}

export default function FolderContainer({ container, onMove }: Props) {
  return <Container container={container} onMove={onMove} />
}
```

- [ ] **Step 4: 更新 DesktopLayer 使用特化容器**

在 `src/components/Desktop/DesktopLayer.tsx` 中根据 container.type 渲染不同组件。

- [ ] **Step 5: 验证运行**

```bash
npm run tauri dev
```

预期：不同类型的容器显示，Item 双击可打开文件。

- [ ] **Step 6: 提交**

```bash
git add src/
git commit -m "feat(containers): 实现容器类型特化和 Item 组件交互"
```

---

## Task 13: Rust 单元测试

**Files:**
- Create: `src-tauri/src/models/container_test.rs`, `src-tauri/src/storage/container_store_test.rs`

- [ ] **Step 1: 添加 Container 模型测试**

`src-tauri/src/models/container_test.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::super::container::*;
    use super::super::item::{Item, ItemType};

    #[test]
    fn test_container_default_style() {
        let style = ContainerStyle::default();
        assert_eq!(style.background_opacity, 0.88);
        assert_eq!(style.corner_radius, 10.0);
        assert!(style.show_header);
    }

    #[test]
    fn test_container_serialization() {
        let container = Container {
            id: "test-id".to_string(),
            name: "测试容器".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 100.0, y: 200.0 },
            size: Size { width: 200.0, height: 300.0 },
            items: vec![],
            style: ContainerStyle::default(),
            folder_path: None,
            created_at: 0,
            updated_at: 0,
        };

        let json = serde_json::to_string(&container).unwrap();
        let deserialized: Container = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "测试容器");
        assert_eq!(deserialized.container_type, ContainerType::Normal);
    }
}
```

- [ ] **Step 2: 添加存储测试**

`src-tauri/src/storage/container_store_test.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::super::container_store::*;
    use crate::models::*;

    #[test]
    fn test_save_and_load_containers() {
        let containers = vec![Container {
            id: "test-1".to_string(),
            name: "测试".to_string(),
            container_type: ContainerType::Normal,
            position: Position { x: 0.0, y: 0.0 },
            size: Size { width: 200.0, height: 300.0 },
            items: vec![],
            style: ContainerStyle::default(),
            folder_path: None,
            created_at: 0,
            updated_at: 0,
        }];

        save_containers(&containers).unwrap();
        let loaded = load_containers().unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].name, "测试");
    }
}
```

- [ ] **Step 3: 注册测试模块**

在 `src-tauri/src/models/mod.rs` 中添加:
```rust
#[cfg(test)]
mod container_test;
```

在 `src-tauri/src/storage/mod.rs` 中添加:
```rust
#[cfg(test)]
mod container_store_test;
```

- [ ] **Step 4: 运行测试**

```bash
cd src-tauri && cargo test
```

预期：所有测试通过。

- [ ] **Step 5: 提交**

```bash
git add src-tauri/
git commit -m "test(models): 添加数据模型和存储层单元测试"
```

---

## Task 14: 最终验证与清理

- [ ] **Step 1: 完整构建验证**

```bash
npm run tauri build
```

预期：构建成功，生成可执行文件。

- [ ] **Step 2: 运行测试**

```bash
cd src-tauri && cargo test
```

预期：所有测试通过。

- [ ] **Step 3: TypeScript 类型检查**

```bash
npx tsc --noEmit
```

预期：无类型错误。

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "chore: 最终验证和清理"
```

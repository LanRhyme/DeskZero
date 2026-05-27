# DeskZero 设计文档

## 概述

DeskZero 是一款 Windows 桌面整理软件，结合桌面美化与文件效率管理。参考 Sapphire（桌面替换）和 Pogget（文件收纳）的设计理念，使用 Tauri + React + Rust 技术栈构建。

## 目标用户

需要同时兼顾桌面美观和文件管理效率的 Windows 用户。

## 技术选型

| 层级 | 技术 |
|------|------|
| 框架 | Tauri 2.x |
| 前端 | React + TypeScript |
| UI | Tailwind CSS + Headless UI |
| 状态管理 | Zustand |
| 构建 | Vite |
| 后端 | Rust |
| 存储 | JSON 文件（`%APPDATA%/DeskZero/`） |
| 平台 | Windows 10/11 |

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────┐
│                  Tauri Window                    │
│              (透明全屏覆盖桌面)                    │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │              React Frontend                 │ │
│  │                                             │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐      │ │
│  │  │Container│ │Container│ │Container│ ...   │ │
│  │  │  (Normal)│ │(Mapping)│ │ (Folder)│      │ │
│  │  └─────────┘ └─────────┘ └─────────┘      │ │
│  │                                             │ │
│  │  拖拽引擎 / 缩放 / 右键菜单 / 主题系统      │ │
│  └─────────────────────────────────────────────┘ │
│                     │ IPC (invoke/event)          │
│  ┌─────────────────────────────────────────────┐ │
│  │              Rust Backend                   │ │
│  │                                             │ │
│  │  Windows API 层 │ 文件系统 │ 数据持久化      │ │
│  │  桌面图标扫描   │ 快捷方式 │ 壁纸兼容        │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 分工

- **React**：UI 渲染、交互逻辑、状态管理、主题
- **Rust**：Windows 系统集成、文件操作、数据存储、IPC 服务

## 项目结构

```
DeskZero/
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # 库入口
│   │   ├── commands/             # Tauri IPC 命令
│   │   │   ├── mod.rs
│   │   │   ├── container.rs      # 容器 CRUD
│   │   │   ├── desktop.rs        # 桌面图标操作
│   │   │   ├── file.rs           # 文件操作
│   │   │   └── system.rs         # 系统信息/设置
│   │   ├── desktop/              # Windows 桌面集成
│   │   │   ├── mod.rs
│   │   │   ├── icon_scanner.rs   # 桌面图标扫描
│   │   │   ├── shortcut.rs       # 快捷方式解析
│   │   │   └── wallpaper.rs      # 壁纸兼容
│   │   ├── storage/              # 数据持久化
│   │   │   ├── mod.rs
│   │   │   ├── container_store.rs
│   │   │   └── settings_store.rs
│   │   ├── models/               # 数据模型
│   │   │   ├── mod.rs
│   │   │   ├── container.rs
│   │   │   ├── item.rs
│   │   │   └── settings.rs
│   │   └── utils/
│   │       ├── mod.rs
│   │       └── path.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                          # React 前端
│   ├── main.tsx                  # 入口
│   ├── App.tsx                   # 根组件
│   ├── components/
│   │   ├── Desktop/              # 桌面主区域
│   │   │   ├── DesktopLayer.tsx  # 透明覆盖层
│   │   │   └── DesktopGrid.tsx   # 网格对齐系统
│   │   ├── Container/            # 收纳盒组件
│   │   │   ├── Container.tsx     # 容器外壳
│   │   │   ├── ContainerHeader.tsx
│   │   │   ├── ContainerBody.tsx
│   │   │   ├── NormalContainer.tsx
│   │   │   ├── MappingContainer.tsx
│   │   │   └── FolderContainer.tsx
│   │   ├── Item/                 # 文件/图标项
│   │   │   ├── FileItem.tsx
│   │   │   ├── FolderItem.tsx
│   │   │   └── ShortcutItem.tsx
│   │   ├── ContextMenu/          # 右键菜单
│   │   │   └── ContextMenu.tsx
│   │   ├── Settings/             # 设置面板
│   │   │   └── SettingsPanel.tsx
│   │   └── common/               # 通用组件
│   │       ├── DragOverlay.tsx
│   │       └── ResizeHandle.tsx
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useDrag.ts
│   │   ├── useContainer.ts
│   │   ├── useDesktop.ts
│   │   └── useTheme.ts
│   ├── stores/                   # 状态管理 (Zustand)
│   │   ├── containerStore.ts
│   │   ├── desktopStore.ts
│   │   └── settingsStore.ts
│   ├── services/                 # IPC 调用封装
│   │   ├── containerService.ts
│   │   ├── desktopService.ts
│   │   └── fileService.ts
│   ├── types/                    # TypeScript 类型
│   │   ├── container.ts
│   │   ├── item.ts
│   │   └── settings.ts
│   ├── styles/                   # 样式
│   │   ├── globals.css
│   │   └── themes/
│   └── utils/
│       ├── drag.ts
│       └── grid.ts
│
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 数据模型

### 前端类型

```typescript
// types/container.ts
interface Container {
  id: string;                    // UUID
  name: string;                  // 容器名称
  type: 'normal' | 'mapping' | 'folder';  // 容器类型
  position: { x: number; y: number };      // 桌面位置
  size: { width: number; height: number }; // 容器尺寸
  items: Item[];                 // 内含文件项
  style: ContainerStyle;        // 外观样式
  folderPath?: string;           // Folder 类型绑定的文件夹路径
  createdAt: number;             // 时间戳
  updatedAt: number;
}

interface ContainerStyle {
  backgroundOpacity: number;     // 0-1
  cornerRadius: number;          // px
  showHeader: boolean;
}

// types/item.ts
interface Item {
  id: string;
  name: string;
  path: string;                  // 原始文件路径
  iconPath: string;              // 图标路径（缓存）
  type: 'file' | 'folder' | 'shortcut' | 'url';
  targetPath?: string;           // 快捷方式目标
  isInContainer: boolean;
  containerId?: string;
}

// types/settings.ts
interface Settings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  gridEnabled: boolean;
  gridSize: number;
  iconSize: 'small' | 'medium' | 'large';
  cornerRadius: number;
  backgroundBlur: boolean;
  wallpaperCompatible: boolean;
  itemBackground: 'transparent' | 'subtle' | 'visible';
}
```

### Rust 模型

```rust
// models/container.rs
#[derive(Serialize, Deserialize, Clone)]
pub struct Container {
    pub id: String,
    pub name: String,
    pub container_type: ContainerType,
    pub position: Position,
    pub size: Size,
    pub items: Vec<Item>,
    pub style: ContainerStyle,
    pub folder_path: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum ContainerType {
    Normal,
    Mapping,
    Folder,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ContainerStyle {
    pub background_opacity: f64,
    pub corner_radius: f64,
    pub show_header: bool,
}

// models/item.rs
#[derive(Serialize, Deserialize, Clone)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon_path: String,
    pub item_type: ItemType,
    pub target_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum ItemType {
    File,
    Folder,
    Shortcut,
    Url,
}
```

### 存储

- `containers.json` — 所有容器数据
- `settings.json` — 用户设置
- `icons/` — 图标缓存目录
- `items/` — 普通容器内文件的存放目录（`%APPDATA%/DeskZero/items/`）

### 普通容器文件存放

普通容器中的文件被物理移动到 `%APPDATA%/DeskZero/items/{container_id}/` 目录下。删除容器时可选择保留或删除文件。

## 容器类型

| 类型 | 行为 |
|------|------|
| **普通容器 (Normal)** | 文件被移入容器，容器内可重命名/删除/归档 |
| **映射容器 (Mapping)** | 虚拟链接，不移动文件，清空不影响原文件 |
| **文件夹容器 (Folder)** | 绑定真实文件夹，双向同步 |

## 桌面交互

- 接管原生桌面图标：扫描用户桌面和公共桌面，转为 Item 组件
- 拖拽：容器和 Item 自由拖放，支持网格对齐
- 缩放：Shift+滚轮调整容器大小
- 右键菜单：容器/Item 右键弹出操作菜单
- 原生菜单：Shift+右键调用 Windows 原生右键菜单
- 双击：双击 Item 打开文件/程序

## IPC 命令

```typescript
// 容器操作
invoke('create_container', { name, type, position });
invoke('delete_container', { id });
invoke('update_container', { id, changes });
invoke('get_all_containers');

// 桌面操作
invoke('scan_desktop_icons');
invoke('get_icon_cache', { path });
invoke('open_file', { path });
invoke('resolve_shortcut', { path });

// 文件操作
invoke('move_file', { from, to });
invoke('rename_file', { path, newName });
invoke('delete_file', { path });
invoke('watch_folder', { path });
```

## 右键菜单

```
容器右键：
├── 重命名容器
├── 更改类型
├── 绑定文件夹... (仅 Folder)
├── 更改外观
├── 置顶/取消置顶
└── 删除容器

Item 右键：
├── 打开
├── 打开所在文件夹
├── 重命名
├── 移动到容器...
├── 复制路径
└── 删除
```

## 主题与视觉

### 设计原则

- 品牌色极简使用：仅用于交互状态（选中、拖拽高亮）
- 主色调黑白灰
- Item 默认透明背景
- 容器背景跟随系统深色/浅色模式

### CSS 变量

```css
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

### 视觉分层

| 元素 | 背景 |
|------|------|
| Item | transparent（默认），hover 时微弱底色 |
| 容器 | 半透明毛玻璃，跟随系统深/浅色 |
| 桌面层 | 完全透明，不遮挡壁纸 |

### Item 背景配置

```typescript
itemBackground: 'transparent' | 'subtle' | 'visible';
// transparent: 完全透明（默认）
// subtle: 极浅底色
// visible: 明确底色
```

## 错误处理

### Rust 统一错误

```rust
#[derive(Debug, thiserror::Error)]
pub enum DeskZeroError {
    #[error("容器不存在: {0}")]
    ContainerNotFound(String),
    #[error("文件操作失败: {0}")]
    FileOperationFailed(String),
    #[error("快捷方式解析失败: {0}")]
    ShortcutResolveFailed(String),
    #[error("桌面扫描失败: {0}")]
    DesktopScanFailed(String),
    #[error("存储错误: {0}")]
    StorageError(String),
}
```

### 边界情况

| 场景 | 处理 |
|------|------|
| 文件被外部删除 | watch_folder 监听文件夹变化，通过事件通知前端自动移除已删除项 |
| 快捷方式目标失效 | 标记为"无效"，灰色图标 |
| 容器数据损坏 | 从备份恢复（每次写入前保留上一版本） |
| 多显示器 | 记录显示器 ID，窗口跟随主显示器 |
| DPI 变化 | 监听 DPI 事件，重新计算布局 |

## MVP 范围

### 包含

- 透明全屏覆盖层接管桌面
- 三种容器类型（普通、映射、文件夹）
- 拖拽、缩放、网格对齐
- 右键菜单
- 桌面图标扫描与接管
- 深色/浅色主题跟随系统
- JSON 文件持久化
- 壁纸兼容（WallpaperEngine）

### 不包含（后续迭代）

- 动画特效系统
- Steam 集成
- 插件系统
- 多语言支持
- 自定义快捷键

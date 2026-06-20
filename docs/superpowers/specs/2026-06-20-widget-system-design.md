# 小组件系统设计

## 概述

在 DeskZero 桌面中添加小组件功能。小组件是一种新的容器类型，遵循桌面网格对齐，支持内置小组件和用户自定义 HTML 小组件。

## 核心决策

- **方案选择**：统一 Widget 容器类型（方案 A）— 在 `ContainerType` 中添加 `Widget` 变体，复用现有容器系统
- **自定义开发**：内置 + 自定义混合模式，内置小组件用 React 组件，自定义小组件通过 iframe 加载本地 HTML 文件
- **首批内置小组件**：时钟、便签、系统监控
- **配置存储**：复用 `Container.style.config` 字段，无需新建数据库表

## 数据模型

### ContainerType 扩展

Rust (`models/container.rs`)：
```rust
pub enum ContainerType {
    Normal, Mapping, Folder, Game, IconShow,
    Widget,         // 新增
    Other(String),
}
```

TypeScript (`types/container.ts`)：
```typescript
export type ContainerType = "normal" | "mapping" | "folder" | "game" | "iconShow" | "widget";
```

### WidgetConfig 类型

新建 `types/widget.ts`：

```typescript
export interface WidgetConfig {
  widgetType: string;  // "clock" | "stickyNote" | "systemMonitor" | "custom" | ...
  // 自定义小组件
  customHtmlPath?: string;
  // 小组件私有配置（各类型不同）
  config: Record<string, any>;
}

export interface WidgetMeta {
  name: string;
  defaultWidth: number;   // 网格单位
  defaultHeight: number;  // 网格单位
  configSchema?: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "color" | "select" | "toggle";
  default: any;
  options?: { label: string; value: any }[];
}
```

存放在 `Container.style.config` 字段中，序列化为 JSON 存入 `containers.style TEXT`。

## 小组件注册表

### 注册接口

```typescript
export interface WidgetRegistration {
  widgetType: string;           // 唯一标识
  name: string;                 // 显示名称
  icon: React.ReactNode;        // 图标
  defaultSize: { width: number; height: number };  // 网格单位
  defaultConfig: WidgetConfig;  // 默认配置
  component: React.ComponentType<WidgetComponentProps>;  // React 组件
}

export interface WidgetComponentProps {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
  containerId: string;
  width: number;   // 像素
  height: number;  // 像素
}
```

### 注册表实现

`components/Widget/WidgetRegistry.ts` 维护一个 Map，注册内置小组件：

| widgetType | 名称 | 默认大小 |
|------------|------|----------|
| clock | 时钟 | 2×1 |
| stickyNote | 便签 | 2×2 |
| systemMonitor | 系统监控 | 3×2 |

添加新内置小组件只需：1) 创建 React 组件 2) 在注册表中注册。

## 容器渲染

### Container.tsx 路由扩展

```
game → GameContainer
folder → FolderContainer
iconShow → IconShowContainer
normal → NormalContainer
widget → WidgetContainer  (新增)
```

### WidgetContainer 组件

`components/Widget/WidgetContainer.tsx`：

- 读取 `container.style.config` 中的 `widgetType`
- `widgetType === "custom"` → 渲染 `<CustomWidgetIframe>` 加载本地 HTML
- 其他 → 从 `WidgetRegistry` 查找对应 React 组件渲染
- 容器 header 显示小组件名称，支持重命名

### CustomWidgetIframe 组件

`components/Widget/CustomWidgetIframe.tsx`：

- 使用 `convertFileSrc()` 将本地 HTML 路径转为 Tauri 可加载的 URL
- 渲染 `<iframe src={url} style="background: transparent">`
- 通过 `postMessage` 与 iframe 双向通信

## postMessage 通信协议

### 宿主 → iframe

```typescript
// 渲染/更新
{ type: "render", config: WidgetConfig, width: number, height: number, theme: ThemeInfo }

// 显示配置面板
{ type: "showConfig" }

// 销毁前通知
{ type: "destroy" }
```

### iframe → 宿主

```typescript
// 小组件就绪（可携带元数据）
{ type: "ready", meta?: WidgetMeta }

// 配置变更
{ type: "configChanged", config: Record<string, any> }
```

### ThemeInfo 结构

```typescript
interface ThemeInfo {
  mode: "light" | "dark";
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  variables: Record<string, string>;
}
```

主题切换时宿主重新发送 `render` 消息更新 theme。

## 右键菜单变更

### 桌面空白处右键菜单

"新建"子菜单新增：

```
新建 ─┬─ 新建文件夹
      ├─ 新建文件
      ├─ 新建收纳盒容器
      ├─ 新建游戏容器
      ├─ 新建图标展示容器
      ├─ 新建目录索引容器
      ├─ ─────────
      └─ 新建小组件        ← 新增
```

### Widget 容器右键菜单

```
重命名
小组件设置
移除
```

- "小组件设置"：内置类型打开内置配置面板，自定义类型发送 `showConfig` 消息

## 小组件选择对话框

### 触发方式

桌面右键 → 新建 → 新建小组件

### UI 设计

- 模态对话框，`fixed inset-0 z-[100]`，毛玻璃遮罩，`motion` 动画
- 左侧：小组件列表（内置 + 已导入的自定义），带图标和名称
- 右侧：选中后展示预览效果、简介、默认大小信息
- 底部按钮区：
  - "添加自定义小组件" — 打开文件选择对话框选择 `.html` 文件
  - "创建" — 创建小组件容器

### 自定义小组件导入

1. 点击"添加自定义小组件" → Tauri `invoke` 打开文件选择对话框（`.html` 文件）
2. 选择后创建 Widget 容器，`widgetType: "custom"`，`customHtmlPath` 存入路径
3. iframe 加载后发送 `ready` 消息，宿主读取 `meta` 获取默认大小和名称
4. 自定义小组件的注册信息（路径、名称）持久化到 `settings` 表的 `custom_widgets` 字段

## 默认配置

每个小组件类型独立的默认配置：

- **时钟**：`defaultSize: {2,1}`, `config: { clockStyle: "digital" }`
- **便签**：`defaultSize: {2,2}`, `config: { stickyNoteContent: "", stickyNoteColor: "#ffeb3b" }`
- **系统监控**：`defaultSize: {3,2}`, `config: { refreshInterval: 2, showCpu: true, showMemory: true, showDisk: true }`
- **自定义小组件**：通过 `ready` 消息的 `meta` 声明默认大小，`config` 由 HTML 中的 `configSchema` 定义

## 透明背景支持

- 主 Tauri 窗口已配置 `transparent: true`
- iframe 设置 `background: transparent`，HTML 中 `body { background: transparent }`
- 容器背景通过 `backgroundOpacity: 0` 或容器设置关闭
- 两层独立控制：容器背景和 iframe 背景各自独立

## 文件变更清单

### Rust 后端

| 文件 | 变更 |
|------|------|
| `src-tauri/src/models/container.rs` | `ContainerType` 添加 `Widget` 变体 |
| `src-tauri/src/commands/container.rs` | `create_container` 为 Widget 设置默认 size/style |

### 前端

| 文件 | 变更 |
|------|------|
| `src/types/container.ts` | `ContainerType` 添加 `"widget"` |
| `src/types/widget.ts` | 新建，WidgetConfig/WidgetMeta/ConfigField 类型 |
| `src/stores/widgetStore.ts` | 新建，管理自定义小组件注册 |
| `src/components/Widget/WidgetRegistry.ts` | 新建，小组件注册表 |
| `src/components/Widget/WidgetContainer.tsx` | 新建，小组件容器渲染分发 |
| `src/components/Widget/CustomWidgetIframe.tsx` | 新建，自定义小组件 iframe |
| `src/components/Widget/WidgetSelectorDialog.tsx` | 新建，小组件选择对话框 |
| `src/components/Widget/widgets/ClockWidget.tsx` | 新建，时钟小组件 |
| `src/components/Widget/widgets/StickyNoteWidget.tsx` | 新建，便签小组件 |
| `src/components/Widget/widgets/SystemMonitorWidget.tsx` | 新建，系统监控小组件 |
| `src/components/Container/Container.tsx` | 添加 widget → WidgetContainer 路由 |
| `src/components/Desktop/DesktopLayer.tsx` | 右键菜单添加"新建小组件"，处理创建逻辑 |

### 无需变更

- 数据库表结构（复用现有 containers 表）
- `storage/container_store.rs`（复用容器存储逻辑）
- 网格对齐、拖拽、调整大小逻辑（复用容器系统）

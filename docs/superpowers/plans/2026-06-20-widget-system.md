# 小组件系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 DeskZero 桌面中添加小组件功能，支持内置小组件（时钟、便签、系统监控）和用户自定义 HTML 小组件。

**Architecture:** 小组件作为新的 `ContainerType::Widget` 变体，复用现有容器系统（位置、大小、拖拽、网格对齐、持久化）。内置小组件通过 React 组件渲染，自定义小组件通过 iframe 加载本地 HTML 文件。小组件选择对话框提供创建入口。

**Tech Stack:** React 19, TypeScript, Zustand, Framer Motion, Tauri v2 (Rust), rusqlite

## Global Constraints

- Rust 和 TypeScript 代码注释使用中文
- 前端无 lint、typecheck、test、formatter 脚本，用 `tsc -b`（no emit）做类型检查
- Rust 测试：在 `src-tauri/` 下执行 `cargo test`
- 枚举必须包含 `Other(String)` 变体，手动实现 Serialize/Deserialize
- JSON 序列化的结构体必须包含 `#[serde(flatten)] extra: HashMap<String, serde_json::Value>`
- 禁止全量 DELETE + INSERT，使用 UPSERT + 差异删除
- 高频操作必须防抖（300ms）
- 数据库路径：`%APPDATA%/DeskZero/deskzero.db`
- 提交信息应使用中文

---

## 文件结构

### Rust 后端

| 文件 | 变更类型 | 职责 |
|------|----------|------|
| `src-tauri/src/models/container.rs` | 修改 | ContainerType 添加 Widget 变体 |

### 前端

| 文件 | 变更类型 | 职责 |
|------|----------|------|
| `src/types/container.ts` | 修改 | ContainerType 添加 "widget" |
| `src/types/widget.ts` | 新建 | WidgetConfig、WidgetMeta、ConfigField 类型定义 |
| `src/stores/widgetStore.ts` | 新建 | 管理自定义小组件注册列表 |
| `src/components/Widget/WidgetRegistry.ts` | 新建 | 小组件注册表，注册内置小组件 |
| `src/components/Widget/WidgetContainer.tsx` | 新建 | 小�件容器渲染分发 |
| `src/components/Widget/CustomWidgetIframe.tsx` | 新建 | 自定义小组件 iframe 包装 |
| `src/components/Widget/WidgetSelectorDialog.tsx` | 新建 | 小组件选择对话框 |
| `src/components/Widget/widgets/ClockWidget.tsx` | 新建 | 时钟小组件 |
| `src/components/Widget/widgets/StickyNoteWidget.tsx` | 新建 | 便签小组件 |
| `src/components/Widget/widgets/SystemMonitorWidget.tsx` | 新建 | 系统监控小组件 |
| `src/components/Container/Container.tsx` | 修改 | 添加 widget → WidgetContainer 路由 |
| `src-tauri/src/commands/container.rs` | 修改 | create_container 为 Widget 设置默认 size/style |

---

### Task 1: Rust — ContainerType 添加 Widget 变体

**Files:**
- Modify: `src-tauri/src/models/container.rs`

**Interfaces:**
- Produces: `ContainerType::Widget` 序列化为 `"widget"`，反序列化识别 `"widget"` → Widget

- [ ] **Step 1: 在 ContainerType 枚举中添加 Widget 变体**

在 `src-tauri/src/models/container.rs` 中，在 `IconShow` 之后添加 `Widget`：

```rust
pub enum ContainerType {
    Normal,
    Mapping,
    Folder,
    Game,
    IconShow,
    Widget,  // 新增
    Other(String),
}
```

- [ ] **Step 2: 更新 Serialize 实现**

在 `Serialize for ContainerType` 的 `match` 中添加：

```rust
ContainerType::Widget => "widget",
```

- [ ] **Step 3: 更新 Deserialize 实现**

在 `Deserialize for ContainerType` 的 `match` 中添加：

```rust
"widget" => ContainerType::Widget,
```

- [ ] **Step 4: 验证 Rust 编译通过**

Run: `cargo build` in `src-tauri/`
Expected: 编译成功，无错误

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/models/container.rs
git commit -m "feat: ContainerType 添加 Widget 变体"
```

---

### Task 2: TypeScript 类型定义

**Files:**
- Modify: `src/types/container.ts`
- Create: `src/types/widget.ts`

**Interfaces:**
- Produces: `ContainerType` 包含 `"widget"`
- Produces: `WidgetConfig`, `WidgetMeta`, `ConfigField`, `ThemeInfo`, `WidgetComponentProps` 类型

- [ ] **Step 1: 修改 ContainerType**

在 `src/types/container.ts` 中修改：

```typescript
export type ContainerType = "normal" | "mapping" | "folder" | "game" | "iconShow" | "widget";
```

- [ ] **Step 2: 创建 src/types/widget.ts**

```typescript
import type { Size } from "./container";

export interface WidgetConfig {
  widgetType: string;  // "clock" | "stickyNote" | "systemMonitor" | "custom"
  customHtmlPath?: string;
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

export interface ThemeInfo {
  mode: "light" | "dark";
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  variables: Record<string, string>;
}

export interface WidgetRegistration {
  widgetType: string;
  name: string;
  icon: React.ReactNode;
  defaultSize: Size;
  defaultConfig: WidgetConfig;
  component: React.ComponentType<WidgetComponentProps>;
}

export interface WidgetComponentProps {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
  containerId: string;
  width: number;
  height: number;
}

export interface WidgetToHostMessage {
  type: "ready" | "configChanged";
  meta?: WidgetMeta;
  config?: Record<string, any>;
}

export interface HostToWidgetMessage {
  type: "render" | "showConfig" | "destroy";
  config?: WidgetConfig;
  width?: number;
  height?: number;
  theme?: ThemeInfo;
}
```

- [ ] **Step 3: 验证类型检查**

Run: `tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/types/container.ts src/types/widget.ts
git commit -m "feat: 添加小组件类型定义"
```

---

### Task 3: Rust — create_container 支持 Widget 类型

**Files:**
- Modify: `src-tauri/src/commands/container.rs`

**Interfaces:**
- Consumes: `ContainerType::Widget`（Task 1）
- Produces: Widget 容器创建时使用默认 style（`background_opacity: 0.5`, `cornerRadius: 12`）

- [ ] **Step 1: 为 Widget 类型添加默认配置**

在 `src-tauri/src/commands/container.rs` 的 `create_container` 函数中，在 `IconShow` 分支之后添加：

```rust
} else if container_type == ContainerType::Widget {
    style.background_opacity = 0.5;
    style.cornerRadius = 12.0;
    // Widget 默认大小由前端根据具体小组件类型设置
    // Rust 端使用通用默认值，前端会在创建后根据 widgetType 调整
}
```

- [ ] **Step 2: 验证 Rust 编译通过**

Run: `cargo build` in `src-tauri/`
Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add src-tauri/src/commands/container.rs
git commit -m "feat: create_container 支持 Widget 类型默认配置"
```

---

### Task 4: Widget 注册表

**Files:**
- Create: `src/components/Widget/WidgetRegistry.ts`

**Interfaces:**
- Consumes: `WidgetRegistration`, `WidgetConfig` from `@/types/widget`
- Produces: `widgetRegistry` — Map<string, WidgetRegistration>，提供 `getWidget()`、`getAllWidgets()`、`registerWidget()`

- [ ] **Step 1: 创建注册表**

```typescript
import type { WidgetRegistration, WidgetConfig } from "@/types/widget";
import { ClockWidget } from "./widgets/ClockWidget";
import { StickyNoteWidget } from "./widgets/StickyNoteWidget";
import { SystemMonitorWidget } from "./widgets/SystemMonitorWidget";

const registry = new Map<string, WidgetRegistration>();

export function registerWidget(registration: WidgetRegistration) {
  registry.set(registration.widgetType, registration);
}

export function getWidget(widgetType: string): WidgetRegistration | undefined {
  return registry.get(widgetType);
}

export function getAllWidgets(): WidgetRegistration[] {
  return Array.from(registry.values());
}

export function getDefaultWidgetConfig(widgetType: string): WidgetConfig | undefined {
  const reg = registry.get(widgetType);
  return reg ? { ...reg.defaultConfig } : undefined;
}

// 注册内置小组件
registerWidget({
  widgetType: "clock",
  name: "时钟",
  icon: "Clock",  // 由调用方通过 lucide 图标渲染
  defaultSize: { width: 2, height: 1 },
  defaultConfig: {
    widgetType: "clock",
    config: { clockStyle: "digital" },
  },
  component: ClockWidget,
});

registerWidget({
  widgetType: "stickyNote",
  name: "便签",
  icon: "StickyNote",
  defaultSize: { width: 2, height: 2 },
  defaultConfig: {
    widgetType: "stickyNote",
    config: { content: "", color: "#ffeb3b" },
  },
  component: StickyNoteWidget,
});

registerWidget({
  widgetType: "systemMonitor",
  name: "系统监控",
  icon: "Activity",
  defaultSize: { width: 3, height: 2 },
  defaultConfig: {
    widgetType: "systemMonitor",
    config: { refreshInterval: 2, showCpu: true, showMemory: true, showDisk: true },
  },
  component: SystemMonitorWidget,
});
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Widget/WidgetRegistry.ts
git commit -m "feat: 创建小组件注册表"
```

---

### Task 5: 时钟小组件

**Files:**
- Create: `src/components/Widget/widgets/ClockWidget.tsx`

**Interfaces:**
- Consumes: `WidgetComponentProps` from `@/types/widget`
- Produces: `ClockWidget` React 组件

- [ ] **Step 1: 创建时钟小组件**

```tsx
import { useEffect, useState } from "react";
import type { WidgetComponentProps } from "@/types/widget";

export function ClockWidget({ config, onConfigChange, width, height }: WidgetComponentProps) {
  const [time, setTime] = useState(new Date());
  const clockStyle = config.config?.clockStyle || "digital";

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");
  const dateStr = time.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  if (clockStyle === "analog") {
    const hourDeg = (time.getHours() % 12) * 30 + time.getMinutes() * 0.5;
    const minuteDeg = time.getMinutes() * 6;
    const secondDeg = time.getSeconds() * 6;
    const size = Math.min(width, height) - 16;

    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity={0.3} />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            return (
              <line
                key={i}
                x1={50 + 38 * Math.cos(angle)}
                y1={50 + 38 * Math.sin(angle)}
                x2={50 + 43 * Math.cos(angle)}
                y2={50 + 43 * Math.sin(angle)}
                stroke="currentColor"
                strokeWidth="2"
              />
            );
          })}
          <line
            x1="50" y1="50"
            x2={50 + 25 * Math.cos((hourDeg - 90) * Math.PI / 180)}
            y2={50 + 25 * Math.sin((hourDeg - 90) * Math.PI / 180)}
            stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          />
          <line
            x1="50" y1="50"
            x2={50 + 32 * Math.cos((minuteDeg - 90) * Math.PI / 180)}
            y2={50 + 32 * Math.sin((minuteDeg - 90) * Math.PI / 180)}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          />
          <line
            x1="50" y1="50"
            x2={50 + 36 * Math.cos((secondDeg - 90) * Math.PI / 180)}
            y2={50 + 36 * Math.sin((secondDeg - 90) * Math.PI / 180)}
            stroke="var(--color-accent)" strokeWidth="1" strokeLinecap="round"
          />
          <circle cx="50" cy="50" r="3" fill="var(--color-accent)" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 select-none">
      <div className="text-3xl font-light tracking-wider" style={{ color: "var(--color-text)" }}>
        {hours}:{minutes}
        <span className="text-base opacity-50 ml-1">{seconds}</span>
      </div>
      <div className="text-xs opacity-60" style={{ color: "var(--color-text-secondary)" }}>
        {dateStr}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Widget/widgets/ClockWidget.tsx
git commit -m "feat: 时钟小组件"
```

---

### Task 6: 便签小组件

**Files:**
- Create: `src/components/Widget/widgets/StickyNoteWidget.tsx`

**Interfaces:**
- Consumes: `WidgetComponentProps` from `@/types/widget`
- Produces: `StickyNoteWidget` React 组件

- [ ] **Step 1: 创建便签小组件**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetComponentProps } from "@/types/widget";

export function StickyNoteWidget({ config, onConfigChange, width, height }: WidgetComponentProps) {
  const content = config.config?.content || "";
  const color = config.config?.color || "#ffeb3b";
  const [localContent, setLocalContent] = useState(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = useCallback(
    (value: string) => {
      setLocalContent(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onConfigChange({
          ...config,
          config: { ...config.config, content: value },
        });
      }, 500);
    },
    [config, onConfigChange],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ backgroundColor: color + "cc", borderRadius: 4 }}
    >
      <textarea
        className="flex-1 w-full p-2 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-500"
        placeholder="输入便签内容..."
        value={localContent}
        onChange={(e) => handleChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Widget/widgets/StickyNoteWidget.tsx
git commit -m "feat: 便签小组件"
```

---

### Task 7: 系统监控小组件

**Files:**
- Create: `src/components/Widget/widgets/SystemMonitorWidget.tsx`

**Interfaces:**
- Consumes: `WidgetComponentProps` from `@/types/widget`, Tauri `invoke` 调用系统信息
- Produces: `SystemMonitorWidget` React 组件
- 后端需要提供获取系统信息的命令（见 Step 2）

- [ ] **Step 1: 创建系统监控小组件前端**

```tsx
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { WidgetComponentProps } from "@/types/widget";

interface SystemInfo {
  cpuUsage: number;
  memoryUsed: number;
  memoryTotal: number;
  diskUsed: number;
  diskTotal: number;
}

export function SystemMonitorWidget({ config, width, height }: WidgetComponentProps) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const interval = config.config?.refreshInterval || 2;
  const showCpu = config.config?.showCpu !== false;
  const showMemory = config.config?.showMemory !== false;
  const showDisk = config.config?.showDisk !== false;

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const data = await invoke<SystemInfo>("get_system_info");
        setInfo(data);
      } catch (e) {
        console.error("获取系统信息失败:", e);
      }
    };
    fetchInfo();
    const timer = setInterval(fetchInfo, interval * 1000);
    return () => clearInterval(timer);
  }, [interval]);

  if (!info) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
        加载中...
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const items: { label: string; value: string; percent: number; color: string }[] = [];
  if (showCpu) {
    items.push({
      label: "CPU",
      value: `${info.cpuUsage.toFixed(1)}%`,
      percent: info.cpuUsage,
      color: info.cpuUsage > 80 ? "#ef4444" : info.cpuUsage > 60 ? "#f59e0b" : "#22c55e",
    });
  }
  if (showMemory) {
    const memPercent = (info.memoryUsed / info.memoryTotal) * 100;
    items.push({
      label: "内存",
      value: `${formatBytes(info.memoryUsed)} / ${formatBytes(info.memoryTotal)}`,
      percent: memPercent,
      color: memPercent > 80 ? "#ef4444" : memPercent > 60 ? "#f59e0b" : "#3b82f6",
    });
  }
  if (showDisk) {
    const diskPercent = (info.diskUsed / info.diskTotal) * 100;
    items.push({
      label: "磁盘",
      value: `${formatBytes(info.diskUsed)} / ${formatBytes(info.diskTotal)}`,
      percent: diskPercent,
      color: diskPercent > 90 ? "#ef4444" : diskPercent > 70 ? "#f59e0b" : "#8b5cf6",
    });
  }

  return (
    <div className="w-full h-full flex flex-col justify-center gap-2 p-3 text-xs">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="font-medium opacity-80">{item.label}</span>
            <span className="opacity-60">{item.value}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, item.percent)}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Rust — 添加 get_system_info 命令**

在 `src-tauri/src/commands/system.rs` 中添加：

```rust
use sysinfo::System;

#[derive(serde::Serialize)]
pub struct SystemInfo {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub disk_used: u64,
    pub disk_total: u64,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_usage = sys.global_cpu_usage();
    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();

    let (disk_used, disk_total) = sys.disks().iter()
        .filter(|d| d.mount_point() == std::path::Path::new("/"))
        .map(|d| (d.total_space() - d.available_space(), d.total_space()))
        .next()
        .unwrap_or_else(|| {
            sys.disks().iter()
                .map(|d| (d.total_space() - d.available_space(), d.total_space()))
                .fold((0, 0), |(a_used, a_total), (used, total)| (a_used + used, a_total + total))
        });

    Ok(SystemInfo {
        cpu_usage,
        memory_used,
        memory_total,
        disk_used,
        disk_total,
    })
}
```

然后在 `lib.rs` 的 `invoke_handler` 中注册 `get_system_info`。

注意：需要检查 `Cargo.toml` 是否已有 `sysinfo` 依赖，如没有需添加 `sysinfo = "0.30"`。

- [ ] **Step 3: 注册命令**

在 `src-tauri/src/lib.rs` 的 `generate_handler![]` 中添加 `get_system_info`。

- [ ] **Step 4: 验证编译**

Run: `cargo build` in `src-tauri/`
Expected: 编译成功

- [ ] **Step 5: 提交**

```bash
git add src/components/Widget/widgets/SystemMonitorWidget.tsx src-tauri/src/commands/system.rs src-tauri/src/lib.rs
git commit -m "feat: 系统监控小组件"
```

---

### Task 8: CustomWidgetIframe 组件

**Files:**
- Create: `src/components/Widget/CustomWidgetIframe.tsx`

**Interfaces:**
- Consumes: `WidgetConfig`, `ThemeInfo` from `@/types/widget`, `convertFileSrc` from `@tauri-apps/api/core`
- Produces: `CustomWidgetIframe` React 组件，通过 `postMessage` 与 iframe 双向通信

- [ ] **Step 1: 创建 CustomWidgetIframe**

```tsx
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { WidgetConfig, WidgetMeta, ThemeInfo } from "@/types/widget";
import { useSettingsStore } from "@/stores/settingsStore";

interface CustomWidgetIframeProps {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
  containerId: string;
  width: number;
  height: number;
}

export function CustomWidgetIframe({
  config,
  onConfigChange,
  containerId,
  width,
  height,
}: CustomWidgetIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const { settings } = useSettingsStore();

  const htmlPath = config.customHtmlPath;
  if (!htmlPath) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
        未指定 HTML 文件路径
      </div>
    );
  }

  const src = convertFileSrc(htmlPath);

  // 构建 ThemeInfo
  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const computedStyle = getComputedStyle(document.documentElement);
  const theme: ThemeInfo = {
    mode: isDark ? "dark" : "light",
    accentColor: settings.accentColor || "#0078d4",
    backgroundColor: computedStyle.getPropertyValue("--color-bg").trim() || (isDark ? "#1a1a1a" : "#ffffff"),
    textColor: computedStyle.getPropertyValue("--color-text").trim() || (isDark ? "#ffffff" : "#1f2937"),
    borderColor: computedStyle.getPropertyValue("--color-border").trim() || (isDark ? "#333333" : "#e5e7eb"),
    variables: {
      "--color-accent": settings.accentColor || "#0078d4",
    },
  };

  // 向 iframe 发送消息
  const postToIframe = (message: any) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  };

  // 监听 iframe 消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "ready") {
        setIsReady(true);
        // 立即发送渲染数据
        postToIframe({
          type: "render",
          config: config.config,
          width,
          height,
          theme,
        });
      } else if (data.type === "configChanged" && data.config) {
        onConfigChange({
          ...config,
          config: { ...config.config, ...data.config },
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [config, width, height, theme, onConfigChange]);

  // 当 config/size/theme 变化时重新发送
  useEffect(() => {
    if (isReady) {
      postToIframe({
        type: "render",
        config: config.config,
        width,
        height,
        theme,
      });
    }
  }, [isReady, config.config, width, height, theme]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      className="w-full h-full border-0"
      style={{ background: "transparent", pointerEvents: "auto" }}
      sandbox="allow-scripts allow-same-origin"
      title="自定义小组件"
    />
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Widget/CustomWidgetIframe.tsx
git commit -m "feat: 自定义小组件 iframe 包装"
```

---

### Task 9: WidgetContainer 组件

**Files:**
- Create: `src/components/Widget/WidgetContainer.tsx`

**Interfaces:**
- Consumes: `Container` from `@/types/container`, `WidgetConfig` from `@/types/widget`, `getWidget` from `WidgetRegistry`, `CustomWidgetIframe`
- Produces: `WidgetContainer` React 组件 — 小�件容器渲染分发

- [ ] **Step 1: 创建 WidgetContainer**

组件结构参考 `GameContainer.tsx`，包含：
- 拖拽（useDrag hook，网格对齐）
- 双向调整大小
- 右键菜单（重命名、小组件设置、移除）
- 根据 `widgetType` 分发渲染：内置小组件从注册表查找 React 组件，自定义小组件渲染 `CustomWidgetIframe`

```tsx
import { motion } from "framer-motion";
import { Edit2, Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDrag } from "@/hooks/useDrag";
import { ConfirmDialog } from "@/components/UI/ConfirmDialog";
import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import type { MenuItem } from "@/components/ContextMenu/ContextMenu";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Container as ContainerType } from "@/types/container";
import type { WidgetConfig } from "@/types/widget";
import { cn } from "@/utils/cn";
import { hexToRgb } from "@/utils/color";
import { getWidget, getDefaultWidgetConfig } from "./WidgetRegistry";
import { CustomWidgetIframe } from "./CustomWidgetIframe";

interface WidgetContainerProps {
  container: ContainerType;
}

export function WidgetContainer({ container }: WidgetContainerProps) {
  const {
    updateContainerPosition,
    updateContainerSize,
    updateContainerStyle,
    deleteContainer,
    updateContainerName,
  } = useContainerStore();
  const { settings } = useSettingsStore();
  const { wallpaper } = useDesktopStore();
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const [resizePosOffset, setResizePosOffset] = useState({ x: 0, y: 0 });
  const resizeOffsetRef = useRef({ x: 0, y: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(container.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuState, setMenuState] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  // 从 style 中读取 widgetConfig，或使用默认值
  const widgetConfig: WidgetConfig = (container.style as any).config || getDefaultWidgetConfig("clock")!;

  // 网格对齐拖拽
  const { ref, pos, isDragging, listeners } = useDrag(container.position, {
    dragHandleRef,
    onDragEnd: (newPos) => {
      const gw = settings.gridWidth || 80;
      const gh = settings.gridHeight || 104;
      const gx = settings.gridGapX ?? 20;
      const gy = settings.gridGapY ?? 20;
      const stepX = gw + gx;
      const stepY = gh + gy;
      const snapX = Math.round(Math.max(0, newPos.x - 10) / stepX) * stepX + 10;
      const snapY = Math.round(Math.max(0, newPos.y - 10) / stepY) * stepY + 10;
      updateContainerPosition(container.id, { x: snapX, y: snapY });
    },
  });

  // 双向调整大小
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState(container.size);

  useEffect(() => {
    setSize(container.size);
  }, [container.size.width, container.size.height]);

  useEffect(() => {
    setEditNameValue(container.name);
  }, [container.name]);

  const handleDelete = async () => {
    await deleteContainer(container.id);
  };

  const contextMenuItems: MenuItem[] = [
    {
      label: "重命名",
      icon: <Edit2 size={14} />,
      onClick: () => setIsEditingName(true),
    },
    {
      label: "小组件设置",
      icon: <Settings size={14} />,
      onClick: () => {
        if (widgetConfig.widgetType === "custom") {
          // 自定义小组件：向 iframe 发送 showConfig
          // 通过事件通知 CustomWidgetIframe
          window.dispatchEvent(
            new CustomEvent("widget-show-config", { detail: { containerId: container.id } }),
          );
        } else {
          setIsSettingsOpen(true);
        }
      },
    },
    {
      label: "移除",
      icon: <Trash2 size={14} />,
      onClick: () => setShowDeleteConfirm(true),
    },
  ];

  const sizeRef = useRef(size);
  sizeRef.current = size;
  const commitResize = () => {
    updateContainerSize(container.id, {
      width: sizeRef.current.width,
      height: sizeRef.current.height,
    });
  };

  const handleResizePointerDown = (
    e: React.PointerEvent,
    direction: "br" | "bl",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startPosX = pos.x;
    const startPosY = pos.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (direction === "br") {
        const newWidth = Math.max(60, startWidth + deltaX);
        const newHeight = Math.max(60, startHeight + deltaY);
        setSize({ width: newWidth, height: newHeight });
      } else if (direction === "bl") {
        const newWidth = Math.max(60, startWidth - deltaX);
        const newHeight = Math.max(60, startHeight + deltaY);
        const possiblePosX = startPosX + deltaX;
        if (newWidth > 60 && possiblePosX >= 0) {
          setSize({ width: newWidth, height: newHeight });
          setResizePosOffset({ x: deltaX, y: 0 });
          resizeOffsetRef.current = { x: deltaX, y: 0 };
        }
      }
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      if (direction === "bl") {
        const finalX = Math.max(0, startPosX + resizeOffsetRef.current.x);
        updateContainerPosition(container.id, { x: finalX, y: startPosY });
        setResizePosOffset({ x: 0, y: 0 });
        resizeOffsetRef.current = { x: 0, y: 0 };
      }
      commitResize();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // 样式计算
  const isDarkBg =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const bgOpacity = container.style.backgroundOpacity ?? 0.5;
  const customBackground =
    container.style.backgroundColor === "theme" || !container.style.backgroundColor
      ? `rgba(var(--color-container-bg-rgb), ${bgOpacity})`
      : container.style.backgroundColor.startsWith("#")
        ? `rgba(${hexToRgb(container.style.backgroundColor)}, ${bgOpacity})`
        : container.style.backgroundColor;

  const isCustomBgDark =
    container.style.backgroundColor !== "theme" &&
    container.style.backgroundColor &&
    container.style.backgroundColor.startsWith("#")
      ? isColorDark(container.style.backgroundColor)
      : isDarkBg;
  const headerColor = isCustomBgDark ? "#ffffff" : "#1f2937";
  const textShadow = isCustomBgDark
    ? "0 1px 2px rgba(0,0,0,0.5)"
    : "0 1px 1px rgba(255,255,255,0.5)";

  const cornerRadius = container.style.cornerRadius ?? 12;

  // 查找注册的小组件
  const widgetReg = getWidget(widgetConfig.widgetType);

  // 小组件配置变更处理
  const handleWidgetConfigChange = (newConfig: WidgetConfig) => {
    updateContainerStyle(container.id, { config: newConfig } as any);
  };

  return (
    <>
      <motion.div
        ref={ref}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          x: pos.x + resizePosOffset.x,
          y: pos.y + resizePosOffset.y,
          width: size.width,
          height: size.height,
          borderRadius: cornerRadius,
          zIndex: isDragging || isResizing ? 40 : 10,
          backgroundColor:
            settings.wallpaperCompatible && settings.globalBlur && wallpaper
              ? "transparent"
              : customBackground,
          backdropFilter:
            !settings.wallpaperCompatible && settings.globalBlur
              ? "var(--backdrop-blur)"
              : "none",
          WebkitBackdropFilter:
            !settings.wallpaperCompatible && settings.globalBlur
              ? "var(--backdrop-blur)"
              : "none",
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: isDragging ? 0.9 : 1, scale: 1 }}
        className={cn(
          "flex flex-col overflow-hidden transition-colors border shadow-xl select-none relative",
          "border-[var(--color-border)]",
          isDragging && "shadow-2xl ring-1 ring-black/10 dark:ring-white/10",
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuState({ visible: true, x: e.clientX, y: e.clientY });
        }}
      >
        {/* 壁纸模糊层 */}
        {settings.wallpaperCompatible && settings.globalBlur && wallpaper && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: -1, borderRadius: "inherit" }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${wallpaper})`,
                backgroundPosition: `calc(0px - ${pos.x + resizePosOffset.x}px) calc(0px - ${pos.y + resizePosOffset.y}px)`,
                backgroundSize: "100vw 100vh",
                filter: "blur(20px)",
              }}
            />
            <div className="absolute inset-0" style={{ backgroundColor: customBackground }} />
          </div>
        )}

        {/* Header */}
        {container.style.showHeader !== false && (
          <div
            ref={dragHandleRef}
            {...listeners}
            className="flex items-center justify-center px-2 py-1 transition-colors cursor-move touch-none relative min-h-[24px]"
            style={{ backgroundColor: "transparent" }}
          >
            {isEditingName ? (
              <input
                autoFocus
                className="bg-white/50 dark:bg-black/50 text-[var(--color-text)] px-1 outline-none rounded text-xs font-medium text-center w-32 relative z-10"
                style={{ color: headerColor }}
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={() => {
                  setIsEditingName(false);
                  updateContainerName(container.id, editNameValue.trim());
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsEditingName(false);
                    updateContainerName(container.id, editNameValue.trim());
                  } else if (e.key === "Escape") {
                    setIsEditingName(false);
                    setEditNameValue(container.name);
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="cursor-pointer max-w-[80%] truncate text-xs font-medium transition-colors"
                style={{ color: headerColor, textShadow, opacity: settings.textOpacity ?? 1.0 }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              >
                {container.name}
              </div>
            )}
          </div>
        )}

        {/* Body — 小�件内容 */}
        <div className="relative flex-1 overflow-hidden">
          {widgetReg ? (
            <widgetReg.component
              config={widgetConfig}
              onConfigChange={handleWidgetConfigChange}
              containerId={container.id}
              width={size.width}
              height={size.height - (container.style.showHeader !== false ? 24 : 0)}
            />
          ) : widgetConfig.widgetType === "custom" ? (
            <CustomWidgetIframe
              config={widgetConfig}
              onConfigChange={handleWidgetConfigChange}
              containerId={container.id}
              width={size.width}
              height={size.height - (container.style.showHeader !== false ? 24 : 0)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
              未知小组件类型: {widgetConfig.widgetType}
            </div>
          )}
        </div>

        {/* 调整大小手柄 */}
        <div
          className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 opacity-0 hover:opacity-100 transition-opacity"
          onPointerDown={(e) => handleResizePointerDown(e, "bl")}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)] transform -scale-x-100">
            <polyline points="22 12 22 22 12 22" /><line x1="22" y1="22" x2="12" y2="12" />
          </svg>
        </div>
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 opacity-0 hover:opacity-100 transition-opacity"
          onPointerDown={(e) => handleResizePointerDown(e, "br")}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
            <polyline points="22 12 22 22 12 22" /><line x1="22" y1="22" x2="12" y2="12" />
          </svg>
        </div>
      </motion.div>

      {/* 右键菜单 */}
      {menuState.visible && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={contextMenuItems}
          onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="移除小组件"
        message={`确定要移除「${container.name}」吗？`}
        confirmLabel="移除"
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await handleDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

function isColorDark(hex: string) {
  let c = hex.substring(1).split("");
  if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  const cNum = Number("0x" + c.join(""));
  const r = (cNum >> 16) & 255;
  const g = (cNum >> 8) & 255;
  const b = cNum & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Widget/WidgetContainer.tsx
git commit -m "feat: WidgetContainer 小�件容器渲染分发"
```

---

### Task 10: Container.tsx 路由扩展

**Files:**
- Modify: `src/components/Container/Container.tsx`

**Interfaces:**
- Consumes: `WidgetContainer` from `./WidgetContainer`
- Produces: `container.type === "widget"` 路由到 `WidgetContainer`

- [ ] **Step 1: 添加 import 和路由**

在 `Container.tsx` 中添加 import：

```typescript
import { WidgetContainer } from "./WidgetContainer";
```

在 `Container` 函数的路由分发中，在 `iconShow` 之后添加：

```typescript
if (container.type === "widget") {
  return <WidgetContainer container={container} />;
}
```

- [ ] **Step 2: 验证类型检查**

Run: `tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/Container/Container.tsx
git commit -m "feat: Container 路由添加 widget 类型"
```

---

### Task 11: widgetStore — 自定义小组件管理

**Files:**
- Create: `src/stores/widgetStore.ts`

**Interfaces:**
- Produces: `useWidgetStore` — 管理已导入的自定义小组件列表（路径、名称、元数据）
- 持久化到 settings 表的 `custom_widgets` 字段

- [ ] **Step 1: 创建 widgetStore**

```typescript
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { WidgetMeta } from "@/types/widget";

export interface CustomWidgetEntry {
  htmlPath: string;
  name: string;
  meta?: WidgetMeta;
}

interface WidgetState {
  customWidgets: CustomWidgetEntry[];
  isLoading: boolean;

  fetchCustomWidgets: () => Promise<void>;
  addCustomWidget: (entry: CustomWidgetEntry) => void;
  removeCustomWidget: (htmlPath: string) => void;
  updateCustomWidgetMeta: (htmlPath: string, meta: WidgetMeta) => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const persistCustomWidgets = (widgets: CustomWidgetEntry[]) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      const settings = await invoke<any>("load_settings");
      settings.customWidgets = widgets;
      await invoke("save_settings", { settings });
    } catch (e) {
      console.error("持久化自定义小组件列表失败:", e);
    }
  }, 300);
};

export const useWidgetStore = create<WidgetState>((set, get) => ({
  customWidgets: [],
  isLoading: false,

  fetchCustomWidgets: async () => {
    set({ isLoading: true });
    try {
      const settings = await invoke<any>("load_settings");
      set({ customWidgets: settings.customWidgets || [] });
    } catch (e) {
      console.error("加载自定义小组件列表失败:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  addCustomWidget: (entry) => {
    set((state) => {
      const exists = state.customWidgets.some((w) => w.htmlPath === entry.htmlPath);
      if (exists) return state;
      const updated = [...state.customWidgets, entry];
      persistCustomWidgets(updated);
      return { customWidgets: updated };
    });
  },

  removeCustomWidget: (htmlPath) => {
    set((state) => {
      const updated = state.customWidgets.filter((w) => w.htmlPath !== htmlPath);
      persistCustomWidgets(updated);
      return { customWidgets: updated };
    });
  },

  updateCustomWidgetMeta: (htmlPath, meta) => {
    set((state) => {
      const updated = state.customWidgets.map((w) =>
        w.htmlPath === htmlPath ? { ...w, meta } : w,
      );
      persistCustomWidgets(updated);
      return { customWidgets: updated };
    });
  },
}));
```

- [ ] **Step 2: 提交**

```bash
git add src/stores/widgetStore.ts
git commit -m "feat: widgetStore 自定义小组件管理"
```

---

### Task 12: WidgetSelectorDialog 小组件选择对话框

**Files:**
- Create: `src/components/Widget/WidgetSelectorDialog.tsx`

**Interfaces:**
- Consumes: `getAllWidgets` from `WidgetRegistry`, `useWidgetStore` from `widgetStore`, `useContainerStore` from `containerStore`
- Produces: `WidgetSelectorDialog` React 组件

- [ ] **Step 1: 创建对话框组件**

模态对话框，参考 SettingsPage 中的 License Dialog 模式：

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Clock, StickyNote, Activity, Plus, X, FileCode } from "lucide-react";
import { useState } from "react";
import { getAllWidgets, getDefaultWidgetConfig } from "./WidgetRegistry";
import { useWidgetStore, type CustomWidgetEntry } from "@/stores/widgetStore";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useToastStore } from "@/stores/toastStore";
import type { Position, Size } from "@/types/container";
import type { WidgetConfig } from "@/types/widget";

interface WidgetSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
}

const iconMap: Record<string, React.ReactNode> = {
  clock: <Clock size={20} />,
  stickyNote: <StickyNote size={20} />,
  systemMonitor: <Activity size={20} />,
  custom: <FileCode size={20} />,
};

export function WidgetSelectorDialog({
  isOpen,
  onClose,
  position,
}: WidgetSelectorDialogProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const builtInWidgets = getAllWidgets();
  const { customWidgets, addCustomWidget } = useWidgetStore();
  const createContainer = useContainerStore((s) => s.createContainer);
  const fetchContainers = useContainerStore((s) => s.fetchContainers);

  const handleCreate = async () => {
    if (!selectedType) return;

    try {
      const reg = builtInWidgets.find((w) => w.widgetType === selectedType);
      if (reg) {
        // 内置小组件
        const container = await createContainer(
          reg.name,
          "widget",
          position,
        );
        // 设置小组件配置
        const widgetConfig = { ...reg.defaultConfig };
        const { updateContainerStyle } = useContainerStore.getState();
        updateContainerStyle(container.id, { config: widgetConfig } as any);

        // 根据默认大小调整容器尺寸
        const settings = useDesktopStore.getState();
        const gw = 80; // 从 settings 读取
        const gh = 104;
        const gx = 20;
        const gy = 20;
        const stepX = gw + gx;
        const stepY = gh + gy;
        const { updateContainerSize } = useContainerStore.getState();
        updateContainerSize(container.id, {
          width: reg.defaultSize.width * stepX - gx,
          height: reg.defaultSize.height * stepY - gy,
        });

        fetchContainers();
        useToastStore.getState().addToast(`已创建${reg.name}小组件`, "success");
      }
    } catch (e: any) {
      useToastStore.getState().addToast("创建小组件失败: " + String(e), "error");
    }
    onClose();
  };

  const handleAddCustom = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        filters: [{ name: "HTML 文件", extensions: ["html", "htm"] }],
        multiple: false,
        title: "选择自定义小组件 HTML 文件",
      });
      if (selected) {
        const htmlPath = Array.isArray(selected) ? selected[0] : selected;
        const fileName = htmlPath.substring(
          Math.max(htmlPath.lastIndexOf("\\"), htmlPath.lastIndexOf("/")) + 1,
        );
        const entry: CustomWidgetEntry = {
          htmlPath,
          name: fileName.replace(/\.html?$/i, ""),
        };
        addCustomWidget(entry);

        // 创建自定义小组件容器
        const container = await createContainer(entry.name, "widget", position);
        const widgetConfig: WidgetConfig = {
          widgetType: "custom",
          customHtmlPath: htmlPath,
          config: {},
        };
        const { updateContainerStyle } = useContainerStore.getState();
        updateContainerStyle(container.id, { config: widgetConfig } as any);

        fetchContainers();
        useToastStore.getState().addToast(`已添加自定义小组件: ${entry.name}`, "success");
      }
    } catch (e: any) {
      useToastStore.getState().addToast("添加自定义小组件失败: " + String(e), "error");
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative bg-[var(--color-bg)] rounded-xl shadow-2xl border border-[var(--color-border)] w-[520px] max-h-[480px] flex flex-col overflow-hidden"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-medium">选择小组件</h2>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* 小组件列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs font-medium opacity-60 mb-2">内置小组件</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {builtInWidgets.map((w) => (
                  <button
                    key={w.widgetType}
                    onClick={() => setSelectedType(w.widgetType)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      selectedType === w.widgetType
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
                    }`}
                  >
                    <div className="text-[var(--color-text)]">
                      {iconMap[w.widgetType] || <Monitor size={20} />}
                    </div>
                    <span className="text-xs">{w.name}</span>
                    <span className="text-[10px] opacity-40">
                      {w.defaultSize.width}×{w.defaultSize.height}
                    </span>
                  </button>
                ))}
              </div>

              {/* 自定义小组件 */}
              <div className="text-xs font-medium opacity-60 mb-2">自定义小组件</div>
              <div className="grid grid-cols-3 gap-2">
                {customWidgets.map((w) => (
                  <button
                    key={w.htmlPath}
                    onClick={() => setSelectedType("custom")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      selectedType === "custom"
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
                    }`}
                  >
                    <FileCode size={20} />
                    <span className="text-xs truncate max-w-full">{w.name}</span>
                  </button>
                ))}
                <button
                  onClick={handleAddCustom}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-all"
                >
                  <Plus size={20} className="opacity-40" />
                  <span className="text-xs opacity-60">导入 HTML</span>
                </button>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedType}
                className="px-4 py-1.5 text-xs rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-40 transition-opacity"
              >
                创建
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Widget/WidgetSelectorDialog.tsx
git commit -m "feat: 小组件选择对话框"
```

---

### Task 13: 右键菜单集成

**Files:**
- Modify: `src/components/Desktop/DesktopLayer.tsx`

**Interfaces:**
- Consumes: `WidgetSelectorDialog` from `WidgetSelectorDialog`
- Produces: 桌面右键菜单"新建"子菜单添加"新建小组件"项

- [ ] **Step 1: 添加 import**

在 `DesktopLayer.tsx` 中添加：

```typescript
import { WidgetSelectorDialog } from "@/components/Widget/WidgetSelectorDialog";
import { Puzzle } from "lucide-react";
```

- [ ] **Step 2: 添加状态**

在 `DesktopLayer` 组件中添加状态：

```typescript
const [widgetSelectorOpen, setWidgetSelectorOpen] = useState(false);
const [widgetSelectorPos, setWidgetSelectorPos] = useState<Position>({ x: 0, y: 0 });
```

- [ ] **Step 3: 在"新建"子菜单中添加小组件项**

在"新建目录索引容器"菜单项之后、`subItems` 数组结束之前添加：

```typescript
{ divider: true },
{
  label: "新建小组件",
  icon: <Puzzle size={14} />,
  onClick: () => {
    setWidgetSelectorPos({ x: menuState.x, y: menuState.y });
    setWidgetSelectorOpen(true);
  },
},
```

- [ ] **Step 4: 渲染 WidgetSelectorDialog**

在 `DesktopLayer` 的 return 语句末尾添加：

```tsx
<WidgetSelectorDialog
  isOpen={widgetSelectorOpen}
  onClose={() => setWidgetSelectorOpen(false)}
  position={widgetSelectorPos}
/>
```

- [ ] **Step 5: 验证类型检查**

Run: `tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/components/Desktop/DesktopLayer.tsx
git commit -m "feat: 右键菜单添加新建小组件"
```

---

### Task 14: 端到端验证

- [ ] **Step 1: 启动开发模式**

Run: `npm run tauri dev`
Expected: 应用启动，无错误

- [ ] **Step 2: 测试内置小组件创建**

1. 桌面右键 → 新建 → 新建小组件
2. 选择"时钟" → 点击"创建"
3. 桌面出现时钟小组件容器
4. 验证：拖拽、调整大小、重命名、右键菜单正常

- [ ] **Step 3: 测试便签和系统监控**

重复上述步骤创建便签和系统监控小组件，验证各自功能正常。

- [ ] **Step 4: 测试自定义小组件**

1. 创建一个简单的 HTML 文件（如 `test-widget.html`）：
```html
<!DOCTYPE html>
<html><body style="background:transparent;color:white;font-size:20px;text-align:center;padding:20px;">
<div id="content">Hello Widget!</div>
<script>
window.addEventListener("message", (e) => {
  if (e.data.type === "render") {
    document.getElementById("content").innerText = "收到配置: " + JSON.stringify(e.data.config);
  }
});
window.parent.postMessage({ type: "ready", meta: { name: "测试", defaultWidth: 2, defaultHeight: 1 } }, "*");
</script></body></html>
```
2. 桌面右键 → 新建 → 新建小组件 → 导入 HTML → 选择文件
3. 验证自定义小组件显示正常

- [ ] **Step 5: 类型检查**

Run: `tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 6: Rust 编译检查**

Run: `cargo build` in `src-tauri/`
Expected: 编译成功

- [ ] **Step 7: 最终提交**

```bash
git add -A
git commit -m "feat: 小组件系统完成"
```

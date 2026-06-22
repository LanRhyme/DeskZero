# 自定义小组件开发指南

DeskZero 支持通过加载本地 HTML 文件来创建自定义小组件。本文档介绍如何编写一个兼容 DeskZero 的自定义小组件。

## 快速开始

创建一个 `.html` 文件，包含完整的 HTML/CSS/JavaScript，然后通过右键菜单「新建小组件 → 选择本地 HTML 文件」导入。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text-color, #1f2937);
      background: transparent;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div id="app">Hello, DeskZero!</div>
  <script>
    // 通知宿主：小组件已准备好
    window.parent.postMessage({ type: "ready" }, "*");

    // 接收宿主消息
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "render") {
        // data.config   — 小组件配置（用户数据）
        // data.width    — 容器宽度（px）
        // data.height   — 容器高度（px）
        // data.theme    — 主题信息
        console.log("渲染:", data.width, "x", data.height, data.theme.mode);
      }
    });
  </script>
</body>
</html>
```

## 通信协议

自定义小组件通过 `window.parent.postMessage` 与 DeskZero 通信。

### 小组件 → 宿主（DeskZero）

```js
// 1. 小组件加载完成，通知宿主
window.parent.postMessage({ type: "ready" }, "*");

// 2. 小组件配置变更，通知宿主保存
window.parent.postMessage({
  type: "configChanged",
  config: { key: "newValue" }
}, "*");

// 3. 调用 Tauri 命令（需用户授权 IPC 权限）
window.parent.postMessage({
  type: "invoke",
  id: "req-1",
  command: "get_system_info",
  args: {}
}, "*");

// 4. 请求打开设置面板
window.parent.postMessage({ type: "showConfig" }, "*");
```

| 消息类型 | 必需字段 | 说明 |
|---------|---------|------|
| `ready` | `type` | 小组件加载完成，宿主会立即发送 `render` 消息 |
| `configChanged` | `type`, `config` | 配置变更，`config` 为 `Record<string, any>`，宿主会自动保存 |
| `invoke` | `type`, `id`, `command` | 调用 Tauri 命令（需用户授权 IPC 权限） |
| `showConfig` | `type` | 请求宿主打开小组件设置面板 |

### 宿主 → 小组件

```js
window.addEventListener("message", (event) => {
  const data = event.data;
  if (data.type === "render") {
    const { config, width, height, theme } = data;
  } else if (data.type === "invokeResult") {
    // Tauri 命令调用结果
    if (data.error) {
      console.error("调用失败:", data.error);
    } else {
      console.log("调用成功:", data.result);
    }
  }
});
```

| 消息类型 | 字段 | 说明 |
|---------|------|------|
| `render` | `config`, `width`, `height`, `theme` | 宿主请求小组件渲染，config 为用户保存的数据 |
| `destroy` | — | 小组件即将被销毁 |
| `invokeResult` | `id`, `result?`, `error?` | Tauri 命令调用结果，`id` 与请求对应 |

### `theme` 对象结构

```js
{
  mode: "light" | "dark",       // 当前主题模式
  accentColor: "#0078d4",       // 强调色
  backgroundColor: "#1a1a1a",   // 背景色
  textColor: "#ffffff",         // 文字颜色
  borderColor: "#333333",       // 边框颜色
  variables: {                  // CSS 变量
    "--color-accent": "#0078d4"
  }
}
```

### `config` 对象

`config` 是一个自由的键值对对象，用于存储小组件的用户数据。宿主会自动持久化此数据。

```js
// 读取配置
if (data.type === "render") {
  const note = data.config.note || "";
  const color = data.config.color || "#ffeb3b";
}

// 保存配置
window.parent.postMessage({
  type: "configChanged",
  config: { note: "用户输入的内容", color: "#ff9800" }
}, "*");
```

## 主题适配

小组件应支持亮色/暗色主题。推荐方式：

```css
body {
  color: var(--text-color, #1f2937);
}
```

```js
window.addEventListener("message", (event) => {
  if (event.data.type === "render") {
    const { theme } = event.data;
    document.documentElement.style.setProperty("--text-color", theme.textColor);
    document.documentElement.style.setProperty("--bg-color", theme.backgroundColor);
    // 或使用 theme.variables["--color-accent"]
  }
});
```

## 背景透明

小组件的背景默认透明。如果你的小组件不需要背景色，可以直接使用透明背景，这样小组件会与桌面壁纸融合。

如果需要半透明背景：

```css
body {
  background: rgba(30, 30, 30, 0.6);
  backdrop-filter: blur(20px);
}
```

## 调用 Tauri 命令（IPC 桥接）

自定义小组件可以通过 `invoke` 消息调用 DeskZero 的 Tauri 命令，访问文件系统、系统信息等本地能力。

### 权限

- 导入小组件时，DeskZero 会弹出安全确认对话框
- 用户确认后，该小组件获得 IPC 权限
- 未授权的小组件调用 `invoke` 会收到错误响应
- 用户也可以在右键菜单中为已导入的小组件追加授权

### 使用方式

```js
// 调用 Tauri 命令
const requestId = "req-" + Date.now();
window.parent.postMessage({
  type: "invoke",
  id: requestId,
  command: "get_system_info",
  args: {}
}, "*");

// 接收结果
window.addEventListener("message", (event) => {
  const data = event.data;
  if (data.type === "invokeResult" && data.id === requestId) {
    if (data.error) {
      console.error("调用失败:", data.error);
    } else {
      console.log("系统信息:", data.result);
    }
  }
});
```

### 注意事项

- `id` 字段用于匹配请求和响应，建议使用唯一值
- `command` 为 Tauri 命令名称，与后端 `#[tauri::command]` 函数名对应
- `args` 为命令参数，`Record<string, any>` 类型
- 调用失败时 `error` 字段包含错误信息

### 可用的 Tauri 命令

以下是小组件常用的命令列表：

#### 系统信息

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `get_system_info` | 无 | `{ cpu_brand, cpu_cores, cpu_threads, total_memory, used_memory, ... }` | 获取系统信息 |
| `get_settings` | 无 | `Settings` | 获取全局设置 |
| `get_wallpaper_base64` | 无 | `string` | 获取当前壁纸的 Base64 |

#### 天气

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `get_weather` | 无 | `{ temperature, condition, humidity, wind, forecast, ... }` | 获取天气数据 |

#### 音乐控制

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `get_music_status` | 无 | `{ title, artist, album, is_playing, progress, duration, ... }` | 获取当前播放状态 |
| `music_play_pause` | 无 | 无 | 播放/暂停 |
| `music_next` | 无 | 无 | 下一曲 |
| `music_prev` | 无 | 无 | 上一曲 |
| `music_seek` | `{ position_ms: number }` | 无 | 跳转到指定位置 |

#### 待办事项

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `get_todo_items` | `{ container_id: string }` | `TodoItem[]` | 获取待办列表 |
| `add_todo_item` | `{ item: TodoItem }` | 无 | 添加待办 |
| `update_todo_item` | `{ item: TodoItem }` | 无 | 更新待办 |
| `delete_todo_item` | `{ id: string }` | 无 | 删除待办 |

#### 倒计日

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `get_countdown_events` | 无 | `CountdownEvent[]` | 获取倒计日事件 |
| `add_countdown_event` | `{ event: CountdownEvent }` | 无 | 添加事件 |
| `delete_countdown_event` | `{ id: string }` | 无 | 删除事件 |

#### 日历

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `get_calendar_events` | `{ container_id, year, month }` | `CalendarEvent[]` | 获取指定月份的日历事件 |
| `add_calendar_event` | `{ event: CalendarEvent }` | 无 | 添加日历事件 |
| `delete_calendar_event` | `{ id: string }` | 无 | 删除日历事件 |

#### 文件操作

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `open_file` | `{ path: string }` | 无 | 打开文件 |
| `get_desktop_dir` | 无 | `string` | 获取桌面路径 |
| `read_shortcut_url` | `{ path: string }` | `string` | 读取快捷方式目标路径 |
| `check_files_exist` | `{ paths: string[] }` | `string[]` | 检查文件是否存在，返回不存在的路径 |

## 声明式配置面板（configSchema）

小组件可以通过 `ready` 消息的 `meta.configSchema` 字段声明配置项，DeskZero 会自动生成原生设置面板。

### 支持的字段类型

| 类型 | 说明 | UI 组件 | 额外属性 |
|------|------|---------|----------|
| `text` | 文本输入 | TextInput | — |
| `number` | 数字输入 | Slider（指定 min/max）或 NumberInput | `min`, `max`, `step` |
| `color` | 颜色选择 | ColorPicker | — |
| `select` | 分段选择 | SegmentedControl | `options: [{ label, value }]` |
| `toggle` | 开关 | SwitchToggle | — |

### 使用方式

```js
// 在 ready 消息中声明配置项
window.parent.postMessage({
  type: "ready",
  meta: {
    name: "我的小组件",
    defaultWidth: 2,
    defaultHeight: 1,
    configSchema: [
      { key: "title", label: "标题", type: "text", default: "Hello" },
      { key: "fontSize", label: "字体大小", type: "number", default: 14, min: 10, max: 24, step: 1 },
      { key: "color", label: "主题色", type: "color", default: "#3b82f6" },
      { key: "layout", label: "布局", type: "select", default: "horizontal",
        options: [
          { label: "水平", value: "horizontal" },
          { label: "垂直", value: "vertical" }
        ]
      },
      { key: "showIcon", label: "显示图标", type: "toggle", default: true }
    ]
  }
}, "*");

// 接收配置变更（用户在设置面板中修改后，宿主会通过 render 消息推送）
window.addEventListener("message", (event) => {
  if (event.data.type === "render") {
    const { config } = event.data;
    // config.title, config.fontSize, config.color 等
    applyConfig(config);
  }
});
```

### 打开设置面板

小组件可以主动请求打开设置面板：

```js
window.parent.postMessage({ type: "showConfig" }, "*");
```

用户也可以通过右键菜单 → "小组件设置" 打开。

## 完整示例

### 示例 1：系统信息小组件（IPC 桥接）

通过 `invoke` 调用 `get_system_info` 获取 CPU、内存信息并显示。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: transparent;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 16px;
      color: var(--text-color, #1f2937);
    }
    .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
    .label { opacity: 0.6; }
    .bar-bg { height: 4px; background: rgba(128,128,128,0.2); border-radius: 2px; margin-top: 2px; }
    .bar-fg { height: 100%; border-radius: 2px; background: var(--accent, #3b82f6); transition: width 0.3s; }
    h3 { font-size: 13px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <h3>系统信息</h3>
  <div id="info">加载中...</div>
  <script>
    let timer = null;

    window.parent.postMessage({ type: "ready" }, "*");

    window.addEventListener("message", (event) => {
      const data = event.data;

      if (data.type === "render") {
        document.documentElement.style.setProperty("--text-color", data.theme.textColor);
        document.documentElement.style.setProperty("--accent", data.theme.variables["--color-accent"]);
        // 每次 render 时刷新数据
        fetchSystemInfo();
      } else if (data.type === "invokeResult" && data.id === "sysinfo") {
        renderInfo(data.result);
      }
    });

    function fetchSystemInfo() {
      window.parent.postMessage({
        type: "invoke",
        id: "sysinfo",
        command: "get_system_info"
      }, "*");
    }

    function renderInfo(info) {
      if (!info) return;
      const memPercent = Math.round((info.used_memory / info.total_memory) * 100);
      document.getElementById("info").innerHTML = `
        <div class="row"><span class="label">CPU</span><span>${info.cpu_brand}</span></div>
        <div class="row"><span class="label">核心</span><span>${info.cpu_cores} 核 ${info.cpu_threads} 线程</span></div>
        <div class="row"><span class="label">内存</span><span>${(info.used_memory/1024).toFixed(1)} / ${(info.total_memory/1024).toFixed(1)} GB</span></div>
        <div class="bar-bg"><div class="bar-fg" style="width:${memPercent}%"></div></div>
      `;
    }
  </script>
</body>
</html>
```

### 示例 2：带配置面板的小组件（configSchema）

通过 `configSchema` 声明配置项，用户可在设置面板中修改颜色、刷新间隔等。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: transparent;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
    }
    #quote { font-size: 14px; text-align: center; padding: 12px; max-width: 90%; }
    #author { font-size: 11px; opacity: 0.5; }
    .settings-btn {
      position: absolute; top: 8px; right: 8px;
      width: 24px; height: 24px; border-radius: 50%;
      background: rgba(128,128,128,0.15); border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 12px; opacity: 0; transition: opacity 0.2s;
    }
    body:hover .settings-btn { opacity: 0.6; }
    .settings-btn:hover { opacity: 1 !important; }
  </style>
</head>
<body>
  <div id="quote">加载中...</div>
  <div id="author"></div>
  <button class="settings-btn" onclick="window.parent.postMessage({type:'showConfig'},'*')" title="设置">⚙</button>
  <script>
    const quotes = [
      { text: "生活不是等待暴风雨过去，而是学会在雨中翩翩起舞。", author: "佚名" },
      { text: "千里之行，始于足下。", author: "老子" },
      { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
      { text: "人生如逆旅，我亦是行人。", author: "苏轼" },
      { text: "不积跬步，无以至千里。", author: "荀子" },
    ];

    let config = { color: "#3b82f6", fontSize: 14, showAuthor: true, interval: 30 };
    let timer = null;

    // 带 configSchema 的 ready 消息
    window.parent.postMessage({
      type: "ready",
      meta: {
        name: "名言小组件",
        defaultWidth: 3,
        defaultHeight: 1,
        configSchema: [
          { key: "color", label: "主题色", type: "color", default: "#3b82f6" },
          { key: "fontSize", label: "字体大小", type: "number", default: 14, min: 10, max: 24, step: 1 },
          { key: "showAuthor", label: "显示作者", type: "toggle", default: true },
          { key: "interval", label: "刷新间隔(秒)", type: "number", default: 30, min: 5, max: 300, step: 5 }
        ]
      }
    }, "*");

    window.addEventListener("message", (event) => {
      const data = event.data;
      if (data.type === "render") {
        config = { ...config, ...data.config };
        document.documentElement.style.setProperty("--text-color", data.theme.textColor);
        applyConfig();
        refreshQuote();
      }
    });

    function applyConfig() {
      document.getElementById("quote").style.fontSize = config.fontSize + "px";
      document.getElementById("quote").style.color = config.color;
      document.getElementById("author").style.display = config.showAuthor ? "block" : "none";
      // 重置定时器
      if (timer) clearInterval(timer);
      timer = setInterval(refreshQuote, (config.interval || 30) * 1000);
    }

    function refreshQuote() {
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      document.getElementById("quote").textContent = `"${q.text}"`;
      document.getElementById("author").textContent = `— ${q.author}`;
    }
  </script>
</body>
</html>
```

### 示例 3：便签小组件（configChanged + 主题适配）

基础的配置保存与主题适配。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    textarea {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      resize: none;
      padding: 16px;
      font-size: 14px;
      color: inherit;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <textarea id="note" placeholder="输入便签内容..."></textarea>
  <script>
    const note = document.getElementById("note");
    let debounceTimer = null;

    // 通知宿主就绪
    window.parent.postMessage({ type: "ready" }, "*");

    // 接收宿主消息
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (data.type === "render") {
        // 恢复保存的内容
        if (data.config.content !== undefined) {
          note.value = data.config.content;
        }
        // 应用主题
        document.body.style.color = data.theme.textColor;
      }
    });

    // 输入时防抖保存
    note.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        window.parent.postMessage({
          type: "configChanged",
          config: { content: note.value }
        }, "*");
      }, 500);
    });
  </script>
</body>
</html>
```

## 注意事项

1. **不要依赖外部资源** — CDN 引用在 DeskZero 中不可用，所有资源必须内联
2. **响应式布局** — 小组件大小可由用户调整，请使用百分比或 `vw`/`vh` 单位
3. **首次 `render`** — 收到第一个 `render` 消息前，`config` 可能为空，请提供默认值
4. **拖拽行为** — 点击 `textarea`、`input` 等输入元素时，DeskZero 会自动跳过拖拽，无需手动处理
5. **安全沙箱** — iframe 使用 `sandbox="allow-scripts allow-same-origin"`，不支持 `alert`、`confirm` 等弹窗
6. **IPC 权限** — 调用 `invoke` 前确保用户已授权，未授权时会返回错误
7. **configSchema** — `default` 值必须提供，它决定了设置面板的初始状态和首次渲染的默认值

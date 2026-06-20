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
```

| 消息类型 | 必需字段 | 说明 |
|---------|---------|------|
| `ready` | `type` | 小组件加载完成，宿主会立即发送 `render` 消息 |
| `configChanged` | `type`, `config` | 配置变更，`config` 为 `Record<string, any>`，宿主会自动保存 |

### 宿主 → 小组件

```js
window.addEventListener("message", (event) => {
  const data = event.data;
  if (data.type === "render") {
    const { config, width, height, theme } = data;
  }
});
```

| 消息类型 | 字段 | 说明 |
|---------|------|------|
| `render` | `config`, `width`, `height`, `theme` | 宿主请求小组件渲染，config 为用户保存的数据 |
| `destroy` | — | 小组件即将被销毁 |

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

## 注意事项

1. **不要依赖外部资源** — CDN 引用在 DeskZero 中不可用，所有资源必须内联
2. **响应式布局** — 小组件大小可由用户调整，请使用百分比或 `vw`/`vh` 单位
3. **首次 `render`** — 收到第一个 `render` 消息前，`config` 可能为空，请提供默认值
4. **拖拽行为** — 点击 `textarea`、`input` 等输入元素时，DeskZero 会自动跳过拖拽，无需手动处理
5. **安全沙箱** — iframe 使用 `sandbox="allow-scripts allow-same-origin"`，不支持 `alert`、`confirm` 等弹窗

## 完整示例：便签小组件

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
        document.body.style.backgroundColor = (data.config.color || "#ffeb3b") + "cc";
        document.body.style.color = data.theme.mode === "dark" ? "#1f2937" : "#1f2937";
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

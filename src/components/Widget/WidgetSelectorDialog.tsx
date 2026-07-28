import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Clock, StickyNote, Activity, Plus, X, FileCode, Quote, Timer, ListTodo, CalendarDays, CloudSun, Music, Sparkles, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getAllWidgets } from "./WidgetRegistry";

import { useWidgetStore, type CustomWidgetEntry } from "@/stores/widgetStore";
import { useContainerStore } from "@/stores/containerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { useMonitorStore } from "@/stores/monitorStore";
import { ConfirmDialog } from "@/components/UI/ConfirmDialog";
import type { Position } from "@/types/container";
import type { WidgetConfig } from "@/types/widget";

interface WidgetSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
}

const iconMap: Record<string, React.ReactNode> = {
  clock: <Clock size={24} />,
  stickyNote: <StickyNote size={24} />,
  systemMonitor: <Activity size={24} />,
  hitokoto: <Quote size={24} />,
  countdown: <Timer size={24} />,
  todo: <ListTodo size={24} />,
  calendar: <CalendarDays size={24} />,
  weather: <CloudSun size={24} />,
  music: <Music size={24} />,
  custom: <FileCode size={24} />,
};

function generateDevPrompt(userIdea: string, lang: string): string {
  const isZh = lang.startsWith("zh");

  const spec = [
    "## 1. " + (isZh ? "基本约束" : "Basic Constraints"),
    "",
    "- " + (isZh ? "输出一个完整的、可直接使用的单文件 HTML（包含所有 CSS 和 JS）" : "Output a single complete HTML file (all CSS and JS inline)"),
    "- " + (isZh ? "禁止引用任何外部资源（CDN、外部字体、外部图片等），所有资源必须内联" : "No external resources (CDN, external fonts, images, etc.) — everything must be inlined"),
    "- " + (isZh ? "背景默认透明（background: transparent），小组件会叠加在桌面壁纸之上" : "Background must be transparent by default (background: transparent), the widget overlays on the desktop wallpaper"),
    "- " + (isZh ? "使用响应式布局（百分比、vw/vh、flex），因为用户可以自由拖拽调整大小" : "Use responsive layout (percentages, vw/vh, flex) because users can freely resize the widget"),
    "- " + (isZh ? "必须同时兼容亮色和暗色主题（通过 theme 对象切换）" : "Must support both light and dark themes (switch via the theme object)"),
    "- " + (isZh ? "不要使用 alert()、confirm()、prompt()，这些在沙箱 iframe 中被禁用" : "Do NOT use alert(), confirm(), or prompt() — these are blocked in the sandbox iframe"),
    "- " + (isZh ? "textarea、input 等输入元素会自动禁用拖拽，无需手动处理" : "textarea, input elements automatically disable dragging — no manual handling needed"),
    "",
    "## 2. " + (isZh ? "生命周期与通信协议" : "Lifecycle & Communication Protocol"),
    "",
    isZh ? "小组件运行在沙箱 iframe 中，通过 window.parent.postMessage 与 DeskZero 宿主通信。" : "The widget runs in a sandboxed iframe and communicates with the DeskZero host via window.parent.postMessage.",
    "",
    "### 2.1 " + (isZh ? "初始化" : "Initialization"),
    "",
    isZh ? "小组件加载完成后，必须发送 ready 消息通知宿主。宿主收到后会立即发送 render 消息。" : "After loading, the widget MUST send a ready message. The host will immediately respond with a render message.",
    "",
    "```js",
    "// " + (isZh ? "最简形式" : "Minimal form"),
    'window.parent.postMessage({ type: "ready" }, "*");',
    "",
    "// " + (isZh ? "带元数据（推荐）：声明名称、默认大小（网格单位）、配置面板 schema" : "With metadata (recommended): declare name, default size (grid units), and config schema"),
    "window.parent.postMessage({",
    '  type: "ready",',
    "  meta: {",
    isZh ? '    name: "我的小组件",' : '    name: "My Widget",',
    "    defaultWidth: 2,    // " + (isZh ? "网格列数" : "grid columns"),
    "    defaultHeight: 1,   // " + (isZh ? "网格行数" : "grid rows"),
    "    configSchema: [     // " + (isZh ? "可选，声明后宿主自动生成设置面板" : "optional — host auto-generates a settings panel from this"),
    isZh ? '      { key: "color", label: "主题色", type: "color", default: "#3b82f6" },' : '      { key: "color", label: "Theme Color", type: "color", default: "#3b82f6" },',
    isZh ? '      { key: "fontSize", label: "字体大小", type: "number", default: 14, min: 10, max: 24, step: 1 },' : '      { key: "fontSize", label: "Font Size", type: "number", default: 14, min: 10, max: 24, step: 1 },',
    isZh ? '      { key: "title", label: "标题", type: "text", default: "Hello" },' : '      { key: "title", label: "Title", type: "text", default: "Hello" },',
    isZh ? '      { key: "showIcon", label: "显示图标", type: "toggle", default: true },' : '      { key: "showIcon", label: "Show Icon", type: "toggle", default: true },',
    isZh ? '      { key: "layout", label: "布局", type: "select", default: "horizontal",' : '      { key: "layout", label: "Layout", type: "select", default: "horizontal",',
    isZh ? '        options: [{ label: "水平", value: "horizontal" }, { label: "垂直", value: "vertical" }]' : '        options: [{ label: "Horizontal", value: "horizontal" }, { label: "Vertical", value: "vertical" }]',
    "      }",
    "    ]",
    "  }",
    "}, \"*\");",
    "```",
    "",
    "configSchema " + (isZh ? "支持的字段类型：" : "supported field types:"),
    "- text: " + (isZh ? "文本输入框" : "text input"),
    "- number: " + (isZh ? "数字输入（有 min+max 时渲染为滑块，否则为数字步进器）" : "number input (renders as slider when min+max are set, otherwise as a stepper)"),
    "- color: " + (isZh ? "颜色选择器" : "color picker"),
    "- select: " + (isZh ? "分段选择按钮（需提供 options 数组）" : "segmented control (requires options array)"),
    "- toggle: " + (isZh ? "开关" : "switch"),
    "",
    "### 2.2 " + (isZh ? "接收渲染请求" : "Receiving Render Requests"),
    "",
    isZh ? "宿主会在初始化和配置/尺寸/主题变化时发送 render 消息：" : "The host sends render messages on init and whenever config/size/theme changes:",
    "",
    "```js",
    'window.addEventListener("message", (event) => {',
    "  const data = event.data;",
    '  if (data.type === "render") {',
    "    const { config, width, height, theme } = data;",
    "    // config  — " + (isZh ? "用户配置数据（Record<string, any>），首次可能为空对象 {}" : "user config data (Record<string, any>), may be {} on first render"),
    "    // width   — " + (isZh ? "容器宽度（像素）" : "container width in pixels"),
    "    // height  — " + (isZh ? "容器高度（像素）" : "container height in pixels"),
    "    // theme   — " + (isZh ? "主题信息（见下方）" : "theme info (see below)"),
    "  }",
    "});",
    "```",
    "",
    "theme " + (isZh ? "对象结构：" : "object structure:"),
    "```js",
    "{",
    '  mode: "light" | "dark",',
    '  accentColor: "#0078d4",',
    '  backgroundColor: "#1a1a1a",',
    '  textColor: "#ffffff",',
    '  borderColor: "#333333",',
    '  variables: { "--color-accent": "#0078d4" }',
    "}",
    "```",
    "",
    "### 2.3 " + (isZh ? "保存配置" : "Saving Config"),
    "",
    isZh ? "用户修改配置后，通过 configChanged 消息通知宿主自动持久化：" : "When the user modifies config, notify the host to persist it:",
    "",
    "```js",
    "window.parent.postMessage({",
    '  type: "configChanged",',
    isZh ? '  config: { content: "新内容", color: "#ff9800" }' : '  config: { content: "new value", color: "#ff9800" }',
    "}, \"*\");",
    "```",
    "",
    isZh ? "config 是一个自由的键值对对象。建议使用防抖（300-500ms）避免高频写入。" : "config is a free-form key-value object. Use debounce (300-500ms) for high-frequency updates.",
    "",
    "### 2.4 " + (isZh ? "请求打开设置面板" : "Opening the Settings Panel"),
    "",
    isZh ? "如果小组件声明了 configSchema，可以主动请求打开设置面板：" : "If the widget declared a configSchema, it can request to open the settings panel:",
    "",
    "```js",
    'window.parent.postMessage({ type: "showConfig" }, "*");',
    "```",
    "",
    "### 2.5 " + (isZh ? "调用 Tauri 命令（IPC 桥接）" : "Calling Tauri Commands (IPC Bridge)"),
    "",
    isZh
      ? "小组件可以调用 DeskZero 的后端命令来访问系统能力。需要用户在导入时授权 IPC 权限。"
      : "The widget can call DeskZero backend commands to access system capabilities. The user must grant IPC permission when importing.",
    "",
    "```js",
    "// " + (isZh ? "发起调用" : "Make a call"),
    'const reqId = "req-" + Date.now();',
    "window.parent.postMessage({",
    '  type: "invoke",',
    "  id: reqId,",
    '  command: "get_system_info",',
    "  args: {}",
    "}, \"*\");",
    "",
    "// " + (isZh ? "接收结果" : "Receive the result"),
    'window.addEventListener("message", (event) => {',
    "  const data = event.data;",
    '  if (data.type === "invokeResult" && data.id === reqId) {',
    "    if (data.error) {",
    isZh ? '      console.error("调用失败:", data.error);' : '      console.error("Call failed:", data.error);',
    "    } else {",
    isZh ? '      console.log("结果:", data.result);' : '      console.log("Result:", data.result);',
    "    }",
    "  }",
    "});",
    "```",
    "",
    isZh
      ? "id 字段用于匹配请求和响应，建议每次调用使用唯一值。command 为后端 #[tauri::command] 函数名。args 为命令参数。"
      : "id is used to match requests with responses — use a unique value each time. command is the backend #[tauri::command] function name. args is the command parameters.",
    "",
    "## 3. " + (isZh ? "可用的 Tauri 命令" : "Available Tauri Commands"),
    "",
    "### " + (isZh ? "系统" : "System"),
    "| " + (isZh ? "命令" : "Command") + " | " + (isZh ? "参数" : "Args") + " | " + (isZh ? "返回值说明" : "Return Description") + " |",
    "|------|------|------|",
    "| get_system_info | " + (isZh ? "无" : "none") + " | { cpu_brand, cpu_cores, cpu_threads, total_memory, used_memory, ... } |",
    "| get_settings | " + (isZh ? "无" : "none") + " | " + (isZh ? "全局设置对象" : "Global settings object") + " |",
    "| get_wallpaper_base64 | " + (isZh ? "无" : "none") + " | " + (isZh ? "当前壁纸的 Base64 字符串" : "Current wallpaper as Base64 string") + " |",
    "",
    "### " + (isZh ? "天气" : "Weather"),
    "| get_weather | " + (isZh ? "无" : "none") + " | { temperature, condition, humidity, wind, forecast[], ... } |",
    "",
    "### " + (isZh ? "音乐" : "Music"),
    "| get_music_status | " + (isZh ? "无" : "none") + " | { title, artist, album, is_playing, progress_ms, duration_ms, ... } |",
    "| music_play_pause | " + (isZh ? "无" : "none") + " | " + (isZh ? "切换播放/暂停" : "Toggle play/pause") + " |",
    "| music_next | " + (isZh ? "无" : "none") + " | " + (isZh ? "下一曲" : "Next track") + " |",
    "| music_prev | " + (isZh ? "无" : "none") + " | " + (isZh ? "上一曲" : "Previous track") + " |",
    "| music_seek | { position_ms } | " + (isZh ? "跳转到指定位置" : "Seek to position") + " |",
    "",
    "### " + (isZh ? "待办" : "Todo"),
    "| get_todo_items | { container_id } | TodoItem[] |",
    "| add_todo_item | { item } | " + (isZh ? "添加待办" : "Add todo") + " |",
    "| update_todo_item | { item } | " + (isZh ? "更新待办" : "Update todo") + " |",
    "| delete_todo_item | { id } | " + (isZh ? "删除待办" : "Delete todo") + " |",
    "| reorder_todo_items | { ids } | " + (isZh ? "重新排序" : "Reorder") + " |",
    "",
    "### " + (isZh ? "倒计日" : "Countdown"),
    "| get_countdown_events | " + (isZh ? "无" : "none") + " | CountdownEvent[] |",
    "| add_countdown_event | { event } | " + (isZh ? "添加事件" : "Add event") + " |",
    "| update_countdown_event | { event } | " + (isZh ? "更新事件" : "Update event") + " |",
    "| delete_countdown_event | { id } | " + (isZh ? "删除事件" : "Delete event") + " |",
    "",
    "### " + (isZh ? "日历" : "Calendar"),
    "| get_calendar_events | { container_id, year, month } | CalendarEvent[] |",
    "| add_calendar_event | { event } | " + (isZh ? "添加事件" : "Add event") + " |",
    "| delete_calendar_event | { id } | " + (isZh ? "删除事件" : "Delete event") + " |",
    "",
    "### " + (isZh ? "文件" : "File"),
    "| open_file | { path } | " + (isZh ? "打开文件" : "Open file") + " |",
    "| get_desktop_dir | " + (isZh ? "无" : "none") + " | " + (isZh ? "桌面路径字符串" : "Desktop path string") + " |",
    "| read_shortcut_url | { path } | " + (isZh ? "快捷方式目标路径" : "Shortcut target URL") + " |",
    "| check_files_exist | { paths } | " + (isZh ? "返回不存在的路径数组" : "Returns array of non-existent paths") + " |",
    "| create_folder | { path } | " + (isZh ? "创建文件夹" : "Create folder") + " |",
    "| create_empty_file | { path } | " + (isZh ? "创建空文件" : "Create empty file") + " |",
    "",
    "## 4. " + (isZh ? "主题适配示例" : "Theme Adaptation Example"),
    "",
    "```js",
    'window.addEventListener("message", (event) => {',
    "  if (event.data.type === \"render\") {",
    "    const { theme, config, width, height } = event.data;",
    "    const root = document.documentElement;",
    '    root.style.setProperty("--text-color", theme.textColor);',
    '    root.style.setProperty("--bg-color", theme.backgroundColor);',
    '    root.style.setProperty("--border-color", theme.borderColor);',
    '    root.style.setProperty("--accent", theme.variables["--color-accent"]);',
    "    // " + (isZh ? "渲染内容..." : "render content..."),
    "  }",
    "});",
    "```",
    "",
    "```css",
    "body {",
    "  color: var(--text-color, #1f2937);",
    "  background: transparent;",
    "}",
    ".card {",
    "  background: rgba(from var(--bg-color) r g b / 0.6);",
    "  backdrop-filter: blur(20px);",
    "  border: 1px solid var(--border-color);",
    "  border-radius: 12px;",
    "}",
    "```",
    "",
    "## 5. " + (isZh ? "输出要求" : "Output Requirements"),
    "",
    "- " + (isZh ? "输出完整的 HTML 代码，用 ```html 代码块包裹" : "Output complete HTML code wrapped in a ```html code block"),
    "- " + (isZh ? "代码简洁、有适当中文注释" : "Code should be clean, with appropriate comments"),
    "- " + (isZh ? "configSchema 中的 key 必须与代码中读取 config 时使用的 key 完全一致" : "configSchema keys MUST exactly match the keys used when reading config in code"),
    "- " + (isZh ? "如果功能需要调用 Tauri 命令，在 HTML 注释中注明需要 IPC 权限" : "If the feature requires Tauri commands, note in an HTML comment that IPC permission is needed"),
    "- " + (isZh ? "config 的 default 值必须提供，它是设置面板的初始状态和首次渲染的默认值" : "config default values MUST be provided — they determine the settings panel initial state and first-render defaults"),
  ].join("\n");

  if (isZh) {
    return `# 任务

为 DeskZero 桌面应用编写一个自定义小组件。请根据下方的开发规范和用户需求，输出一个完整的单文件 HTML。

# 用户需求

${userIdea}

# DeskZero 自定义小组件开发规范

${spec}`;
  }

  return `# Task

Write a custom widget for the DeskZero desktop app. Follow the development spec and user requirements below to produce a single complete HTML file.

# User Requirements

${userIdea}

# DeskZero Custom Widget Development Spec

${spec}`;
}

export function WidgetSelectorDialog({
  isOpen,
  onClose,
  position,
}: WidgetSelectorDialogProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const builtInWidgets = getAllWidgets();
  const { t, i18n } = useTranslation();

  const [showIpcConfirm, setShowIpcConfirm] = useState(false);
  const [pendingCustomPath, setPendingCustomPath] = useState<string | null>(null);
  const [pendingCustomName, setPendingCustomName] = useState<string>("");

  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [copied, setCopied] = useState(false);

  const { customWidgets, addCustomWidget, removeCustomWidget } = useWidgetStore();
  const createContainer = useContainerStore((s) => s.createContainer);
  const { currentMonitorId, getMonitorById, monitors } = useMonitorStore();
  const settings = useSettingsStore.getState().settings;
  const preferPrimary = settings.dialogMonitorPreference === "primary";
  let monitor = monitors.find(m => m.isPrimary) ?? monitors[0];
  if (!preferPrimary && currentMonitorId) {
    monitor = getMonitorById(currentMonitorId) || monitor;
  }
  const monitorStyle: React.CSSProperties = monitor ? {
    left: monitor.x,
    top: monitor.y,
    width: monitor.width,
    height: monitor.height,
  } : { inset: 0 };

  const handleCreate = async () => {
    if (!selectedType) return;

    try {
      if (selectedType === "custom" && pendingCustomPath) {
        const { settings: s } = useSettingsStore.getState();
        const gw = s.gridWidth || 80;
        const gh = s.gridHeight || 104;
        const gx = s.gridGapX ?? 20;
        const gy = s.gridGapY ?? 20;
        const stepX = gw + gx;
        const stepY = gh + gy;
        
        const container = await createContainer(
          pendingCustomName || t("widget.custom"),
          "widget",
          position,
        );
        
        const widgetConfig: WidgetConfig = {
          widgetType: "custom",
          customHtmlPath: pendingCustomPath,
          config: {},
        };
        const { updateContainerStyle, updateContainerSize } = useContainerStore.getState();
        updateContainerStyle(container.id, { config: widgetConfig } as any);
        updateContainerSize(container.id, {
          width: 2 * stepX - gx,
          height: 2 * stepY - gy,
        });

        const updated = useContainerStore.getState().containers.find(c => c.id === container.id);
        if (updated) {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("update_container_full", { container: updated });
        }
        useToastStore.getState().addToast(t("widget.created", { name: pendingCustomName }), "success");
      } else {
        const reg = builtInWidgets.find((w) => w.widgetType === selectedType);
        if (reg) {
          const { settings: s } = useSettingsStore.getState();
          const gw = s.gridWidth || 80;
          const gh = s.gridHeight || 104;
          const gx = s.gridGapX ?? 20;
          const gy = s.gridGapY ?? 20;
          const stepX = gw + gx;
          const stepY = gh + gy;
          const widgetConfig = { ...reg.defaultConfig };

          const container = await createContainer(
            t(reg.name),
            "widget",
            position,
          );

          const { updateContainerStyle, updateContainerSize } = useContainerStore.getState();
          updateContainerStyle(container.id, { config: widgetConfig } as any);
          updateContainerSize(container.id, {
            width: reg.defaultSize.width * stepX - gx,
            height: reg.defaultSize.height * stepY - gy,
          });

          const updated = useContainerStore.getState().containers.find(c => c.id === container.id);
          if (updated) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("update_container_full", { container: updated });
          }

          useToastStore.getState().addToast(t("widget.created", { name: t(reg.name) }), "success");
        }
      }
    } catch (e: any) {
      useToastStore.getState().addToast(t("widget.createFailed") + String(e), "error");
    }
    onClose();
  };

  const handleAddCustom = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        filters: [{ name: t("widget.htmlFile"), extensions: ["html", "htm"] }],
        multiple: false,
        title: t("widget.selectHtml"),
      });
      if (selected) {
        const htmlPath = Array.isArray(selected) ? selected[0] : selected;
        const fileName = htmlPath.substring(
          Math.max(htmlPath.lastIndexOf("\\"), htmlPath.lastIndexOf("/")) + 1,
        );
        setPendingCustomPath(htmlPath);
        setPendingCustomName(fileName.replace(/\.html?$/i, ""));
        setShowIpcConfirm(true);
      }
    } catch (e: any) {
      useToastStore.getState().addToast(t("widget.addCustomFailed") + String(e), "error");
    }
  };

  const confirmAddCustom = async (ipcEnabled: boolean) => {
    setShowIpcConfirm(false);
    if (!pendingCustomPath) return;

    try {
      const entry: CustomWidgetEntry = {
        htmlPath: pendingCustomPath,
        name: pendingCustomName,
        ipcEnabled,
      };
      addCustomWidget(entry);

      const container = await createContainer(pendingCustomName, "widget", position);
      const widgetConfig: WidgetConfig = {
        widgetType: "custom",
        customHtmlPath: pendingCustomPath,
        config: {},
      };
      const { updateContainerStyle } = useContainerStore.getState();
      updateContainerStyle(container.id, { config: widgetConfig } as any);

      const updated = useContainerStore.getState().containers.find(c => c.id === container.id);
      if (updated) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("update_container_full", { container: updated });
      }

      useToastStore.getState().addToast(t("widget.addedCustom", { name: pendingCustomName }), "success");
    } catch (e: any) {
      useToastStore.getState().addToast(t("widget.addCustomFailed") + String(e), "error");
    }
    setPendingCustomPath(null);
    setPendingCustomName("");
    onClose();
  };

  const handleCopyPrompt = async () => {
    const prompt = generateDevPrompt(promptInput, i18n.language);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = prompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    useToastStore.getState().addToast(t("widget.customWidget.copied"), "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && !showPromptDialog && (
        <motion.div
          className="fixed z-[100] flex items-center justify-center"
          style={monitorStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl rounded-xl shadow-2xl border border-black/5 dark:border-white/10 ring-1 ring-black/5 w-[460px] max-h-[420px] flex flex-col overflow-hidden"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5">
              <h2 className="text-sm font-medium text-[var(--color-text)]">{t("widget.addWidget")}</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
              >
                <X size={14} />
              </button>
            </div>

            {/* 小组件列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 hidden-native-scrollbar relative">
              {/* 内置小组件 */}
              <div>
                <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2.5">
                  {t("widget.builtin")}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {builtInWidgets.map((w) => (
                    <button
                      key={w.widgetType}
                      onClick={() => setSelectedType(w.widgetType)}
                      className={`group flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all duration-200 ${
                        selectedType === w.widgetType
                          ? "bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/25"
                          : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-[var(--color-text)]"
                      }`}
                    >
                      <div className={selectedType === w.widgetType ? "text-white" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors"}>
                        {iconMap[w.widgetType] || <Monitor size={24} />}
                      </div>
                      <span className="text-xs font-medium">{t(w.name)}</span>
                      <span className={`text-[10px] ${selectedType === w.widgetType ? "text-white/70" : "text-[var(--color-text-secondary)] opacity-50"}`}>
                        {w.defaultSize.width}×{w.defaultSize.height}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义小组件 */}
              <div>
                <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2.5">
                  {t("widget.custom")}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {customWidgets.map((w) => (
                    <div key={w.htmlPath} className="relative group">
                      <button
                        onClick={() => {
                          setSelectedType("custom");
                          setPendingCustomPath(w.htmlPath);
                          setPendingCustomName(w.name);
                        }}
                        className={`flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all duration-200 w-full ${
                          selectedType === "custom" && pendingCustomPath === w.htmlPath
                            ? "bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/25"
                            : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-[var(--color-text)]"
                        }`}
                      >
                        <FileCode size={24} className={selectedType === "custom" && pendingCustomPath === w.htmlPath ? "text-white" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors"} />
                        <span className="text-xs font-medium truncate max-w-full">{w.name}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomWidget(w.htmlPath);
                          if (pendingCustomPath === w.htmlPath) {
                            setSelectedType(null);
                            setPendingCustomPath(null);
                          }
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 dark:bg-white/60 hover:bg-red-500 dark:hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title={t("common.delete")}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddCustom}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-dashed border-black/10 dark:border-white/10 hover:border-[var(--color-accent)]/40 transition-all duration-200 text-[var(--color-text-secondary)]"
                  >
                    <Plus size={24} className="opacity-30" />
                    <span className="text-xs opacity-50">{t("widget.importHtml")}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* 底部按钮 */}
            <div className="flex justify-between items-center px-5 py-3.5 border-t border-black/5 dark:border-white/5">
              <button
                onClick={() => setShowPromptDialog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20 hover:opacity-90 transition-opacity"
              >
                <Sparkles size={14} />
                {t("widget.customWidget.genPrompt")}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs rounded-lg border border-transparent bg-black/5 dark:bg-white/5 text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!selectedType}
                  className="px-4 py-1.5 text-xs rounded-lg border border-transparent bg-[var(--color-accent)] text-white disabled:opacity-40 transition-all shadow-md shadow-[var(--color-accent)]/25 hover:shadow-lg"
                >
                  {t("common.create")}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 生成开发提示词对话框 */}
      {showPromptDialog && (
        <motion.div
          className="fixed z-[101] flex items-center justify-center"
          style={monitorStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowPromptDialog(false)}
          />
          <motion.div
            className="relative bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl rounded-xl shadow-2xl border border-black/5 dark:border-white/10 ring-1 ring-black/5 w-[460px] flex flex-col overflow-hidden"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5">
              <h2 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--color-accent)]" />
                {t("widget.customWidget.genPromptTitle")}
              </h2>
              <button
                onClick={() => setShowPromptDialog(false)}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
              >
                <X size={14} />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {t("widget.customWidget.genPromptDesc")}
              </p>
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={t("widget.customWidget.genPromptPlaceholder")}
                rows={5}
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]/50 transition-colors resize-none"
              />
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-black/5 dark:border-white/5">
              <button
                onClick={() => setShowPromptDialog(false)}
                className="px-4 py-1.5 text-xs rounded-lg border border-transparent bg-black/5 dark:bg-white/5 text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleCopyPrompt}
                disabled={!promptInput.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg border border-transparent bg-[var(--color-accent)] text-white disabled:opacity-40 transition-all shadow-md shadow-[var(--color-accent)]/25 hover:shadow-lg"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {t("widget.customWidget.copyPrompt")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* IPC 安全确认对话框 */}
      <ConfirmDialog
        isOpen={showIpcConfirm}
        title={t("widget.ipcConfirmTitle")}
        message={t("widget.ipcConfirmMessage")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        confirmStyle="default"
        onConfirm={() => confirmAddCustom(true)}
        onCancel={() => confirmAddCustom(false)}
      />
    </AnimatePresence>
  );
}

import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WidgetConfig, ThemeInfo, ConfigField } from "@/types/widget";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWidgetStore } from "@/stores/widgetStore";

interface CustomWidgetIframeProps {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
  containerId: string;
  width: number;
  height: number;
  ipcEnabled?: boolean;
  onShowConfig?: () => void;
  onConfigSchema?: (schema: ConfigField[]) => void;
}

export function CustomWidgetIframe({
  config,
  onConfigChange,
  containerId: _containerId,
  width,
  height,
  ipcEnabled = false,
  onShowConfig,
  onConfigSchema,
}: CustomWidgetIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { settings } = useSettingsStore();
  const { t } = useTranslation();
  const setIpcEnabled = useWidgetStore((s) => s.setCustomWidgetIpcEnabled);

  const htmlPath = config.customHtmlPath;

  // 读取 HTML 文件内容
  useEffect(() => {
    if (!htmlPath) return;
    let cancelled = false;
    setHtmlContent(null);
    setLoadError(null);
    invoke<string>("read_file_content", { path: htmlPath })
      .then((content) => {
        if (!cancelled) setHtmlContent(content);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(String(e));
      });
    return () => { cancelled = true; };
  }, [htmlPath]);

  // 构建 ThemeInfo
  const theme = useMemo(() => {
    const isDark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const computedStyle = getComputedStyle(document.documentElement);
    return {
      mode: isDark ? "dark" : "light",
      accentColor: settings.accentColor || "#0078d4",
      backgroundColor:
        computedStyle.getPropertyValue("--color-bg").trim() ||
        (isDark ? "#1a1a1a" : "#ffffff"),
      textColor:
        computedStyle.getPropertyValue("--color-text").trim() ||
        (isDark ? "#ffffff" : "#1f2937"),
      borderColor:
        computedStyle.getPropertyValue("--color-border").trim() ||
        (isDark ? "#333333" : "#e5e7eb"),
      variables: {
        "--color-accent": settings.accentColor || "#0078d4",
      },
    } as ThemeInfo;
  }, [settings.theme, settings.accentColor]);

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
        // 保存 configSchema
        if (data.meta?.configSchema && onConfigSchema) {
          onConfigSchema(data.meta.configSchema);
        }
        // 如果 meta 中有 ipc 请求，且小组件尚未授权，标记需要授权
        if (data.meta?.requiresIpc && htmlPath && !ipcEnabled) {
          setIpcEnabled(htmlPath, false);
        }
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
      } else if (data.type === "invoke") {
        // IPC 桥接：处理 Tauri 命令调用
        handleInvoke(data);
      } else if (data.type === "showConfig") {
        // 小组件请求打开配置面板
        onShowConfig?.();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [config, width, height, theme, onConfigChange, ipcEnabled, onShowConfig, onConfigSchema, htmlPath, setIpcEnabled]);

  // 处理 invoke 请求
  const handleInvoke = async (data: { id?: string; command?: string; args?: Record<string, any> }) => {
    const { id, command, args } = data;
    if (!id || !command) {
      postToIframe({ type: "invokeResult", id, error: "缺少 id 或 command 参数" });
      return;
    }

    // 检查 IPC 权限
    if (!ipcEnabled) {
      postToIframe({
        type: "invokeResult",
        id,
        error: "IPC 未授权：该小组件未获得调用 Tauri 命令的权限，请在右键菜单中授权",
      });
      return;
    }

    try {
      const result = await invoke(command, args || {});
      postToIframe({ type: "invokeResult", id, result });
    } catch (e: any) {
      postToIframe({ type: "invokeResult", id, error: String(e) });
    }
  };

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

  if (!htmlPath) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
        未指定 HTML 文件路径
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs opacity-50 px-4 text-center">
        {loadError}
      </div>
    );
  }

  if (htmlContent === null) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
        加载中...
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={htmlContent}
      className="w-full h-full border-0"
      style={{ background: "transparent", pointerEvents: "auto" }}
      sandbox="allow-scripts allow-same-origin"
      title={t("widget.custom")}
    />
  );
}

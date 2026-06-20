import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WidgetConfig, ThemeInfo } from "@/types/widget";
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
  containerId: _containerId,
  width,
  height,
}: CustomWidgetIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const { settings } = useSettingsStore();

  const htmlPath = config.customHtmlPath;

  const src = htmlPath ? convertFileSrc(htmlPath) : "";

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

  if (!htmlPath) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
        未指定 HTML 文件路径
      </div>
    );
  }

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

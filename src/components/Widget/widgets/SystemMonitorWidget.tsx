import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { WidgetComponentProps } from "@/types/widget";
import { Cpu, Layers, HardDrive } from "lucide-react";
import { cn } from "@/utils/cn";

interface SystemInfo {
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  disk_used: number;
  disk_total: number;
  cpu_brand?: string;
  cpu_cores?: number;
  cpu_threads?: number;
  uptime?: number;
}

export function SystemMonitorWidget({ config, width, height }: WidgetComponentProps) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const interval = config.config?.refreshInterval || 2;
  const showCpu = config.config?.showCpu !== false;
  const showMemory = config.config?.showMemory !== false;
  const showDisk = config.config?.showDisk !== false;

  // 布局与缩放配置
  const viewMode = config.config?.viewMode || "list"; // "list" | "gauge" | "compact-dashboard"
  const contentSizeScale = config.config?.contentSizeScale ?? 1.0;

  // 统一的指标基准颜色
  const rawColor = config.config?.monitorColor || "theme";
  const indicatorColor =
    rawColor === "theme"
      ? "var(--color-text)"
      : rawColor === "accent"
        ? "var(--color-accent)"
        : rawColor;

  // 自定义滚动条状态
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const fetchInfo = async () => {
      try {
        const data = await invoke<SystemInfo>("get_system_info");
        if (active) setInfo(data);
      } catch (e) {
        console.error("获取系统信息失败:", e);
      }
    };
    fetchInfo();
    const timer = setInterval(fetchInfo, interval * 1000);
    return () => {
      active = false;
      clearInterval(timer);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, [interval]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    if (el.scrollHeight <= el.clientHeight) {
      if (isScrolling) setIsScrolling(false);
      return;
    }

    const scrollRatio = el.scrollTop / (el.scrollHeight - el.clientHeight);
    const thumbHeight = Math.max(
      16,
      (el.clientHeight / el.scrollHeight) * el.clientHeight,
    );
    const maxThumbTop = el.clientHeight - thumbHeight;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${scrollRatio * maxThumbTop}px)`;

    if (!isScrolling) setIsScrolling(true);

    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, 1000);
  };

  if (!info) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs opacity-50 select-none">
        {t("common.loading")}
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatUptime = (seconds?: number) => {
    if (seconds === undefined) return t("common.unknown");
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const d = Math.floor(h / 24);
    if (d > 0) {
      return t("widget.systemMonitor.uptimeDays", { days: d, hours: h % 24 });
    }
    if (h > 0) {
      return t("widget.systemMonitor.uptimeHours", { hours: h, minutes: m });
    }
    return t("widget.systemMonitor.uptimeMinutes", { minutes: m });
  };

  const memPercent = (info.memory_used / info.memory_total) * 100;
  const diskPercent = (info.disk_used / info.disk_total) * 100;

  const metrics: {
    key: string;
    label: string;
    value: string;
    percent: number;
    icon: React.ReactNode;
    color: string;
    gradientId: string;
  }[] = [];

  const iconSize = 13 * contentSizeScale;

  if (showCpu) {
    metrics.push({
      key: "cpu",
      label: "CPU",
      value: `${info.cpu_usage.toFixed(1)}%`,
      percent: info.cpu_usage,
      icon: <Cpu size={iconSize} />,
      color: indicatorColor,
      gradientId: "grad-cpu",
    });
  }
  if (showMemory) {
    metrics.push({
      key: "memory",
      label: t("widget.systemMonitor.memory"),
      value: `${formatBytes(info.memory_used)}`,
      percent: memPercent,
      icon: <Layers size={iconSize} />,
      color: indicatorColor,
      gradientId: "grad-mem",
    });
  }
  if (showDisk) {
    metrics.push({
      key: "disk",
      label: t("widget.systemMonitor.disk"),
      value: `${formatBytes(info.disk_used)}`,
      percent: diskPercent,
      icon: <HardDrive size={iconSize} />,
      color: indicatorColor,
      gradientId: "grad-disk",
    });
  }

  // 1. 简约进度条列表模式 (优化后的行内排版)
  if (viewMode === "list") {
    return (
      <div 
        className="w-full h-full flex flex-col justify-center select-none relative overflow-y-auto hidden-native-scrollbar"
        style={{
          gap: `${10 * contentSizeScale}px`,
          padding: `${12 * contentSizeScale}px`,
          fontSize: `${11 * contentSizeScale}px`,
        }}
        onScroll={handleScroll}
      >
        {metrics.map((item) => (
          <div key={item.key} className="flex items-center justify-between w-full">
            {/* 左侧：图标 + 指标名 + 状态数值 */}
            <div className="flex items-center min-w-0" style={{ gap: `${6 * contentSizeScale}px` }}>
              <span className="shrink-0" style={{ color: item.color }}>{item.icon}</span>
              <span className="font-semibold text-[var(--color-text)] truncate">{item.label}</span>
              <span className="font-mono text-[9px] text-[var(--color-text-secondary)] opacity-70 truncate max-w-[80px]">
                {item.value}
              </span>
            </div>

            {/* 右侧：精细进度条槽 + 百分比 */}
            <div className="flex items-center shrink-0 w-[55%] justify-end" style={{ gap: `${8 * contentSizeScale}px` }}>
              <div 
                className="flex-1 bg-black/5 dark:bg-white/5 overflow-hidden border border-black/5 dark:border-white/5"
                style={{
                  height: `${5 * contentSizeScale}px`,
                  borderRadius: `${3 * contentSizeScale}px`,
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, item.percent)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <span className="font-mono font-bold text-right min-w-[34px] text-[var(--color-text)]" style={{ fontSize: `${10 * contentSizeScale}px` }}>
                {Math.round(item.percent)}%
              </span>
            </div>
          </div>
        ))}

        {/* 系统详情底盘显示 */}
        {(info.cpu_brand || info.uptime !== undefined) && (
          <div 
            className="mt-1 pt-2 border-t border-black/5 dark:border-white/5 flex flex-col gap-0.5 text-[var(--color-text-secondary)] opacity-60 font-mono tracking-tight select-none"
            style={{ fontSize: `${9 * contentSizeScale}px` }}
          >
            {info.cpu_brand && (
              <div className="truncate" title={info.cpu_brand}>
                CPU: {info.cpu_brand.replace(/\(R\)|\(TM\)/g, "")} {info.cpu_cores ? `(${info.cpu_cores}C/${info.cpu_threads}T)` : ""}
              </div>
            )}
            {info.uptime !== undefined && (
              <div>UPTIME: {formatUptime(info.uptime)}</div>
            )}
          </div>
        )}

        {/* 自定义滚动滑块 */}
        <div
          ref={thumbRef}
          className={cn(
            "absolute top-1 right-1 w-1 bg-black/20 dark:bg-white/20 rounded-full pointer-events-none",
            "transition-opacity duration-300 ease-in-out",
            isScrolling ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    );
  }

  // 2. 圆环仪表盘模式
  if (viewMode === "gauge") {
    const isRowLayout = width > metrics.length * 68;
    const maxCircleSize = 64 * contentSizeScale;
    const computedSize = isRowLayout
      ? Math.min(width / metrics.length - 12, height - 48, maxCircleSize)
      : Math.min(width - 24, height / metrics.length - 18, maxCircleSize);
      
    const svgSize = Math.max(36, computedSize);
    const strokeWidth = 3.5 * contentSizeScale;
    const radius = (svgSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
      <div 
        className="w-full h-full flex flex-col select-none relative justify-center items-center overflow-y-auto hidden-native-scrollbar"
        style={{
          padding: `${12 * contentSizeScale}px`,
          fontSize: `${10 * contentSizeScale}px`,
        }}
        onScroll={handleScroll}
      >
        <div className={cn("flex justify-around items-center w-full flex-1", isRowLayout ? "flex-row gap-4" : "flex-col gap-3")}>
          {metrics.map((item) => {
            const strokeDashoffset = circumference - (Math.min(100, item.percent) / 100) * circumference;
            return (
              <div 
                key={item.key} 
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-1 shrink-0 grow-0",
                  !isRowLayout && "w-full flex-row justify-between px-3"
                )}
              >
                <div className="relative" style={{ width: svgSize, height: svgSize }}>
                  <svg width={svgSize} height={svgSize} className="-rotate-90">
                    <circle
                      cx={svgSize / 2}
                      cy={svgSize / 2}
                      r={radius}
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      opacity={0.06}
                    />
                    <circle
                      cx={svgSize / 2}
                      cy={svgSize / 2}
                      r={radius}
                      fill="transparent"
                      stroke={item.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center" style={{ color: item.color }}>
                    {item.icon}
                  </div>
                </div>

                <div className={cn("flex flex-col items-center", !isRowLayout && "items-end text-right")}>
                  <span className="opacity-80 text-[var(--color-text)] font-medium">{item.label}</span>
                  <span className="font-mono text-[9px] text-[var(--color-text-secondary)] mt-0.5 leading-none">
                    {Math.round(item.percent)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 表盘模式的开机时间微型展示 */}
        {info.uptime !== undefined && (
          <div 
            className="text-center select-none pt-1 font-mono text-[var(--color-text-secondary)] opacity-50"
            style={{ fontSize: `${8 * contentSizeScale}px` }}
          >
            UPTIME: {formatUptime(info.uptime)}
          </div>
        )}

        {/* 自定义滚动滑块 */}
        <div
          ref={thumbRef}
          className={cn(
            "absolute top-1 right-1 w-1 bg-black/20 dark:bg-white/20 rounded-full pointer-events-none",
            "transition-opacity duration-300 ease-in-out",
            isScrolling ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    );
  }

  // 3. compact-dashboard 紧凑极客控制台模式
  if (viewMode === "compact-dashboard") {
    const isColumnLayout = width < 210;
    const svgSize = 42 * contentSizeScale;
    const strokeWidth = 3.5 * contentSizeScale;
    const radius = (svgSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // 控制台里只取 CPU 和内存作为环显示，磁盘在文本里显示
    const consoleMetrics = metrics.filter(m => m.key !== "disk");

    return (
      <div
        className={cn(
          "w-full h-full flex select-none relative overflow-y-auto hidden-native-scrollbar",
          isColumnLayout ? "flex-col justify-center" : "flex-row items-center justify-between"
        )}
        style={{
          padding: `${12 * contentSizeScale}px`,
          gap: `${12 * contentSizeScale}px`,
        }}
        onScroll={handleScroll}
      >
        {/* 左侧：两个圆环 */}
        <div className={cn("flex shrink-0 justify-around gap-2.5", isColumnLayout ? "flex-row w-full" : "flex-col")}>
          {consoleMetrics.map((item) => {
            const strokeDashoffset = circumference - (Math.min(100, item.percent) / 100) * circumference;
            return (
              <div key={item.key} className="flex items-center gap-1.5">
                <div className="relative shrink-0" style={{ width: svgSize, height: svgSize }}>
                  <svg width={svgSize} height={svgSize} className="-rotate-90">
                    <circle
                      cx={svgSize / 2}
                      cy={svgSize / 2}
                      r={radius}
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      opacity={0.06}
                    />
                    <circle
                      cx={svgSize / 2}
                      cy={svgSize / 2}
                      r={radius}
                      fill="transparent"
                      stroke={item.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center" style={{ color: item.color }}>
                    {item.icon}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="opacity-60 text-[var(--color-text)] leading-none" style={{ fontSize: `${8 * contentSizeScale}px` }}>{item.label}</span>
                  <span className="font-mono font-semibold text-[var(--color-text)] mt-0.5 leading-none" style={{ fontSize: `${10 * contentSizeScale}px` }}>
                    {Math.round(item.percent)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 右侧：极客文本信息板 */}
        <div 
          className="flex-1 min-w-0 font-mono text-[var(--color-text-secondary)] opacity-85 flex flex-col justify-center tracking-tight border-l border-black/5 dark:border-white/5"
          style={{
            fontSize: `${9 * contentSizeScale}px`,
            gap: `${2 * contentSizeScale}px`,
            paddingLeft: `${10 * contentSizeScale}px`,
          }}
        >
          <div 
            className="font-bold text-[var(--color-accent)] opacity-80 select-none uppercase tracking-wide"
            style={{ fontSize: `${8 * contentSizeScale}px`, marginBottom: `${2 * contentSizeScale}px` }}
          >
            [SYS CONSOLE]
          </div>
          {info.cpu_brand && (
            <div className="truncate" style={{ fontSize: `${8 * contentSizeScale}px` }} title={info.cpu_brand}>
              CPU: {info.cpu_brand.replace(/\(R\)|\(TM\)/g, "")}
            </div>
          )}
          {info.cpu_cores !== undefined && (
            <div>
              CORE: {info.cpu_cores}C / {info.cpu_threads}T
            </div>
          )}
          {showDisk && (
            <div className="truncate">
              DISK: {formatBytes(info.disk_used)} / {formatBytes(info.disk_total)}
            </div>
          )}
          {info.uptime !== undefined && (
            <div className="truncate" style={{ fontSize: `${8 * contentSizeScale}px` }}>
              UPTIME: {formatUptime(info.uptime)}
            </div>
          )}
        </div>

        {/* 自定义滚动滑块 */}
        <div
          ref={thumbRef}
          className={cn(
            "absolute top-1 right-1 w-1 bg-black/20 dark:bg-white/20 rounded-full pointer-events-none",
            "transition-opacity duration-300 ease-in-out",
            isScrolling ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    );
  }

  return null;
}

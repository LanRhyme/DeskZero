import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { WidgetComponentProps } from "@/types/widget";

interface SystemInfo {
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  disk_used: number;
  disk_total: number;
}

export function SystemMonitorWidget({ config }: WidgetComponentProps) {
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
      value: `${info.cpu_usage.toFixed(1)}%`,
      percent: info.cpu_usage,
      color: info.cpu_usage > 80 ? "#ef4444" : info.cpu_usage > 60 ? "#f59e0b" : "#22c55e",
    });
  }
  if (showMemory) {
    const memPercent = (info.memory_used / info.memory_total) * 100;
    items.push({
      label: "内存",
      value: `${formatBytes(info.memory_used)} / ${formatBytes(info.memory_total)}`,
      percent: memPercent,
      color: memPercent > 80 ? "#ef4444" : memPercent > 60 ? "#f59e0b" : "#3b82f6",
    });
  }
  if (showDisk) {
    const diskPercent = (info.disk_used / info.disk_total) * 100;
    items.push({
      label: "磁盘",
      value: `${formatBytes(info.disk_used)} / ${formatBytes(info.disk_total)}`,
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

import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Slider } from "@/components/UI/Slider";
import { useContainerStore } from "@/stores/containerStore";
import type { Container as ContainerType } from "@/types/container";
import type { WidgetConfig } from "@/types/widget";

interface WidgetSettingsPanelProps {
  container: ContainerType;
  widgetConfig: WidgetConfig;
  onClose: () => void;
}

export function WidgetSettingsPanel({
  container,
  widgetConfig,
  onClose,
}: WidgetSettingsPanelProps) {
  const { updateContainerStyle } = useContainerStore();

  const [opacity, setOpacity] = useState(
    container.style.backgroundOpacity ?? 0.5,
  );
  const [cornerRadius, setCornerRadius] = useState(
    container.style.cornerRadius ?? 12,
  );

  // 小组件特定配置
  const [clockStyle, setClockStyle] = useState(
    widgetConfig.config?.clockStyle || "digital",
  );
  const [stickyColor, setStickyColor] = useState(
    widgetConfig.config?.color || "#ffeb3b",
  );
  const [refreshInterval, setRefreshInterval] = useState(
    widgetConfig.config?.refreshInterval || 2,
  );
  const [showCpu, setShowCpu] = useState(
    widgetConfig.config?.showCpu !== false,
  );
  const [showMemory, setShowMemory] = useState(
    widgetConfig.config?.showMemory !== false,
  );
  const [showDisk, setShowDisk] = useState(
    widgetConfig.config?.showDisk !== false,
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // 自动定位到容器旁边，避免溢出屏幕
  useLayoutEffect(() => {
    if (containerRef.current) {
      const parent = containerRef.current.parentElement;
      if (parent) {
        const rect = containerRef.current.getBoundingClientRect();
        const padding = 10;

        const styleLeft = parseFloat(parent.style.left) || 0;
        const styleTop = parseFloat(parent.style.top) || 0;

        let newLeft = styleLeft;
        let newTop = styleTop;

        if (styleLeft + rect.width > window.innerWidth) {
          newLeft = Math.max(padding, window.innerWidth - rect.width - padding);
        }
        if (newLeft < padding) newLeft = padding;

        if (styleTop + rect.height > window.innerHeight) {
          newTop = Math.max(padding, window.innerHeight - rect.height - padding);
        }
        if (newTop < padding) newTop = padding;

        parent.style.left = `${newLeft}px`;
        parent.style.top = `${newTop}px`;
      }
    }
  });

  const handleSave = () => {
    // 保存容器样式
    updateContainerStyle(container.id, {
      backgroundOpacity: opacity,
      cornerRadius,
    });

    // 保存小组件特定配置
    const newWidgetConfig: WidgetConfig = { ...widgetConfig };
    switch (widgetConfig.widgetType) {
      case "clock":
        newWidgetConfig.config = { ...widgetConfig.config, clockStyle };
        break;
      case "stickyNote":
        newWidgetConfig.config = { ...widgetConfig.config, color: stickyColor };
        break;
      case "systemMonitor":
        newWidgetConfig.config = {
          ...widgetConfig.config,
          refreshInterval,
          showCpu,
          showMemory,
          showDisk,
        };
        break;
    }
    updateContainerStyle(container.id, { config: newWidgetConfig } as any);
    onClose();
  };

  const renderWidgetSpecific = () => {
    switch (widgetConfig.widgetType) {
      case "clock":
        return (
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
              时钟样式
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={() => setClockStyle("digital")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  clockStyle === "digital"
                    ? "bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20"
                    : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                数字
              </button>
              <button
                onClick={() => setClockStyle("analog")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  clockStyle === "analog"
                    ? "bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20"
                    : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                模拟
              </button>
            </div>
          </div>
        );

      case "stickyNote":
        return (
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
              便签颜色
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8 rounded-full overflow-hidden shadow-inner ring-1 ring-black/10 dark:ring-white/10 cursor-pointer group shrink-0">
                <input
                  type="color"
                  value={stickyColor}
                  onChange={(e) => setStickyColor(e.target.value)}
                  className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer"
                />
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">{stickyColor}</span>
            </div>
          </div>
        );

      case "systemMonitor":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
                刷新间隔
              </label>
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
                <span>频率</span>
                <span>{refreshInterval}秒</span>
              </div>
              <Slider
                min={1}
                max={30}
                step={1}
                value={refreshInterval}
                onChange={(v) => setRefreshInterval(Math.round(v))}
              />
            </div>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={showCpu}
                    onChange={(e) => setShowCpu(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-8 h-4.5 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[14px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
                </div>
                <span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                  显示 CPU
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={showMemory}
                    onChange={(e) => setShowMemory(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-8 h-4.5 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[14px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
                </div>
                <span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                  显示内存
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={showDisk}
                    onChange={(e) => setShowDisk(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-8 h-4.5 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[14px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
                </div>
                <span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                  显示磁盘
                </span>
              </label>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full transform overflow-hidden rounded-xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl p-3 text-left align-middle shadow-2xl transition-all border border-black/5 dark:border-white/10 ring-1 ring-black/5"
    >
      <div className="text-sm font-medium leading-5 text-[var(--color-text)] flex justify-between items-center mb-3">
        <span>
          小组件设置{" "}
          <span className="text-[10px] font-normal text-[var(--color-text-secondary)] opacity-70">
            ({container.name})
          </span>
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
        >
          <X size={12} />
        </button>
      </div>

      <div className="space-y-3">
        {/* 通用：不透明度 */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
            <span>不透明度</span>
            <span>{Math.round(opacity * 100)}%</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={setOpacity}
          />
        </div>

        {/* 通用：圆角 */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
            <span>圆角大小</span>
            <span className="text-[var(--color-text)]">{cornerRadius}px</span>
          </div>
          <Slider
            min={0}
            max={64}
            step={1}
            value={cornerRadius}
            onChange={setCornerRadius}
          />
        </div>

        {/* 小组件特定设置 */}
        {renderWidgetSpecific() && (
          <>
            <div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />
            {renderWidgetSpecific()}
          </>
        )}

        {/* 按钮 */}
        <div className="pt-3 flex gap-2">
          <button
            type="button"
            className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="flex-1 justify-center rounded-lg border border-transparent bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)] transition-colors shadow-md shadow-[var(--color-accent)]/25 focus:outline-none"
            onClick={handleSave}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

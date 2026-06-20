import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Slider } from "@/components/UI/Slider";
import { useContainerStore } from "@/stores/containerStore";
import type { Container as ContainerType } from "@/types/container";
import type { WidgetConfig } from "@/types/widget";
import { cn } from "@/utils/cn";

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

  const [activeTab, setActiveTab] = useState<"style" | "content">("style");

  // 自定义滚动条状态与处理器
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  // 1. 通用外观设置
  const [opacity, setOpacity] = useState(container.style.backgroundOpacity ?? 0.5);
  const [cornerRadius, setCornerRadius] = useState(container.style.cornerRadius ?? 12);
  const [transparentBackground, setTransparentBackground] = useState(
    widgetConfig.config?.transparentBackground === true
  );

  // 2. 时钟设置
  const [clockStyle, setClockStyle] = useState(widgetConfig.config?.clockStyle || "digital");
  const [digitalStyle, setDigitalStyle] = useState(widgetConfig.config?.digitalStyle || "minimal");
  const [hour12, setHour12] = useState(widgetConfig.config?.hour12 === true);
  const [showSeconds, setShowSeconds] = useState(widgetConfig.config?.showSeconds !== false);
  const [showDate, setShowDate] = useState(widgetConfig.config?.showDate !== false);
  const [showWeekday, setShowWeekday] = useState(widgetConfig.config?.showWeekday !== false);
  const [fontSizeScale, setFontSizeScale] = useState(widgetConfig.config?.fontSizeScale ?? 1.0);
  const [fontColor, setFontColor] = useState(widgetConfig.config?.fontColor || "theme");

  // 3. 便签设置
  const [stickyColor, setStickyColor] = useState(widgetConfig.config?.color || "#ffeb3b");
  const [noteFontFamily, setNoteFontFamily] = useState(widgetConfig.config?.fontFamily || "default");
  const [noteFontSize, setNoteFontSize] = useState(widgetConfig.config?.fontSize || 14);
  const [noteLineHeight, setNoteLineHeight] = useState(widgetConfig.config?.lineHeight || 1.5);
  const [noteTextAlign, setNoteTextAlign] = useState(widgetConfig.config?.textAlign || "left");
  const [showTape, setShowTape] = useState(widgetConfig.config?.showTape !== false);
  const [showLines, setShowLines] = useState(widgetConfig.config?.showLines !== false);
  const [noteFontColor, setNoteFontColor] = useState(widgetConfig.config?.fontColor || "#1f2937");

  // 4. 监控设置
  const [refreshInterval, setRefreshInterval] = useState(widgetConfig.config?.refreshInterval || 2);
  const [showCpu, setShowCpu] = useState(widgetConfig.config?.showCpu !== false);
  const [showMemory, setShowMemory] = useState(widgetConfig.config?.showMemory !== false);
  const [showDisk, setShowDisk] = useState(widgetConfig.config?.showDisk !== false);
  const [viewMode, setViewMode] = useState(widgetConfig.config?.viewMode || "list");
  const [monitorColor, setMonitorColor] = useState(widgetConfig.config?.monitorColor || "theme");
  const [contentSizeScale, setContentSizeScale] = useState(widgetConfig.config?.contentSizeScale ?? 1.0);

  // 5. 一言设置
  const [hitokotoSourceMode, setHitokotoSourceMode] = useState(widgetConfig.config?.sourceMode || "api");
  const [hitokotoCategory, setHitokotoCategory] = useState(widgetConfig.config?.category || "all");
  const [hitokotoRefreshInterval, setHitokotoRefreshInterval] = useState(widgetConfig.config?.refreshInterval ?? 3600);
  const [hitokotoFontColor, setHitokotoFontColor] = useState(widgetConfig.config?.fontColor || "theme");
  const [hitokotoFontSizeScale, setHitokotoFontSizeScale] = useState(widgetConfig.config?.fontSizeScale ?? 1.0);
  const [hitokotoTextAlign, setHitokotoTextAlign] = useState(widgetConfig.config?.textAlign || "center");
  const [hitokotoShowAuthor, setHitokotoShowAuthor] = useState(widgetConfig.config?.showAuthor !== false);
  const [hitokotoShowQuotes, setHitokotoShowQuotes] = useState(widgetConfig.config?.showQuotes !== false);
  const [hitokotoClickAction, setHitokotoClickAction] = useState(widgetConfig.config?.clickAction || "refresh");
  const [hitokotoCustomText, setHitokotoCustomText] = useState(widgetConfig.config?.customText || "");
  const [hitokotoCustomAuthor, setHitokotoCustomAuthor] = useState(widgetConfig.config?.customAuthor || "");
  const [hitokotoCustomFrom, setHitokotoCustomFrom] = useState(widgetConfig.config?.customFrom || "");

  // 备份打开设置面板时的初始样式，以便取消时完美回滚
  const initialStyleRef = useRef<any>(null);
  useEffect(() => {
    initialStyleRef.current = JSON.parse(JSON.stringify(container.style));
  }, []);

  // 当任何本地配置状态变化时，自动同步到 store 触发桌面即时预览
  useEffect(() => {
    const newConfig = {
      ...widgetConfig.config,
      transparentBackground,
    };

    switch (widgetConfig.widgetType) {
      case "clock":
        Object.assign(newConfig, {
          clockStyle,
          digitalStyle,
          hour12,
          showSeconds,
          showDate,
          showWeekday,
          fontSizeScale,
          fontColor,
        });
        break;
      case "stickyNote":
        Object.assign(newConfig, {
          color: stickyColor,
          fontFamily: noteFontFamily,
          fontSize: noteFontSize,
          lineHeight: noteLineHeight,
          textAlign: noteTextAlign,
          showTape,
          showLines,
          fontColor: noteFontColor,
        });
        break;
      case "systemMonitor":
        Object.assign(newConfig, {
          refreshInterval,
          showCpu,
          showMemory,
          showDisk,
          viewMode,
          monitorColor,
          contentSizeScale,
        });
        break;
      case "hitokoto":
        Object.assign(newConfig, {
          sourceMode: hitokotoSourceMode,
          category: hitokotoCategory,
          refreshInterval: hitokotoRefreshInterval,
          fontColor: hitokotoFontColor,
          fontSizeScale: hitokotoFontSizeScale,
          textAlign: hitokotoTextAlign,
          showAuthor: hitokotoShowAuthor,
          showQuotes: hitokotoShowQuotes,
          clickAction: hitokotoClickAction,
          customText: hitokotoCustomText,
          customAuthor: hitokotoCustomAuthor,
          customFrom: hitokotoCustomFrom,
        });
        break;
    }

    updateContainerStyle(container.id, {
      backgroundOpacity: opacity,
      cornerRadius,
      config: {
        ...widgetConfig,
        config: newConfig,
      },
    } as any);
  }, [
    opacity,
    cornerRadius,
    transparentBackground,
    clockStyle,
    digitalStyle,
    hour12,
    showSeconds,
    showDate,
    showWeekday,
    fontSizeScale,
    fontColor,
    stickyColor,
    noteFontFamily,
    noteFontSize,
    noteLineHeight,
    noteTextAlign,
    showTape,
    showLines,
    noteFontColor,
    refreshInterval,
    showCpu,
    showMemory,
    showDisk,
    viewMode,
    monitorColor,
    contentSizeScale,
    hitokotoSourceMode,
    hitokotoCategory,
    hitokotoRefreshInterval,
    hitokotoFontColor,
    hitokotoFontSizeScale,
    hitokotoTextAlign,
    hitokotoShowAuthor,
    hitokotoShowQuotes,
    hitokotoClickAction,
    hitokotoCustomText,
    hitokotoCustomAuthor,
    hitokotoCustomFrom,
  ]);

  const containerRef = useRef<HTMLDivElement>(null);

  // 自动边缘贴合
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
    // 已经通过全局 useEffect 实时同步了，这里直接关闭
    onClose();
  };

  const handleCancel = () => {
    if (initialStyleRef.current) {
      updateContainerStyle(container.id, initialStyleRef.current);
    }
    onClose();
  };

  const renderContentSpecific = () => {
    switch (widgetConfig.widgetType) {
      case "clock":
        return (
          <div className="space-y-3.5">
            {/* 表盘样式 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70">表盘样式</label>
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                <button
                  onClick={() => setClockStyle("digital")}
                  className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
                    clockStyle === "digital"
                      ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  数字时钟
                </button>
                <button
                  onClick={() => setClockStyle("analog")}
                  className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
                    clockStyle === "analog"
                      ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  指针表盘
                </button>
              </div>
            </div>

            {clockStyle === "digital" && (
              <>
                {/* 数字时钟子类型 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70">数字特效</label>
                  <div className="flex gap-1">
                    {["minimal", "glow", "retro"].map((style) => (
                      <button
                        key={style}
                        onClick={() => setDigitalStyle(style)}
                        className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          digitalStyle === style
                            ? "bg-[var(--color-accent)] text-white"
                            : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10"
                        }`}
                      >
                        {style === "minimal" ? "极简" : style === "glow" ? "霓虹" : "LED"}
                      </button>
                    ))}
                  </div>
                </div>

                 {/* 字体颜色 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70">文字颜色</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { key: "theme", label: "主题" },
                      { key: "accent", label: "强调" },
                      { key: "gradient-rainbow", label: "渐变" },
                      { key: "#f9fafb", label: "象牙白" },
                      { key: "#1f2937", label: "深炭黑" },
                      { key: "#10b981", label: "极光绿" },
                      { key: "#f97316", label: "活力橙" },
                    ].map((col) => (
                      <button
                        key={col.key}
                        onClick={() => setFontColor(col.key)}
                        className={`py-0.5 px-2 rounded text-[10px] font-medium transition-all border ${
                          fontColor === col.key
                            ? "bg-[var(--color-accent)] border-transparent text-white"
                            : "bg-black/5 dark:bg-white/5 border-transparent text-[var(--color-text-secondary)] hover:bg-black/10"
                        }`}
                      >
                        {col.label}
                      </button>
                    ))}
                    {/* 自定义文字颜色拾色器 */}
                    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                      <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                      <div className="relative w-4.5 h-4.5 rounded overflow-hidden border border-black/15 shrink-0 cursor-pointer">
                        <input
                          type="color"
                          value={
                            fontColor.startsWith("#") && 
                            !["#f9fafb", "#1f2937", "#10b981", "#f97316"].includes(fontColor)
                              ? fontColor
                              : "#ffffff"
                          }
                          onChange={(e) => setFontColor(e.target.value)}
                          className="absolute inset-[-5px] w-[200%] h-[200%] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 字体缩放比例 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                    <span>字体大小比例</span>
                    <span>{Math.round(fontSizeScale * 100)}%</span>
                  </div>
                  <Slider min={0.5} max={2.0} step={0.1} value={fontSizeScale} onChange={setFontSizeScale} />
                </div>

                {/* 显示开关 */}
                <div className="space-y-2.5 pt-1">
                  {[
                    { label: "12小时制", val: hour12, set: setHour12 },
                    { label: "显示秒数", val: showSeconds, set: setShowSeconds },
                    { label: "显示日期", val: showDate, set: setShowDate },
                    { label: "显示星期", val: showWeekday, set: setShowWeekday },
                  ].map((sw) => (
                    <label key={sw.label} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                        {sw.label}
                      </span>
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={sw.val}
                          onChange={(e) => sw.set(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-7 h-4 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-[12px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        );

      case "stickyNote":
        return (
          <div className="space-y-3.5">
            {/* 便签底色 */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">便签背景色</label>
              {/* 预设模板 */}
              <div className="space-y-1">
                <span className="text-[9px] text-[var(--color-text-secondary)] opacity-85 block">预设模板</span>
                <div className="flex items-center gap-2">
                  {[
                    { hex: "#ffeb3b", label: "柠檬黄" },
                    { hex: "#ff9800", label: "甜橙橙" },
                    { hex: "#ffebef", label: "樱花粉" },
                    { hex: "#e8f5e9", label: "薄荷绿" },
                    { hex: "#e3f2fd", label: "冰晶蓝" },
                    { hex: "#f3e5f5", label: "薰衣紫" },
                  ].map((col) => (
                    <button
                      key={col.hex}
                      onClick={() => setStickyColor(col.hex)}
                      className="w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
                      style={{ backgroundColor: col.hex }}
                      title={col.label}
                    >
                      {stickyColor === col.hex && (
                        <div className="w-1.5 h-1.5 bg-gray-800 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {/* 自定义背景色 — 物理分隔 */}
              <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-1.5 mt-1.5">
                <span className="text-[9px] text-[var(--color-text-secondary)] opacity-85">自定义背景色</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-[var(--color-text-secondary)] opacity-80 uppercase">{stickyColor}</span>
                  <div className="relative w-5 h-5 rounded-md overflow-hidden border border-black/15 shrink-0 cursor-pointer shadow-sm">
                    <input
                      type="color"
                      value={stickyColor}
                      onChange={(e) => setStickyColor(e.target.value)}
                      className="absolute inset-[-5px] w-[200%] h-[200%] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 新增：便签文字颜色 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">文字颜色</label>
              <div className="flex items-center gap-2">
                {[
                  { hex: "#1f2937", label: "经典黑" },
                  { hex: "#ffffff", label: "纯洁白" },
                  { hex: "#1e3a8a", label: "复古蓝" },
                  { hex: "#7f1d1d", label: "暗紫红" },
                ].map((col) => (
                  <button
                    key={col.hex}
                    onClick={() => setNoteFontColor(col.hex)}
                    className="w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center text-[10px]"
                    style={{ backgroundColor: col.hex }}
                    title={col.label}
                  >
                    {noteFontColor === col.hex && (
                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                    )}
                  </button>
                ))}
                {/* 自定义文字颜色 */}
                <div className="flex items-center gap-1.5 ml-auto bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[9px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <div className="relative w-4.5 h-4.5 rounded overflow-hidden border border-black/15 shrink-0 cursor-pointer shadow-sm">
                    <input
                      type="color"
                      value={
                        noteFontColor.startsWith("#") && 
                        !["#1f2937", "#ffffff", "#1e3a8a", "#7f1d1d"].includes(noteFontColor)
                          ? noteFontColor
                          : "#1f2937"
                      }
                      onChange={(e) => setNoteFontColor(e.target.value)}
                      className="absolute inset-[-5px] w-[200%] h-[200%] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 字体系列选择 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70">字体风格</label>
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                {[
                  { key: "default", label: "无衬线" },
                  { key: "mono", label: "等宽" },
                  { key: "kaiti", label: "楷体" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setNoteFontFamily(f.key)}
                    className={`flex-1 py-0.5 rounded text-[10px] font-medium transition-all ${
                      noteFontFamily === f.key
                        ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 排版微调 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>字号</span>
                <span>{noteFontSize}px</span>
              </div>
              <Slider min={12} max={24} step={1} value={noteFontSize} onChange={(v) => setNoteFontSize(Math.round(v))} />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>行间距</span>
                <span>{noteLineHeight.toFixed(1)}</span>
              </div>
              <Slider min={1.2} max={2.0} step={0.1} value={noteLineHeight} onChange={setNoteLineHeight} />
            </div>

            {/* 对齐方式 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70">对齐方式</label>
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                {[
                  { key: "left", label: "左对齐" },
                  { key: "center", label: "居中" },
                  { key: "right", label: "右对齐" },
                ].map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setNoteTextAlign(a.key)}
                    className={`flex-1 py-0.5 rounded text-[10px] font-medium transition-all ${
                      noteTextAlign === a.key
                        ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 卡片装饰开关 */}
            <div className="space-y-2.5 pt-1">
              {[
                { label: "显示透明胶带", val: showTape, set: setShowTape },
                { label: "显示信纸格线", val: showLines, set: setShowLines },
              ].map((sw) => (
                <label key={sw.label} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                    {sw.label}
                  </span>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={sw.val}
                      onChange={(e) => sw.set(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-7 h-4 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-[12px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case "systemMonitor":
        return (
          <div className="space-y-3.5">
            {/* 布局排版 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">布局排版</label>
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                {[
                  { key: "list", label: "进度列表" },
                  { key: "gauge", label: "圆环表盘" },
                  { key: "compact-dashboard", label: "极客控制台" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setViewMode(mode.key)}
                    className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                      viewMode === mode.key
                        ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)] font-semibold"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 指标颜色 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">基准指示色</label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "theme", label: "主题" },
                  { key: "accent", label: "强调" },
                  { key: "#3b82f6", label: "科技蓝" },
                  { key: "#10b981", label: "极光绿" },
                  { key: "#f97316", label: "活力橙" },
                ].map((col) => (
                  <button
                    key={col.key}
                    onClick={() => setMonitorColor(col.key)}
                    className={`py-0.5 px-2 rounded text-[10px] font-medium transition-all border ${
                      monitorColor === col.key
                        ? "bg-[var(--color-accent)] border-transparent text-white"
                        : "bg-black/5 dark:bg-white/5 border-transparent text-[var(--color-text-secondary)] hover:bg-black/10"
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
                {/* 自定义监控基准色 */}
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <div className="relative w-4.5 h-4.5 rounded overflow-hidden border border-black/15 shrink-0 cursor-pointer shadow-sm">
                    <input
                      type="color"
                      value={
                        monitorColor.startsWith("#") && 
                        !["#3b82f6", "#10b981", "#f97316"].includes(monitorColor)
                          ? monitorColor
                          : "#3b82f6"
                      }
                      onChange={(e) => setMonitorColor(e.target.value)}
                      className="absolute inset-[-5px] w-[200%] h-[200%] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 刷新频率 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>数据刷新频率</span>
                <span>{refreshInterval} 秒</span>
              </div>
              <Slider min={1} max={30} step={1} value={refreshInterval} onChange={(v) => setRefreshInterval(Math.round(v))} />
            </div>

            {/* 内容大小比例 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>内容大小比例</span>
                <span>{Math.round(contentSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.6} step={0.1} value={contentSizeScale} onChange={setContentSizeScale} />
            </div>

            {/* 指标展示开关 */}
            <div className="space-y-2.5 pt-1">
              {[
                { label: "显示 CPU 占用率", val: showCpu, set: setShowCpu },
                { label: "显示 内存 占用率", val: showMemory, set: setShowMemory },
                { label: "显示 磁盘 占用率", val: showDisk, set: setShowDisk },
              ].map((sw) => (
                <label key={sw.label} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                    {sw.label}
                  </span>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={sw.val}
                      onChange={(e) => sw.set(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-7 h-4 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-[12px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case "hitokoto":
        return (
          <div className="space-y-3.5">
            {/* 数据来源 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">数据来源</label>
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                {[
                  { key: "api", label: "API 自动拉取" },
                  { key: "custom", label: "自定义文本" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => {
                      setHitokotoSourceMode(mode.key);
                      // 切换模式时自动配置一个合理的点击动作默认值
                      if (mode.key === "custom" && hitokotoClickAction === "refresh") {
                        setHitokotoClickAction("copy");
                      }
                    }}
                    className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                      hitokotoSourceMode === mode.key
                        ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)] font-semibold"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* API 模式下的配置 */}
            {hitokotoSourceMode === "api" && (
              <>
                {/* 语录分类 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">语录类型</label>
                  <CustomSelect
                    value={hitokotoCategory}
                    onChange={setHitokotoCategory}
                    options={[
                      { value: "all", label: "全品类随机" },
                      { value: "a", label: "动画 (Anime)" },
                      { value: "b", label: "漫画 (Comic)" },
                      { value: "c", label: "游戏 (Game)" },
                      { value: "d", label: "文学小说 (Novel)" },
                      { value: "f", label: "原创 (Original)" },
                      { value: "h", label: "网络语录 (Net)" },
                      { value: "k", label: "哲学 (Philosophy)" },
                      { value: "o", label: "中国诗词 (Poetry)" },
                      { value: "i", label: "励志鸡汤 (Soul)" },
                      { value: "j", label: "其他 (Other)" },
                    ]}
                  />
                </div>

                {/* 刷新频率 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">自动刷新频率</label>
                  <CustomSelect
                    value={String(hitokotoRefreshInterval)}
                    onChange={(val) => setHitokotoRefreshInterval(Number(val))}
                    options={[
                      { value: "0", label: "手动刷新 (点击卡片)" },
                      { value: "300", label: "每 5 分钟" },
                      { value: "900", label: "每 15 分钟" },
                      { value: "1800", label: "每 30 分钟" },
                      { value: "3600", label: "每 1 小时" },
                      { value: "21600", label: "每 6 小时" },
                      { value: "43200", label: "每 12 小时" },
                      { value: "86400", label: "每 24 小时" },
                    ]}
                    position="top"
                  />
                </div>
              </>
            )}

            {/* 自定义模式下的配置 */}
            {hitokotoSourceMode === "custom" && (
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">语录文本</label>
                  <textarea
                    value={hitokotoCustomText}
                    onChange={(e) => setHitokotoCustomText(e.target.value)}
                    placeholder="输入要显示的句子..."
                    rows={2}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-[var(--color-text)] opacity-60 block">作者</label>
                    <input
                      type="text"
                      value={hitokotoCustomAuthor}
                      onChange={(e) => setHitokotoCustomAuthor(e.target.value)}
                      placeholder="选填"
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-[var(--color-text)] opacity-60 block">出处/来源</label>
                    <input
                      type="text"
                      value={hitokotoCustomFrom}
                      onChange={(e) => setHitokotoCustomFrom(e.target.value)}
                      placeholder="选填"
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 点击动作 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">点击卡片动作</label>
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                {[
                  { key: "refresh", label: "刷新语录" },
                  { key: "copy", label: "复制文本" },
                  { key: "none", label: "无操作" },
                ].map((act) => (
                  <button
                    key={act.key}
                    type="button"
                    onClick={() => setHitokotoClickAction(act.key)}
                    disabled={hitokotoSourceMode === "custom" && act.key === "refresh"}
                    className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                      hitokotoClickAction === act.key
                        ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)] font-semibold"
                        : "text-[var(--color-text-secondary)] disabled:opacity-40"
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 文字颜色 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">文字颜色</label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "theme", label: "主题" },
                  { key: "accent", label: "强调" },
                  { key: "gradient-rainbow", label: "渐变" },
                  { key: "#ffffff", label: "纯白" },
                  { key: "#1f2937", label: "深炭" },
                ].map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => setHitokotoFontColor(col.key)}
                    className={`py-0.5 px-2 rounded text-[10px] font-medium transition-all border ${
                      hitokotoFontColor === col.key
                        ? "bg-[var(--color-accent)] border-transparent text-white"
                        : "bg-black/5 dark:bg-white/5 border-transparent text-[var(--color-text-secondary)] hover:bg-black/10"
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
                {/* 自定义拾色器 */}
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <div className="relative w-4.5 h-4.5 rounded overflow-hidden border border-black/15 shrink-0 cursor-pointer shadow-sm">
                    <input
                      type="color"
                      value={
                        hitokotoFontColor.startsWith("#") &&
                        !["#ffffff", "#1f2937"].includes(hitokotoFontColor)
                          ? hitokotoFontColor
                          : "#10b981"
                      }
                      onChange={(e) => setHitokotoFontColor(e.target.value)}
                      className="absolute inset-[-5px] w-[200%] h-[200%] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 文字对齐 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text)] opacity-70 block">文字对齐</label>
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                {[
                  { key: "left", label: "左对齐" },
                  { key: "center", label: "居中" },
                  { key: "right", label: "右对齐" },
                ].map((align) => (
                  <button
                    key={align.key}
                    type="button"
                    onClick={() => setHitokotoTextAlign(align.key)}
                    className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                      hitokotoTextAlign === align.key
                        ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)] font-semibold"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {align.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 字号缩放比例 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>文字大小比例</span>
                <span>{Math.round(hitokotoFontSizeScale * 100)}%</span>
              </div>
              <Slider
                min={0.6}
                max={1.8}
                step={0.1}
                value={hitokotoFontSizeScale}
                onChange={setHitokotoFontSizeScale}
              />
            </div>

            {/* 开关配置 */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                  显示来源和作者
                </span>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={hitokotoShowAuthor}
                    onChange={(e) => setHitokotoShowAuthor(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-7 h-4 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-[12px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                  显示双引号装饰
                </span>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={hitokotoShowQuotes}
                    onChange={(e) => setHitokotoShowQuotes(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-7 h-4 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-[12px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
                </div>
              </label>
            </div>
          </div>
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
      {/* 头部标题 */}
      <div className="text-sm font-semibold leading-5 text-[var(--color-text)] flex justify-between items-center mb-2">
        <span className="flex items-baseline gap-1">
          小组件设置
          <span className="text-[9px] font-normal text-[var(--color-text-secondary)] opacity-70">
            ({container.name})
          </span>
        </span>
        <button
          onClick={handleCancel}
          className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
        >
          <X size={12} />
        </button>
      </div>

      {/* Tabs 切换 */}
      <div className="flex border-b border-black/5 dark:border-white/5 mb-3 text-center">
        <button
          onClick={() => setActiveTab("style")}
          className={`flex-1 pb-1.5 text-[11px] font-medium transition-all border-b-2 ${
            activeTab === "style"
              ? "border-[var(--color-accent)] text-[var(--color-accent)] font-semibold"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          }`}
        >
          卡片外观
        </button>
        <button
          onClick={() => setActiveTab("content")}
          className={`flex-1 pb-1.5 text-[11px] font-medium transition-all border-b-2 ${
            activeTab === "content"
              ? "border-[var(--color-accent)] text-[var(--color-accent)] font-semibold"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          }`}
        >
          内容配置
        </button>
      </div>

      <div 
        className="space-y-3.5 max-h-[300px] overflow-y-auto px-0.5 hidden-native-scrollbar relative"
        onScroll={handleScroll}
      >
        {/* TAB 1: 卡片外观设置 */}
        {activeTab === "style" && (
          <div className="space-y-3.5">
            {/* 不透明度 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>背景不透明度</span>
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <Slider min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} />
            </div>

            {/* 圆角大小 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>卡片圆角</span>
                <span>{cornerRadius}px</span>
              </div>
              <Slider min={0} max={64} step={1} value={cornerRadius} onChange={setCornerRadius} />
            </div>

            {/* 完全透明开关 */}
            <label className="flex items-center justify-between cursor-pointer pt-1 group">
              <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                完全透明背景 (隐藏毛玻璃层)
              </span>
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={transparentBackground}
                  onChange={(e) => setTransparentBackground(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-7 h-4 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-[12px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
              </div>
            </label>
          </div>
        )}

        {/* TAB 2: 小组件专属设置 */}
        {activeTab === "content" && renderContentSpecific()}

        {/* 自定义滚动滑块 */}
        <div
          ref={thumbRef}
          className={cn(
            "absolute top-1.5 right-1 w-1 bg-black/20 dark:bg-white/20 rounded-full pointer-events-none",
            "transition-opacity duration-300 ease-in-out backdrop-blur-[0.5px]",
            isScrolling ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      {/* 底部确认操作按钮 */}
      <div className="pt-3.5 flex gap-2 border-t border-black/5 dark:border-white/5 mt-3">
        <button
          type="button"
          className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-[11px] font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-all focus:outline-none"
          onClick={handleCancel}
        >
          取消
        </button>
        <button
          type="button"
          className="flex-1 justify-center rounded-lg border border-transparent bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[var(--color-accent)] transition-all shadow-sm shadow-[var(--color-accent)]/20 focus:outline-none"
          onClick={handleSave}
        >
          保存
        </button>
      </div>
    </div>
  );
}

function CustomSelect({
  value,
  onChange,
  options,
  position = "bottom",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  position?: "top" | "bottom";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-[11px] bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded-lg px-2.5 py-1.5 text-left outline-none border border-black/10 dark:border-white/10 flex justify-between items-center cursor-default hover:bg-black/10 dark:hover:bg-white/10 transition-colors animate-none"
      >
        <span>{currentOption?.label}</span>
        <span className="text-[9px] opacity-60">▼</span>
      </button>
      {isOpen && (
        <div className={cn(
          "absolute z-[110] left-0 right-0 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-lg shadow-xl overflow-hidden py-1 max-h-[160px] overflow-y-auto hidden-native-scrollbar",
          position === "top" ? "bottom-full mb-1" : "top-full mt-1"
        )}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[11px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-default block",
                opt.value === value ? "text-[var(--color-accent)] font-semibold" : "text-[var(--color-text)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

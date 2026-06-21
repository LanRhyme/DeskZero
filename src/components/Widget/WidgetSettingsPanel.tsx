import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { SwitchToggle } from "@/components/UI/SwitchToggle";
import { ColorPicker } from "@/components/UI/ColorPicker";
import { SegmentedControl } from "@/components/UI/SegmentedControl";
import { CustomSelect } from "@/components/UI/CustomSelect";
import { SettingRow } from "@/components/UI/SettingRow";
import { Slider } from "@/components/UI/Slider";
import { useContainerStore } from "@/stores/containerStore";
import type { Container as ContainerType } from "@/types/container";
import type { WidgetConfig } from "@/types/widget";
import { cn } from "@/utils/cn";

function generateId() {
  return "countdown-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function CountdownEventManager() {
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [mode, setMode] = useState("countdown");
  const [color, setColor] = useState("#3b82f6");
  const [events, setEvents] = useState<{ id: string; name: string; targetDate: string; mode: string; color: string }[]>([]);

  const fetchEvents = async () => {
    try {
      const data = await invoke<{ id: string; name: string; targetDate: string; mode: string; color: string }[]>("get_countdown_events");
      setEvents(data);
    } catch {}
  };

  useEffect(() => {
    fetchEvents();
    const unlistenPromise = listen("countdown-events-updated", () => {
      fetchEvents();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !date) return;
    try {
      await invoke("add_countdown_event", {
        event: { id: generateId(), name: name.trim(), targetDate: date, mode, color }
      });
      setName("");
      setDate("");
      await emit("countdown-events-updated");
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_countdown_event", { id });
      await emit("countdown-events-updated");
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-2">
      {/* 添加表单 */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="事件名称"
          className="flex-1 bg-black/5 dark:bg-white/5 rounded px-2 py-1 text-[10px] text-[var(--color-text)] outline-none border border-transparent focus:border-[var(--color-accent)]/30"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-black/5 dark:bg-white/5 rounded px-1.5 py-1 text-[10px] text-[var(--color-text)] outline-none border border-transparent focus:border-[var(--color-accent)]/30"
          style={{ colorScheme: "dark" }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1">
          {[
            { value: "countdown", label: "倒计日" },
            { value: "anniversary", label: "纪念日" },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] transition-all",
                mode === m.value
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)]"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-[var(--color-text-secondary)]">颜色:</span>
          {["#3b82f6", "#ef4444", "#f59e0b", "#22c55e", "#a855f7", "#ec4899"].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn("w-3.5 h-3.5 rounded-full border-2 transition-all", color === c ? "border-[var(--color-text)] scale-110" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          onClick={handleAdd}
          disabled={!name.trim() || !date}
          className="ml-auto px-2 py-0.5 rounded bg-[var(--color-accent)] text-white text-[9px] disabled:opacity-30 hover:opacity-90 transition-opacity"
        >
          添加
        </button>
      </div>

      {/* 已有事件列表 */}
      {events.length > 0 && (
        <div className="space-y-0.5 max-h-32 overflow-y-auto hidden-native-scrollbar">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-black/[0.02] dark:bg-white/[0.03]">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
              <span className="flex-1 text-[10px] text-[var(--color-text)] truncate">{ev.name}</span>
              <span className="text-[9px] text-[var(--color-text-secondary)]">{ev.mode === "anniversary" ? "纪念" : "倒计"}</span>
              <span className="text-[9px] text-[var(--color-text-secondary)]">{ev.targetDate}</span>
              <button onClick={() => handleDelete(ev.id)} className="text-[var(--color-text-secondary)] hover:text-red-400 text-[10px]">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [bgColor, setBgColor] = useState(container.style.backgroundColor || "theme");

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

  // 6. 倒计日设置
  const [countdownDisplayMode, setCountdownDisplayMode] = useState(widgetConfig.config?.displayMode || "list");
  const [countdownFontSizeScale, setCountdownFontSizeScale] = useState(widgetConfig.config?.fontSizeScale ?? 1.0);
  const [countdownFontColor, setCountdownFontColor] = useState(widgetConfig.config?.fontColor || "theme");
  const [countdownSortOrder, setCountdownSortOrder] = useState(widgetConfig.config?.sortOrder || "date-asc");

  // 7. 待办设置
  const [todoSortOrder, setTodoSortOrder] = useState(widgetConfig.config?.sortOrder || "completed-last");
  const [todoFontSizeScale, setTodoFontSizeScale] = useState(widgetConfig.config?.fontSizeScale ?? 1.0);
  const [todoShowPriority, setTodoShowPriority] = useState(widgetConfig.config?.showPriority !== false);
  const [todoShowDueDate, setTodoShowDueDate] = useState(widgetConfig.config?.showDueDate !== false);
  const [todoFontColor, setTodoFontColor] = useState(widgetConfig.config?.fontColor || "theme");

  // 8. 日历设置
  const [calendarShowLunar, setCalendarShowLunar] = useState(widgetConfig.config?.showLunar !== false);
  const [calendarFontSizeScale, setCalendarFontSizeScale] = useState(widgetConfig.config?.fontSizeScale ?? 1.0);
  const [calendarFontColor, setCalendarFontColor] = useState(widgetConfig.config?.fontColor || "theme");
  const [calendarHighlightToday, setCalendarHighlightToday] = useState(widgetConfig.config?.highlightToday !== false);
  const [calendarStartOfWeek, setCalendarStartOfWeek] = useState(widgetConfig.config?.startOfWeek || "monday");
  const [calendarShowFestivals, setCalendarShowFestivals] = useState(widgetConfig.config?.showFestivals !== false);
  const [calendarFestivalColor, setCalendarFestivalColor] = useState(widgetConfig.config?.festivalColor || "#ef4444");

  // 9. 天气设置
  const [weatherFontSizeScale, setWeatherFontSizeScale] = useState(widgetConfig.config?.fontSizeScale ?? 1.0);
  const [weatherFontColor, setWeatherFontColor] = useState(widgetConfig.config?.fontColor || "theme");
  const [weatherShowForecast, setWeatherShowForecast] = useState(widgetConfig.config?.showForecast !== false);
  const [weatherShowDetails, setWeatherShowDetails] = useState(widgetConfig.config?.showDetails !== false);
  const [weatherStyle, setWeatherStyle] = useState(widgetConfig.config?.weatherStyle || "auto");

  // 10. 音乐设置
  const [musicFontSizeScale, setMusicFontSizeScale] = useState(widgetConfig.config?.fontSizeScale ?? 1.0);
  const [musicFontColor, setMusicFontColor] = useState(widgetConfig.config?.fontColor || "theme");
  const [musicShowProgress, setMusicShowProgress] = useState(widgetConfig.config?.showProgress !== false);
  const [musicStyle, setMusicStyle] = useState(widgetConfig.config?.musicStyle || "horizontal");

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
      case "countdown":
        Object.assign(newConfig, {
          displayMode: countdownDisplayMode,
          fontSizeScale: countdownFontSizeScale,
          fontColor: countdownFontColor,
          sortOrder: countdownSortOrder,
        });
        break;
      case "todo":
        Object.assign(newConfig, {
          sortOrder: todoSortOrder,
          fontSizeScale: todoFontSizeScale,
          showPriority: todoShowPriority,
          showDueDate: todoShowDueDate,
          fontColor: todoFontColor,
        });
        break;
      case "calendar":
        Object.assign(newConfig, {
          showLunar: calendarShowLunar,
          fontSizeScale: calendarFontSizeScale,
          fontColor: calendarFontColor,
          highlightToday: calendarHighlightToday,
          startOfWeek: calendarStartOfWeek,
          showFestivals: calendarShowFestivals,
          festivalColor: calendarFestivalColor,
        });
        break;
      case "weather":
        Object.assign(newConfig, {
          fontSizeScale: weatherFontSizeScale,
          fontColor: weatherFontColor,
          showForecast: weatherShowForecast,
          showDetails: weatherShowDetails,
          weatherStyle,
        });
        break;
      case "music":
        Object.assign(newConfig, {
          fontSizeScale: musicFontSizeScale,
          fontColor: musicFontColor,
          showProgress: musicShowProgress,
          musicStyle,
        });
        break;
    }

    updateContainerStyle(container.id, {
      backgroundOpacity: opacity,
      cornerRadius,
      backgroundColor: bgColor,
      config: {
        ...widgetConfig,
        config: newConfig,
      },
    } as any);
  }, [
    opacity,
    cornerRadius,
    bgColor,
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
    countdownDisplayMode,
    countdownFontSizeScale,
    countdownFontColor,
    countdownSortOrder,
    todoSortOrder,
    todoFontSizeScale,
    todoShowPriority,
    todoShowDueDate,
    todoFontColor,
    calendarShowLunar,
    calendarFontSizeScale,
    calendarFontColor,
    calendarHighlightToday,
    calendarStartOfWeek,
    calendarShowFestivals,
    calendarFestivalColor,
    weatherFontSizeScale,
    weatherFontColor,
    weatherShowForecast,
    weatherShowDetails,
    weatherStyle,
    musicFontSizeScale,
    musicFontColor,
    musicShowProgress,
    musicStyle,
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
            <SettingRow title="表盘样式" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "digital", label: "数字时钟" },
                  { value: "analog", label: "指针表盘" },
                ]}
                value={clockStyle}
                onChange={setClockStyle}
              />
            </SettingRow>

            {clockStyle === "digital" && (
              <>
                <SettingRow title="数字特效" layout="vertical">
                  <SegmentedControl
                    options={[
                      { value: "minimal", label: "极简" },
                      { value: "glow", label: "霓虹" },
                      { value: "retro", label: "LED" },
                    ]}
                    value={digitalStyle}
                    onChange={setDigitalStyle}
                    variant="accent"
                  />
                </SettingRow>

                 <SettingRow title="文字颜色" layout="vertical">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SegmentedControl
                      options={[
                        { value: "theme", label: "主题" },
                        { value: "accent", label: "强调" },
                        { value: "gradient-rainbow", label: "渐变" },
                        { value: "#f9fafb", label: "象牙白" },
                        { value: "#1f2937", label: "深炭黑" },
                        { value: "#10b981", label: "极光绿" },
                        { value: "#f97316", label: "活力橙" },
                      ]}
                      value={fontColor.startsWith("#") && !["#f9fafb", "#1f2937", "#10b981", "#f97316"].includes(fontColor) ? "" : fontColor}
                      onChange={setFontColor}
                      variant="accent"
                    />
                    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                      <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                      <ColorPicker
                        size="sm"
                        value={fontColor.startsWith("#") && !["#f9fafb", "#1f2937", "#10b981", "#f97316"].includes(fontColor) ? fontColor : "#ffffff"}
                        onChange={setFontColor}
                      />
                    </div>
                  </div>
                </SettingRow>

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
                      <SwitchToggle checked={sw.val} onChange={sw.set} />
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
            <SettingRow title="便签背景色" layout="vertical">
              <ColorPicker
                value={stickyColor}
                onChange={setStickyColor}
                presets={[
                  { color: "#ffeb3b", label: "柠檬黄" },
                  { color: "#ff9800", label: "甜橙橙" },
                  { color: "#ffebef", label: "樱花粉" },
                  { color: "#e8f5e9", label: "薄荷绿" },
                  { color: "#e3f2fd", label: "冰晶蓝" },
                  { color: "#f3e5f5", label: "薰衣紫" },
                ]}
              />
            </SettingRow>

            {/* 新增：便签文字颜色 */}
            <SettingRow title="文字颜色" layout="vertical">
              <ColorPicker
                value={noteFontColor}
                onChange={setNoteFontColor}
                presets={[
                  { color: "#1f2937", label: "经典黑" },
                  { color: "#ffffff", label: "纯洁白" },
                  { color: "#1e3a8a", label: "复古蓝" },
                  { color: "#7f1d1d", label: "暗紫红" },
                ]}
              />
            </SettingRow>

            <SettingRow title="字体风格" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "default", label: "无衬线" },
                  { value: "mono", label: "等宽" },
                  { value: "kaiti", label: "楷体" },
                ]}
                value={noteFontFamily}
                onChange={setNoteFontFamily}
              />
            </SettingRow>

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

            <SettingRow title="对齐方式" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "left", label: "左对齐" },
                  { value: "center", label: "居中" },
                  { value: "right", label: "右对齐" },
                ]}
                value={noteTextAlign}
                onChange={setNoteTextAlign}
              />
            </SettingRow>

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
                  <SwitchToggle checked={sw.val} onChange={sw.set} />
                </label>
              ))}
            </div>
          </div>
        );

      case "systemMonitor":
        return (
          <div className="space-y-3.5">
            <SettingRow title="布局排版" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "list", label: "进度列表" },
                  { value: "gauge", label: "圆环表盘" },
                  { value: "compact-dashboard", label: "极客控制台" },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            </SettingRow>

            <SettingRow title="基准指示色" layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: "主题" },
                    { value: "accent", label: "强调" },
                    { value: "#3b82f6", label: "科技蓝" },
                    { value: "#10b981", label: "极光绿" },
                    { value: "#f97316", label: "活力橙" },
                  ]}
                  value={monitorColor.startsWith("#") && !["#3b82f6", "#10b981", "#f97316"].includes(monitorColor) ? "" : monitorColor}
                  onChange={setMonitorColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <ColorPicker
                    size="sm"
                    value={monitorColor.startsWith("#") && !["#3b82f6", "#10b981", "#f97316"].includes(monitorColor) ? monitorColor : "#3b82f6"}
                    onChange={setMonitorColor}
                  />
                </div>
              </div>
            </SettingRow>

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
                  <SwitchToggle checked={sw.val} onChange={sw.set} />
                </label>
              ))}
            </div>
          </div>
        );

      case "hitokoto":
        return (
          <div className="space-y-3.5">
            <SettingRow title="数据来源" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "api", label: "API 自动拉取" },
                  { value: "custom", label: "自定义文本" },
                ]}
                value={hitokotoSourceMode}
                onChange={(val) => {
                  setHitokotoSourceMode(val);
                  if (val === "custom" && hitokotoClickAction === "refresh") {
                    setHitokotoClickAction("copy");
                  }
                }}
              />
            </SettingRow>

            {/* API 模式下的配置 */}
            {hitokotoSourceMode === "api" && (
              <>
                <SettingRow title="语录类型" layout="vertical">
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
                </SettingRow>

                <SettingRow title="自动刷新频率" layout="vertical">
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
                </SettingRow>
              </>
            )}

            {/* 自定义模式下的配置 */}
            {hitokotoSourceMode === "custom" && (
              <div className="space-y-2.5">
                <SettingRow title="语录文本" layout="vertical">
                  <textarea
                    value={hitokotoCustomText}
                    onChange={(e) => setHitokotoCustomText(e.target.value)}
                    placeholder="输入要显示的句子..."
                    rows={2}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
                  />
                </SettingRow>
                <div className="grid grid-cols-2 gap-2">
                  <SettingRow title="作者" layout="vertical">
                    <input
                      type="text"
                      value={hitokotoCustomAuthor}
                      onChange={(e) => setHitokotoCustomAuthor(e.target.value)}
                      placeholder="选填"
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                  </SettingRow>
                  <SettingRow title="出处/来源" layout="vertical">
                    <input
                      type="text"
                      value={hitokotoCustomFrom}
                      onChange={(e) => setHitokotoCustomFrom(e.target.value)}
                      placeholder="选填"
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                  </SettingRow>
                </div>
              </div>
            )}

            <SettingRow title="点击卡片动作" layout="vertical">
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
            </SettingRow>

            <SettingRow title="文字颜色" layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: "主题" },
                    { value: "accent", label: "强调" },
                    { value: "gradient-rainbow", label: "渐变" },
                    { value: "#ffffff", label: "纯白" },
                    { value: "#1f2937", label: "深炭" },
                  ]}
                  value={hitokotoFontColor.startsWith("#") && !["#ffffff", "#1f2937"].includes(hitokotoFontColor) ? "" : hitokotoFontColor}
                  onChange={setHitokotoFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <ColorPicker
                    size="sm"
                    value={hitokotoFontColor.startsWith("#") && !["#ffffff", "#1f2937"].includes(hitokotoFontColor) ? hitokotoFontColor : "#10b981"}
                    onChange={setHitokotoFontColor}
                  />
                </div>
              </div>
            </SettingRow>

            <SettingRow title="文字对齐" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "left", label: "左对齐" },
                  { value: "center", label: "居中" },
                  { value: "right", label: "右对齐" },
                ]}
                value={hitokotoTextAlign}
                onChange={setHitokotoTextAlign}
              />
            </SettingRow>

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
                <SwitchToggle checked={hitokotoShowAuthor} onChange={setHitokotoShowAuthor} />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                  显示双引号装饰
                </span>
                <SwitchToggle checked={hitokotoShowQuotes} onChange={setHitokotoShowQuotes} />
              </label>
            </div>
          </div>
        );

      case "countdown":
        return (
          <div className="space-y-3.5">
            {/* 预设事件快速添加 */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">快速添加预设</span>
              <div className="flex flex-wrap gap-1">
                {[
                  { name: "元旦", date: `${new Date().getFullYear()}-01-01`, color: "#ef4444" },
                  { name: "春节", date: `${new Date().getFullYear()}-01-29`, color: "#f59e0b" },
                  { name: "情人节", date: `${new Date().getFullYear()}-02-14`, color: "#ec4899" },
                  { name: "妇女节", date: `${new Date().getFullYear()}-03-08`, color: "#a855f7" },
                  { name: "劳动节", date: `${new Date().getFullYear()}-05-01`, color: "#3b82f6" },
                  { name: "儿童节", date: `${new Date().getFullYear()}-06-01`, color: "#22c55e" },
                  { name: "建党节", date: `${new Date().getFullYear()}-07-01`, color: "#ef4444" },
                  { name: "建军节", date: `${new Date().getFullYear()}-08-01`, color: "#6366f1" },
                  { name: "教师节", date: `${new Date().getFullYear()}-09-10`, color: "#14b8a6" },
                  { name: "国庆节", date: `${new Date().getFullYear()}-10-01`, color: "#ef4444" },
                  { name: "平安夜", date: `${new Date().getFullYear()}-12-24`, color: "#22c55e" },
                  { name: "圣诞节", date: `${new Date().getFullYear()}-12-25`, color: "#ef4444" },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={async () => {
                      try {
                        let targetDate = preset.date;
                        const today = new Date();
                        const pDate = new Date(preset.date + "T00:00:00");
                        today.setHours(0, 0, 0, 0);
                        if (pDate < today) {
                          const [y, m, d] = preset.date.split("-");
                          targetDate = `${parseInt(y) + 1}-${m}-${d}`;
                        }

                        const id = "countdown-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                        await invoke("add_countdown_event", {
                          event: { id, name: preset.name, targetDate, mode: "countdown", color: preset.color }
                        });
                        await emit("countdown-events-updated");
                      } catch (e) { console.error(e); }
                    }}
                    className="px-1.5 py-0.5 rounded text-[9px] bg-black/5 dark:bg-white/5 text-[var(--color-text)] opacity-70 hover:opacity-100 hover:bg-[var(--color-accent)]/10 transition-all"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义添加 */}
            <CountdownEventManager />

            <SettingRow title="显示模式" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "list", label: "列表" },
                  { value: "cards", label: "卡片" },
                ]}
                value={countdownDisplayMode}
                onChange={setCountdownDisplayMode}
              />
            </SettingRow>

            <SettingRow title="排序方式" layout="vertical">
              <CustomSelect
                value={countdownSortOrder}
                onChange={setCountdownSortOrder}
                options={[
                  { value: "date-asc", label: "日期升序" },
                  { value: "date-desc", label: "日期降序" },
                  { value: "days-asc", label: "天数升序" },
                  { value: "days-desc", label: "天数降序" },
                ]}
              />
            </SettingRow>

            <SettingRow title="文字颜色" layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: "主题" },
                    { value: "accent", label: "强调" },
                  ]}
                  value={countdownFontColor.startsWith("#") ? "" : countdownFontColor}
                  onChange={setCountdownFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <ColorPicker
                    size="sm"
                    value={countdownFontColor.startsWith("#") ? countdownFontColor : "#ffffff"}
                    onChange={setCountdownFontColor}
                  />
                </div>
              </div>
            </SettingRow>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>文字大小比例</span>
                <span>{Math.round(countdownFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={countdownFontSizeScale} onChange={setCountdownFontSizeScale} />
            </div>
          </div>
        );

      case "todo":
        return (
          <div className="space-y-3.5">
            <SettingRow title="排序方式" layout="vertical">
              <CustomSelect
                value={todoSortOrder}
                onChange={setTodoSortOrder}
                options={[
                  { value: "manual", label: "手动排序" },
                  { value: "priority", label: "按优先级" },
                  { value: "dueDate", label: "按截止日期" },
                  { value: "completed-last", label: "已完成置底" },
                ]}
              />
            </SettingRow>

            <SettingRow title="文字颜色" layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: "主题" },
                    { value: "accent", label: "强调" },
                  ]}
                  value={todoFontColor.startsWith("#") ? "" : todoFontColor}
                  onChange={setTodoFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <ColorPicker
                    size="sm"
                    value={todoFontColor.startsWith("#") ? todoFontColor : "#ffffff"}
                    onChange={setTodoFontColor}
                  />
                </div>
              </div>
            </SettingRow>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>文字大小比例</span>
                <span>{Math.round(todoFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={todoFontSizeScale} onChange={setTodoFontSizeScale} />
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { label: "显示优先级色条", val: todoShowPriority, set: setTodoShowPriority },
                { label: "显示截止日期", val: todoShowDueDate, set: setTodoShowDueDate },
              ].map((sw) => (
                <label key={sw.label} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                    {sw.label}
                  </span>
                  <SwitchToggle checked={sw.val} onChange={sw.set} />
                </label>
              ))}
            </div>
          </div>
        );

      case "calendar":
        return (
          <div className="space-y-3.5">
            <SettingRow title="每周起始日" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "monday", label: "周一" },
                  { value: "sunday", label: "周日" },
                ]}
                value={calendarStartOfWeek}
                onChange={setCalendarStartOfWeek}
              />
            </SettingRow>

            <SettingRow title="文字颜色" layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: "主题" },
                    { value: "accent", label: "强调" },
                  ]}
                  value={calendarFontColor.startsWith("#") ? "" : calendarFontColor}
                  onChange={setCalendarFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <ColorPicker
                    size="sm"
                    value={calendarFontColor.startsWith("#") ? calendarFontColor : "#ffffff"}
                    onChange={setCalendarFontColor}
                  />
                </div>
              </div>
            </SettingRow>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>文字大小比例</span>
                <span>{Math.round(calendarFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={calendarFontSizeScale} onChange={setCalendarFontSizeScale} />
            </div>

            <SettingRow title="节日标记颜色" layout="vertical">
              <ColorPicker
                value={calendarFestivalColor}
                onChange={setCalendarFestivalColor}
                presets={[
                  { color: "#ef4444", label: "中国红" },
                  { color: "#f59e0b", label: "琥珀" },
                  { color: "#8b5cf6", label: "紫罗兰" },
                ]}
              />
            </SettingRow>

            <div className="space-y-2.5 pt-1">
              {[
                { label: "显示农历", val: calendarShowLunar, set: setCalendarShowLunar },
                { label: "高亮今天", val: calendarHighlightToday, set: setCalendarHighlightToday },
                { label: "显示节日", val: calendarShowFestivals, set: setCalendarShowFestivals },
              ].map((sw) => (
                <label key={sw.label} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                    {sw.label}
                  </span>
                  <SwitchToggle checked={sw.val} onChange={sw.set} />
                </label>
              ))}
            </div>
          </div>
        );

      case "weather":
        return (
          <div className="space-y-3.5">
            <div className="space-y-2.5">
              <SettingRow title="组件排版样式" layout="vertical">
                <SegmentedControl
                  options={[
                    { value: "auto", label: "自动响应" },
                    { value: "horizontal", label: "水平布局" },
                    { value: "vertical", label: "垂直堆叠" },
                  ]}
                  value={weatherStyle}
                  onChange={(val) => setWeatherStyle(val as any)}
                />
              </SettingRow>

              <div className="text-[11px] text-[var(--color-text-secondary)] opacity-80 px-2 py-2 leading-relaxed bg-black/5 dark:bg-white/5 rounded border border-black/5 dark:border-white/5 mt-1">
                ☁️ 当前天气服务由 <a href="https://wttr.in" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-accent)]">wttr.in</a> 强力驱动。<br/>
                系统已自动根据您的网络 IP 智能获取当地天气数据，完全免费且开箱即用。
              </div>
            </div>

            <SettingRow title="文字颜色" layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: "主题" },
                    { value: "accent", label: "强调" },
                  ]}
                  value={weatherFontColor.startsWith("#") ? "" : weatherFontColor}
                  onChange={setWeatherFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <ColorPicker
                    size="sm"
                    value={weatherFontColor.startsWith("#") ? weatherFontColor : "#ffffff"}
                    onChange={setWeatherFontColor}
                  />
                </div>
              </div>
            </SettingRow>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>文字大小比例</span>
                <span>{Math.round(weatherFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={weatherFontSizeScale} onChange={setWeatherFontSizeScale} />
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { label: "显示未来预报", val: weatherShowForecast, set: setWeatherShowForecast },
                { label: "显示详情 (湿度/风力/体感)", val: weatherShowDetails, set: setWeatherShowDetails },
              ].map((sw) => (
                <label key={sw.label} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                    {sw.label}
                  </span>
                  <SwitchToggle checked={sw.val} onChange={sw.set} />
                </label>
              ))}
            </div>
          </div>
        );

      case "music":
        return (
          <div className="space-y-3.5">
            <SettingRow title="显示样式" layout="vertical">
              <SegmentedControl
                options={[
                  { value: "horizontal", label: "水平" },
                  { value: "vertical", label: "垂直" },
                  { value: "mini", label: "迷你" },
                  { value: "terminal", label: "终端" },
                ]}
                value={musicStyle}
                onChange={setMusicStyle}
              />
            </SettingRow>

            <SettingRow title="文字颜色" layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: "主题" },
                    { value: "accent", label: "强调" },
                  ]}
                  value={musicFontColor.startsWith("#") ? "" : musicFontColor}
                  onChange={setMusicFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">自定义</span>
                  <ColorPicker
                    size="sm"
                    value={musicFontColor.startsWith("#") ? musicFontColor : "#ffffff"}
                    onChange={setMusicFontColor}
                  />
                </div>
              </div>
            </SettingRow>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>文字大小比例</span>
                <span>{Math.round(musicFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={musicFontSizeScale} onChange={setMusicFontSizeScale} />
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                  显示播放进度条
                </span>
                <SwitchToggle checked={musicShowProgress} onChange={setMusicShowProgress} />
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
            {/* 背景设置 */}
            {widgetConfig.widgetType !== "stickyNote" && (
              <SettingRow title="背景设置" layout="vertical">
                <SegmentedControl
                  options={[
                    { value: "theme", label: "跟随主题" },
                    { value: "custom", label: "自定义" },
                  ]}
                  value={bgColor === "theme" || !bgColor ? "theme" : "custom"}
                  onChange={(v) => setBgColor(v === "theme" ? "theme" : "#000000")}
                  variant="accent"
                />
                <div className="flex items-center gap-3">
                  {bgColor !== "theme" && bgColor && (
                    <ColorPicker
                      value={bgColor.startsWith("#") ? bgColor : "#000000"}
                      onChange={setBgColor}
                      size="md"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
                      <span>不透明度</span>
                      <span>{Math.round(opacity * 100)}%</span>
                    </div>
                    <Slider min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} />
                  </div>
                </div>
              </SettingRow>
            )}

            {/* 便签类小组件只显示不透明度 */}
            {widgetConfig.widgetType === "stickyNote" && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                  <span>背景不透明度</span>
                  <span>{Math.round(opacity * 100)}%</span>
                </div>
                <Slider min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} />
              </div>
            )}

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
              <SwitchToggle checked={transparentBackground} onChange={setTransparentBackground} />
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



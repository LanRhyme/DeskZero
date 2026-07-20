import { X, LayoutGrid, Paintbrush } from "lucide-react";
import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { SwitchToggle } from "@/components/UI/SwitchToggle";
import { ColorPicker } from "@/components/UI/ColorPicker";
import { SegmentedControl } from "@/components/UI/SegmentedControl";
import { CustomSelect } from "@/components/UI/CustomSelect";
import { SettingRow } from "@/components/UI/SettingRow";
import { Slider } from "@/components/UI/Slider";
import { TextInput } from "@/components/UI/TextInput";
import { NumberInput } from "@/components/UI/NumberInput";
import { useContainerStore } from "@/stores/containerStore";
import type { Container as ContainerType } from "@/types/container";
import type { WidgetConfig, ConfigField } from "@/types/widget";
import { cn } from "@/utils/cn";

function generateId() {
  return "countdown-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function CountdownEventManager() {
  const { t } = useTranslation();
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
          placeholder={t("widget.countdown.eventName")}
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
            { value: "countdown", label: t("widget.countdown.countdown") },
            { value: "anniversary", label: t("widget.countdown.anniversary") },
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
          <span className="text-[9px] text-[var(--color-text-secondary)]">{t("widget.countdown.color")}:</span>
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
          {t("common.add")}
        </button>
      </div>

      {/* 已有事件列表 */}
      {events.length > 0 && (
        <div className="space-y-0.5 max-h-32 overflow-y-auto hidden-native-scrollbar">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-black/[0.02] dark:bg-white/[0.03]">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
              <span className="flex-1 text-[10px] text-[var(--color-text)] truncate">{ev.name}</span>
              <span className="text-[9px] text-[var(--color-text-secondary)]">{ev.mode === "anniversary" ? t("widget.countdown.anniversaryShort") : t("widget.countdown.countdownShort")}</span>
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
  customConfigSchema?: ConfigField[] | null;
}

export function WidgetSettingsPanel({
  container,
  widgetConfig,
  onClose,
  customConfigSchema,
}: WidgetSettingsPanelProps) {
  const { updateContainerStyle } = useContainerStore();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"style" | "content">("style");

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

  // 11. 自定义小组件设置（由 configSchema 动态驱动）
  const [customConfig, setCustomConfig] = useState<Record<string, any>>(() => {
    if (widgetConfig.widgetType !== "custom" || !customConfigSchema) return {};
    const initial: Record<string, any> = {};
    for (const field of customConfigSchema) {
      initial[field.key] = widgetConfig.config?.[field.key] ?? field.default;
    }
    return initial;
  });

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
      case "custom":
        Object.assign(newConfig, customConfig);
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
    customConfig,
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
            <SettingRow title={t("widget.clock.dialStyle")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "digital", label: t("widget.clock.digital") },
                  { value: "analog", label: t("widget.clock.analog") },
                ]}
                value={clockStyle}
                onChange={setClockStyle}
              />
            </SettingRow>

            {clockStyle === "digital" && (
              <>
                <SettingRow title={t("widget.clock.digitalEffect")} layout="vertical">
                  <SegmentedControl
                    options={[
                      { value: "minimal", label: t("widget.clock.minimal") },
                      { value: "glow", label: t("widget.clock.neon") },
                      { value: "retro", label: "LED" },
                    ]}
                    value={digitalStyle}
                    onChange={setDigitalStyle}
                    variant="accent"
                  />
                </SettingRow>

                 <SettingRow title={t("widget.settingsPanel.textColor")} layout="vertical">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SegmentedControl
                      options={[
                        { value: "theme", label: t("widget.settingsPanel.theme") },
                        { value: "accent", label: t("widget.settingsPanel.accent") },
                        { value: "gradient-rainbow", label: t("widget.settingsPanel.gradient") },
                        { value: "#f9fafb", label: t("widget.clock.colorPresets.ivory") },
                        { value: "#1f2937", label: t("widget.clock.colorPresets.charcoal") },
                        { value: "#10b981", label: t("widget.clock.colorPresets.aurora") },
                        { value: "#f97316", label: t("widget.clock.colorPresets.vibrant") },
                      ]}
                      value={fontColor.startsWith("#") && !["#f9fafb", "#1f2937", "#10b981", "#f97316"].includes(fontColor) ? "" : fontColor}
                      onChange={setFontColor}
                      variant="accent"
                    />
                    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                      <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.settingsPanel.custom")}</span>
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
                    <span>{t("widget.settingsPanel.fontSizeRatio")}</span>
                    <span>{Math.round(fontSizeScale * 100)}%</span>
                  </div>
                  <Slider min={0.5} max={2.0} step={0.1} value={fontSizeScale} onChange={setFontSizeScale} />
                </div>

                {/* 显示开关 */}
                <div className="space-y-2.5 pt-1">
                  {[
                    { label: t("widget.settingsPanel.h12"), val: hour12, set: setHour12 },
                    { label: t("widget.settingsPanel.showSeconds"), val: showSeconds, set: setShowSeconds },
                    { label: t("widget.settingsPanel.showDate"), val: showDate, set: setShowDate },
                    { label: t("widget.settingsPanel.showWeekday"), val: showWeekday, set: setShowWeekday },
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
            <SettingRow title={t("widget.stickyNote.bgColor")} layout="vertical">
              <ColorPicker
                value={stickyColor}
                onChange={setStickyColor}
                presets={[
                  { color: "#ffeb3b", label: t("widget.stickyNote.colors.lemon") },
                  { color: "#ff9800", label: t("widget.stickyNote.colors.orange") },
                  { color: "#ffebef", label: t("widget.stickyNote.colors.sakura") },
                  { color: "#e8f5e9", label: t("widget.stickyNote.colors.mint") },
                  { color: "#e3f2fd", label: t("widget.stickyNote.colors.ice") },
                  { color: "#f3e5f5", label: t("widget.stickyNote.colors.lavender") },
                ]}
              />
            </SettingRow>

            {/* 新增：便签文字颜色 */}
            <SettingRow title={t("widget.stickyNote.textColor")} layout="vertical">
              <ColorPicker
                value={noteFontColor}
                onChange={setNoteFontColor}
                presets={[
                  { color: "#1f2937", label: t("widget.stickyNote.textColors.classicBlack") },
                  { color: "#ffffff", label: t("widget.stickyNote.textColors.pureWhite") },
                  { color: "#1e3a8a", label: t("widget.stickyNote.textColors.vintageBlue") },
                  { color: "#7f1d1d", label: t("widget.stickyNote.textColors.darkPurple") },
                ]}
              />
            </SettingRow>

            <SettingRow title={t("widget.stickyNote.fontStyle")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "default", label: t("widget.stickyNote.sansSerif") },
                  { value: "mono", label: t("widget.stickyNote.monospace") },
                  { value: "kaiti", label: t("widget.stickyNote.kaiTi") },
                ]}
                value={noteFontFamily}
                onChange={setNoteFontFamily}
              />
            </SettingRow>

            {/* 排版微调 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>{t("widget.stickyNote.fontSize")}</span>
                <span>{noteFontSize}px</span>
              </div>
              <Slider min={12} max={24} step={1} value={noteFontSize} onChange={(v) => setNoteFontSize(Math.round(v))} />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>{t("widget.stickyNote.lineHeight")}</span>
                <span>{noteLineHeight.toFixed(1)}</span>
              </div>
              <Slider min={1.2} max={2.0} step={0.1} value={noteLineHeight} onChange={setNoteLineHeight} />
            </div>

            <SettingRow title={t("widget.stickyNote.alignment")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "left", label: t("widget.stickyNote.alignLeft") },
                  { value: "center", label: t("widget.stickyNote.alignCenter") },
                  { value: "right", label: t("widget.stickyNote.alignRight") },
                ]}
                value={noteTextAlign}
                onChange={setNoteTextAlign}
              />
            </SettingRow>

            {/* 卡片装饰开关 */}
            <div className="space-y-2.5 pt-1">
              {[
                { label: t("widget.stickyNote.showTape"), val: showTape, set: setShowTape },
                { label: t("widget.stickyNote.showLines"), val: showLines, set: setShowLines },
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
            <SettingRow title={t("widget.systemMonitor.layout")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "list", label: t("widget.systemMonitor.progressList") },
                  { value: "gauge", label: t("widget.systemMonitor.ringGauge") },
                  { value: "compact-dashboard", label: t("widget.systemMonitor.geekConsole") },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            </SettingRow>

            <SettingRow title={t("widget.systemMonitor.accentColor")} layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: t("widget.settingsPanel.theme") },
                    { value: "accent", label: t("widget.settingsPanel.accent") },
                    { value: "#3b82f6", label: t("widget.systemMonitor.techBlue") },
                    { value: "#10b981", label: t("widget.systemMonitor.auroraGreen") },
                    { value: "#f97316", label: t("widget.systemMonitor.vibrantOrange") },
                  ]}
                  value={monitorColor.startsWith("#") && !["#3b82f6", "#10b981", "#f97316"].includes(monitorColor) ? "" : monitorColor}
                  onChange={setMonitorColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.settingsPanel.custom")}</span>
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
                <span>{t("widget.systemMonitor.refreshRate")}</span>
                <span>{t("widget.systemMonitor.seconds", { value: refreshInterval })}</span>
              </div>
              <Slider min={1} max={30} step={1} value={refreshInterval} onChange={(v) => setRefreshInterval(Math.round(v))} />
            </div>

            {/* 内容大小比例 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>{t("widget.settingsPanel.scaleRatio")}</span>
                <span>{Math.round(contentSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.6} step={0.1} value={contentSizeScale} onChange={setContentSizeScale} />
            </div>

            {/* 指标展示开关 */}
            <div className="space-y-2.5 pt-1">
              {[
                { label: t("widget.systemMonitor.showCpu"), val: showCpu, set: setShowCpu },
                { label: t("widget.systemMonitor.showMemory"), val: showMemory, set: setShowMemory },
                { label: t("widget.systemMonitor.showDisk"), val: showDisk, set: setShowDisk },
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
            <SettingRow title={t("widget.hitokoto.dataSource")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "api", label: t("widget.hitokoto.apiAuto") },
                  { value: "custom", label: t("widget.hitokoto.customText") },
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
                <SettingRow title={t("widget.hitokoto.quoteType")} layout="vertical">
                  <CustomSelect
                    value={hitokotoCategory}
                    onChange={setHitokotoCategory}
                    options={[
                      { value: "all", label: t("widget.hitokoto.random") },
                      { value: "a", label: t("widget.hitokoto.anime") },
                      { value: "b", label: t("widget.hitokoto.comic") },
                      { value: "c", label: t("widget.hitokoto.game") },
                      { value: "d", label: t("widget.hitokoto.novel") },
                      { value: "f", label: t("widget.hitokoto.original") },
                      { value: "h", label: t("widget.hitokoto.net") },
                      { value: "k", label: t("widget.hitokoto.philosophy") },
                      { value: "o", label: t("widget.hitokoto.poetry") },
                      { value: "i", label: t("widget.hitokoto.soul") },
                      { value: "j", label: t("widget.hitokoto.other") },
                    ]}
                  />
                </SettingRow>

                <SettingRow title={t("widget.hitokoto.refreshRate")} layout="vertical">
                  <CustomSelect
                    value={String(hitokotoRefreshInterval)}
                    onChange={(val) => setHitokotoRefreshInterval(Number(val))}
                    options={[
                      { value: "0", label: t("widget.hitokoto.manual") },
                      { value: "300", label: t("widget.hitokoto.every5min") },
                      { value: "900", label: t("widget.hitokoto.every15min") },
                      { value: "1800", label: t("widget.hitokoto.every30min") },
                      { value: "3600", label: t("widget.hitokoto.every1hour") },
                      { value: "21600", label: t("widget.hitokoto.every6hours") },
                      { value: "43200", label: t("widget.hitokoto.every12hours") },
                      { value: "86400", label: t("widget.hitokoto.every24hours") },
                    ]}
                    position="top"
                  />
                </SettingRow>
              </>
            )}

            {/* 自定义模式下的配置 */}
            {hitokotoSourceMode === "custom" && (
              <div className="space-y-2.5">
                <SettingRow title={t("widget.hitokoto.quoteText")} layout="vertical">
                  <textarea
                    value={hitokotoCustomText}
                    onChange={(e) => setHitokotoCustomText(e.target.value)}
                    placeholder={t("widget.hitokoto.quotePlaceholder")}
                    rows={2}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
                  />
                </SettingRow>
                <div className="grid grid-cols-2 gap-2">
                  <SettingRow title={t("widget.hitokoto.author")} layout="vertical">
                    <input
                      type="text"
                      value={hitokotoCustomAuthor}
                      onChange={(e) => setHitokotoCustomAuthor(e.target.value)}
                      placeholder={t("widget.hitokoto.authorPlaceholder")}
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                  </SettingRow>
                  <SettingRow title={t("widget.hitokoto.source")} layout="vertical">
                    <input
                      type="text"
                      value={hitokotoCustomFrom}
                      onChange={(e) => setHitokotoCustomFrom(e.target.value)}
                      placeholder={t("widget.hitokoto.sourcePlaceholder")}
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                  </SettingRow>
                </div>
              </div>
            )}

            <SettingRow title={t("widget.hitokoto.clickAction")} layout="vertical">
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                {[
                  { key: "refresh", label: t("widget.hitokoto.actionRefresh") },
                  { key: "copy", label: t("widget.hitokoto.actionCopy") },
                  { key: "none", label: t("widget.hitokoto.actionNone") },
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

            <SettingRow title={t("widget.settingsPanel.textColor")} layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: t("widget.settingsPanel.theme") },
                    { value: "accent", label: t("widget.settingsPanel.accent") },
                    { value: "gradient-rainbow", label: t("widget.settingsPanel.gradient") },
                    { value: "#ffffff", label: t("widget.settingsPanel.pureWhite") },
                    { value: "#1f2937", label: t("widget.settingsPanel.charcoal") },
                  ]}
                  value={hitokotoFontColor.startsWith("#") && !["#ffffff", "#1f2937"].includes(hitokotoFontColor) ? "" : hitokotoFontColor}
                  onChange={setHitokotoFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.settingsPanel.custom")}</span>
                  <ColorPicker
                    size="sm"
                    value={hitokotoFontColor.startsWith("#") && !["#ffffff", "#1f2937"].includes(hitokotoFontColor) ? hitokotoFontColor : "#10b981"}
                    onChange={setHitokotoFontColor}
                  />
                </div>
              </div>
            </SettingRow>

            <SettingRow title={t("widget.settingsPanel.textAlign")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "left", label: t("widget.settingsPanel.alignLeft") },
                  { value: "center", label: t("widget.settingsPanel.alignCenter") },
                  { value: "right", label: t("widget.settingsPanel.alignRight") },
                ]}
                value={hitokotoTextAlign}
                onChange={setHitokotoTextAlign}
              />
            </SettingRow>

            {/* 字号缩放比例 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                <span>{t("widget.settingsPanel.textSizeRatio")}</span>
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
                  {t("widget.hitokoto.showSource")}
                </span>
                <SwitchToggle checked={hitokotoShowAuthor} onChange={setHitokotoShowAuthor} />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                  {t("widget.hitokoto.showQuotes")}
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
              <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.countdown.quickPresets")}</span>
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

            <SettingRow title={t("widget.countdown.displayMode")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "list", label: t("widget.countdown.listMode") },
                  { value: "cards", label: t("widget.countdown.cardMode") },
                ]}
                value={countdownDisplayMode}
                onChange={setCountdownDisplayMode}
              />
            </SettingRow>

            <SettingRow title={t("widget.countdown.sortOrder")} layout="vertical">
              <CustomSelect
                value={countdownSortOrder}
                onChange={setCountdownSortOrder}
                options={[
                  { value: "date-asc", label: t("widget.countdown.dateAsc") },
                  { value: "date-desc", label: t("widget.countdown.dateDesc") },
                  { value: "days-asc", label: t("widget.countdown.daysAsc") },
                  { value: "days-desc", label: t("widget.countdown.daysDesc") },
                ]}
              />
            </SettingRow>

            <SettingRow title={t("widget.settingsPanel.textColor")} layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: t("widget.settingsPanel.theme") },
                    { value: "accent", label: t("widget.settingsPanel.accent") },
                  ]}
                  value={countdownFontColor.startsWith("#") ? "" : countdownFontColor}
                  onChange={setCountdownFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.settingsPanel.custom")}</span>
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
                <span>{t("widget.settingsPanel.textSizeRatio")}</span>
                <span>{Math.round(countdownFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={countdownFontSizeScale} onChange={setCountdownFontSizeScale} />
            </div>
          </div>
        );

      case "todo":
        return (
          <div className="space-y-3.5">
            <SettingRow title={t("widget.todo.sortBy")} layout="vertical">
              <CustomSelect
                value={todoSortOrder}
                onChange={setTodoSortOrder}
                options={[
                  { value: "manual", label: t("widget.todo.manualSort") },
                  { value: "priority", label: t("widget.todo.byPriority") },
                  { value: "dueDate", label: t("widget.todo.byDueDate") },
                  { value: "completed-last", label: t("widget.todo.completedLast") },
                ]}
              />
            </SettingRow>

            <SettingRow title={t("widget.settingsPanel.textColor")} layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: t("widget.settingsPanel.theme") },
                    { value: "accent", label: t("widget.settingsPanel.accent") },
                  ]}
                  value={todoFontColor.startsWith("#") ? "" : todoFontColor}
                  onChange={setTodoFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.settingsPanel.custom")}</span>
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
                <span>{t("widget.settingsPanel.textSizeRatio")}</span>
                <span>{Math.round(todoFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={todoFontSizeScale} onChange={setTodoFontSizeScale} />
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { label: t("widget.todo.showPriorityBar"), val: todoShowPriority, set: setTodoShowPriority },
                { label: t("widget.todo.showDueDate"), val: todoShowDueDate, set: setTodoShowDueDate },
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
            <SettingRow title={t("widget.calendar.weekStart")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "monday", label: t("widget.calendar.monday") },
                  { value: "sunday", label: t("widget.calendar.sunday") },
                ]}
                value={calendarStartOfWeek}
                onChange={setCalendarStartOfWeek}
              />
            </SettingRow>

            <SettingRow title={t("widget.settingsPanel.textColor")} layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: t("widget.settingsPanel.theme") },
                    { value: "accent", label: t("widget.settingsPanel.accent") },
                  ]}
                  value={calendarFontColor.startsWith("#") ? "" : calendarFontColor}
                  onChange={setCalendarFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.settingsPanel.custom")}</span>
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
                <span>{t("widget.settingsPanel.textSizeRatio")}</span>
                <span>{Math.round(calendarFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={calendarFontSizeScale} onChange={setCalendarFontSizeScale} />
            </div>

            <SettingRow title={t("widget.calendar.festivalColor")} layout="vertical">
              <ColorPicker
                value={calendarFestivalColor}
                onChange={setCalendarFestivalColor}
                presets={[
                  { color: "#ef4444", label: t("widget.calendar.chinaRed") },
                  { color: "#f59e0b", label: t("widget.calendar.amber") },
                  { color: "#8b5cf6", label: t("widget.calendar.violet") },
                ]}
              />
            </SettingRow>

            <div className="space-y-2.5 pt-1">
              {[
                { label: t("widget.calendar.showLunar"), val: calendarShowLunar, set: setCalendarShowLunar },
                { label: t("widget.calendar.highlightToday"), val: calendarHighlightToday, set: setCalendarHighlightToday },
                { label: t("widget.calendar.showFestivals"), val: calendarShowFestivals, set: setCalendarShowFestivals },
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
              <SettingRow title={t("widget.weather.layout")} layout="vertical">
                <SegmentedControl
                  options={[
                    { value: "auto", label: t("widget.weather.autoLayout") },
                    { value: "horizontal", label: t("widget.weather.horizontalLayout") },
                    { value: "vertical", label: t("widget.weather.verticalLayout") },
                  ]}
                  value={weatherStyle}
                  onChange={(val) => setWeatherStyle(val as any)}
                />
              </SettingRow>

              <div className="text-[11px] text-[var(--color-text-secondary)] opacity-80 px-2 py-2 leading-relaxed bg-black/5 dark:bg-white/5 rounded border border-black/5 dark:border-white/5 mt-1">
                {t("widget.weather.autoDetect")}
              </div>
            </div>

            <SettingRow title={t("widget.settingsPanel.textColor")} layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: t("widget.settingsPanel.theme") },
                    { value: "accent", label: t("widget.settingsPanel.accent") },
                  ]}
                  value={weatherFontColor.startsWith("#") ? "" : weatherFontColor}
                  onChange={setWeatherFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.settingsPanel.custom")}</span>
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
                <span>{t("widget.settingsPanel.textSizeRatio")}</span>
                <span>{Math.round(weatherFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={weatherFontSizeScale} onChange={setWeatherFontSizeScale} />
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { label: t("widget.weather.showForecast"), val: weatherShowForecast, set: setWeatherShowForecast },
                { label: t("widget.weather.showDetails"), val: weatherShowDetails, set: setWeatherShowDetails },
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
            <SettingRow title={t("widget.music.displayStyle")} layout="vertical">
              <SegmentedControl
                options={[
                  { value: "horizontal", label: t("widget.music.horizontal") },
                  { value: "vertical", label: t("widget.music.vertical") },
                  { value: "mini", label: t("widget.music.mini") },
                  { value: "terminal", label: t("widget.music.terminal") },
                ]}
                value={musicStyle}
                onChange={setMusicStyle}
              />
            </SettingRow>

            <SettingRow title={t("widget.settingsPanel.textColor")} layout="vertical">
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  options={[
                    { value: "theme", label: t("widget.settingsPanel.theme") },
                    { value: "accent", label: t("widget.settingsPanel.accent") },
                  ]}
                  value={musicFontColor.startsWith("#") ? "" : musicFontColor}
                  onChange={setMusicFontColor}
                  variant="accent"
                />
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 border border-transparent">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{t("widget.settingsPanel.custom")}</span>
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
                <span>{t("widget.settingsPanel.textSizeRatio")}</span>
                <span>{Math.round(musicFontSizeScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.8} step={0.1} value={musicFontSizeScale} onChange={setMusicFontSizeScale} />
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                  {t("widget.music.showProgressBar")}
                </span>
                <SwitchToggle checked={musicShowProgress} onChange={setMusicShowProgress} />
              </label>
            </div>
          </div>
        );

      case "custom": {
        if (!customConfigSchema || customConfigSchema.length === 0) {
          return (
            <div className="text-[11px] text-[var(--color-text-secondary)] opacity-60 text-center py-4">
              {t("widget.customWidget.noConfigSchema", "该小组件未声明配置项")}
            </div>
          );
        }

        const updateCustomField = (key: string, value: any) => {
          setCustomConfig((prev) => ({ ...prev, [key]: value }));
        };

        return (
          <div className="space-y-3.5">
            {customConfigSchema.map((field) => (
              <div key={field.key}>
                {field.type === "toggle" ? (
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                      {field.label}
                    </span>
                    <SwitchToggle
                      checked={customConfig[field.key] ?? field.default}
                      onChange={(val) => updateCustomField(field.key, val)}
                    />
                  </label>
                ) : field.type === "color" ? (
                  <SettingRow title={field.label} layout="vertical">
                    <ColorPicker
                      value={customConfig[field.key] ?? field.default}
                      onChange={(val) => updateCustomField(field.key, val)}
                    />
                  </SettingRow>
                ) : field.type === "select" && field.options ? (
                  <SettingRow title={field.label} layout="vertical">
                    <SegmentedControl
                      options={field.options.map((o) => ({ value: o.value, label: o.label }))}
                      value={customConfig[field.key] ?? field.default}
                      onChange={(val) => updateCustomField(field.key, val)}
                      variant="accent"
                    />
                  </SettingRow>
                ) : field.type === "number" ? (
                  <SettingRow title={field.label} layout="vertical">
                    {field.min !== undefined && field.max !== undefined ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                          <span>{field.label}</span>
                          <span>{customConfig[field.key] ?? field.default}</span>
                        </div>
                        <Slider
                          min={field.min}
                          max={field.max}
                          step={field.step ?? 1}
                          value={customConfig[field.key] ?? field.default}
                          onChange={(val) => updateCustomField(field.key, val)}
                        />
                      </div>
                    ) : (
                      <NumberInput
                        value={customConfig[field.key] ?? field.default}
                        onChange={(val) => updateCustomField(field.key, val)}
                        min={field.min}
                        max={field.max}
                        step={field.step ?? 1}
                      />
                    )}
                  </SettingRow>
                ) : field.type === "text" ? (
                  <SettingRow title={field.label} layout="vertical">
                    <TextInput
                      value={customConfig[field.key] ?? field.default ?? ""}
                      onChange={(val) => updateCustomField(field.key, val)}
                    />
                  </SettingRow>
                ) : null}
              </div>
            ))}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full transform overflow-hidden rounded-xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl p-3 text-left align-middle shadow-2xl transition-all border border-black/5 dark:border-white/10 ring-1 ring-black/5 max-h-[85vh] flex flex-col"
    >
      {/* 头部标题 */}
      <div className="text-sm font-semibold leading-5 text-[var(--color-text)] flex justify-between items-center mb-3 shrink-0">
        <span className="flex items-baseline gap-1">
          {t("widget.settingsPanel.title")}
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
      <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 mb-4 shrink-0">
        {[
          { id: "style", icon: <Paintbrush size={14} />, label: t("widget.settingsPanel.appearance") },
          { id: "content", icon: <LayoutGrid size={14} />, label: t("widget.settingsPanel.content") },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "style" | "content")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-white dark:bg-[#2a2a2a] text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50 dark:hover:bg-white/5"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto hidden-native-scrollbar pr-1 relative">
        <AnimatePresence mode="wait">
          {activeTab === "style" ? (
            <motion.div
              key="style"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3.5"
            >
              {/* 背景设置 */}
              {widgetConfig.widgetType !== "stickyNote" && (
                <SettingRow title={t("widget.settingsPanel.background")} layout="vertical">
                  <SegmentedControl
                    options={[
                      { value: "theme", label: t("widget.settingsPanel.followTheme") },
                      { value: "custom", label: t("widget.settingsPanel.custom") },
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
                        <span>{t("widget.settingsPanel.opacity")}</span>
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
                    <span>{t("widget.settingsPanel.bgOpacity")}</span>
                    <span>{Math.round(opacity * 100)}%</span>
                  </div>
                  <Slider min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} />
                </div>
              )}

              {/* 圆角大小 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] font-medium">
                  <span>{t("widget.settingsPanel.cornerRadius")}</span>
                  <span>{cornerRadius}px</span>
                </div>
                <Slider min={0} max={64} step={1} value={cornerRadius} onChange={setCornerRadius} />
              </div>

              {/* 完全透明开关 */}
              <label className="flex items-center justify-between cursor-pointer pt-1 group">
                <span className="text-[11px] text-[var(--color-text)] opacity-80 group-hover:text-[var(--color-accent)] transition-colors">
                  {t("widget.settingsPanel.transparentBg")}
                </span>
                <SwitchToggle checked={transparentBackground} onChange={setTransparentBackground} />
              </label>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3.5"
            >
              {renderContentSpecific()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部确认操作按钮 */}
      <div className="pt-4 mt-2 border-t border-black/5 dark:border-white/5 flex gap-2 shrink-0">
        <button
          type="button"
          className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-[11px] font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-all focus:outline-none"
          onClick={handleCancel}
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="flex-1 justify-center rounded-lg border border-transparent bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[var(--color-accent)] transition-all shadow-sm shadow-[var(--color-accent)]/20 focus:outline-none"
          onClick={handleSave}
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}



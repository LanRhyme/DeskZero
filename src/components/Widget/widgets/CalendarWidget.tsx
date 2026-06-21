import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { Solar } from "lunar-javascript";
import type { WidgetComponentProps } from "@/types/widget";
import { cn } from "@/utils/cn";

interface CalendarEventItem {
  id: string;
  containerId: string;
  date: string;
  title: string;
  color: string;
}

// 农历节日映射 (农历月日 -> 节日名)
const LUNAR_FESTIVALS: Record<string, string> = {
  "1-1": "春节",
  "1-15": "元宵",
  "5-5": "端午",
  "7-7": "七夕",
  "7-15": "中元",
  "8-15": "中秋",
  "9-9": "重阳",
  "12-30": "除夕",
  "12-29": "除夕", // 小月时
};

// 公历节日
const SOLAR_FESTIVALS: Record<string, string> = {
  "1-1": "元旦",
  "2-14": "情人节",
  "3-8": "妇女节",
  "5-1": "劳动节",
  "6-1": "儿童节",
  "10-1": "国庆节",
  "12-25": "圣诞节",
};

function getLunarText(year: number, month: number, day: number): string {
  try {
    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    const lunarMonth = lunar.getMonth();
    const lunarDay = lunar.getDay();

    // 检查农历节日
    const lunarKey = `${lunarMonth}-${lunarDay}`;
    if (LUNAR_FESTIVALS[lunarKey]) {
      return LUNAR_FESTIVALS[lunarKey];
    }

    // 农历初一显示月份名
    if (lunarDay === 1) {
      return lunar.getMonthInChinese();
    }

    return lunar.getDayInChinese();
  } catch {
    return "";
  }
}

function isFestival(year: number, month: number, day: number): string | null {
  // 公历节日
  const solarKey = `${month}-${day}`;
  if (SOLAR_FESTIVALS[solarKey]) return SOLAR_FESTIVALS[solarKey];

  // 农历节日
  try {
    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    const lunarKey = `${lunar.getMonth()}-${lunar.getDay()}`;
    if (LUNAR_FESTIVALS[lunarKey]) return LUNAR_FESTIVALS[lunarKey];
  } catch {}

  return null;
}

export function CalendarWidget({
  config,
  height,
  containerId,
}: WidgetComponentProps) {
  const c = config.config;
  const { t } = useTranslation();
  const showLunar = c.showLunar !== false;
  const fontSizeScale = c.fontSizeScale ?? 1.0;
  const fontColor = c.fontColor || "theme";
  const highlightToday = c.highlightToday !== false;
  const startOfWeek = c.startOfWeek || "monday";
  const showFestivals = c.showFestivals !== false;
  const festivalColor = c.festivalColor || "#ef4444";

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);

  const fetchEvents = async () => {
    try {
      const data = await invoke<CalendarEventItem[]>("get_calendar_events", {
        containerId,
        year,
        month,
      });
      setEvents(data);
    } catch (e) {
      console.error("获取日历事件失败:", e);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [containerId, year, month]);

  // 计算日历网格
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();

    let startDow = firstDay.getDay(); // 0=Sun
    if (startOfWeek === "monday") {
      startDow = startDow === 0 ? 6 : startDow - 1;
    }

    const days: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

    // 上月填充
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const m = month === 1 ? 12 : month - 1;
      const y = month === 1 ? year - 1 : year;
      days.push({ day: d, isCurrentMonth: false, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }

    // 本月
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, isCurrentMonth: true, dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }

    // 下月填充到 42 格 (6 行)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 12 ? 1 : month + 1;
      const y = month === 12 ? year + 1 : year;
      days.push({ day: d, isCurrentMonth: false, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }

    return days;
  }, [year, month, startOfWeek]);

  // 按日期分组事件
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const event of events) {
      const list = map.get(event.date) || [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const weekHeadersRaw = i18next.t("widget.calendar.weekdays", { returnObjects: true }) as string[];
  const weekHeaders = startOfWeek === "monday"
    ? weekHeadersRaw
    : [weekHeadersRaw[6], ...weekHeadersRaw.slice(0, 6)];

  const isToday = (dateStr: string) => {
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    return dateStr === todayStr;
  };

  const goPrev = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const goNext = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };

  // 字体大小
  const baseFontSize = Math.max(9, Math.min(14, 11 * fontSizeScale));
  const lunarFontSize = Math.max(7, Math.min(10, 8 * fontSizeScale));
  const headerFontSize = Math.max(11, Math.min(16, 13 * fontSizeScale));
  const dayCellHeight = Math.max(28, (height - 60) / 7);

  const fontColorClass = cn(
    fontColor === "theme" && "text-[var(--color-text)]",
    fontColor === "accent" && "text-[var(--color-accent)]"
  );
  const fontColorStyle: React.CSSProperties = fontColor.startsWith("#") ? { color: fontColor } : {};

  return (
    <div className="w-full h-full flex flex-col select-none px-2.5 pt-2 pb-1.5">
      {/* 头部：年月导航 */}
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={goPrev} className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <ChevronLeft size={14} className="text-[var(--color-text-secondary)]" />
        </button>
        <button onClick={goToday} className="flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10 rounded px-1.5 py-0.5 transition-colors">
          <span className={cn("font-semibold", fontColorClass)} style={{ fontSize: `${headerFontSize}px`, ...fontColorStyle }}>
            {t("widget.calendar.yearMonth", { year, month })}
          </span>
        </button>
        <button onClick={goNext} className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <ChevronRight size={14} className="text-[var(--color-text-secondary)]" />
        </button>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 gap-0">
        {weekHeaders.map((d) => (
          <div
            key={d}
            className="text-center font-medium text-[var(--color-text-secondary)]"
            style={{ fontSize: `${lunarFontSize}px`, height: `${Math.max(16, dayCellHeight * 0.4)}px`, lineHeight: `${Math.max(16, dayCellHeight * 0.4)}px` }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 日历网格 */}
      <div className="flex-1 grid grid-cols-7 gap-0">
        {calendarDays.map((cell, i) => {
          const festival = showFestivals ? isFestival(year, month, cell.day) : null;
          const lunarText = showLunar ? getLunarText(
            parseInt(cell.dateStr.split("-")[0]),
            parseInt(cell.dateStr.split("-")[1]),
            cell.day
          ) : "";
          const dayEvents = eventsByDate.get(cell.dateStr) || [];
          const todayFlag = highlightToday && isToday(cell.dateStr);

          return (
            <div
              key={i}
              className={cn(
                "flex flex-col items-center justify-center relative transition-colors",
                cell.isCurrentMonth ? "opacity-100" : "opacity-25",
                todayFlag && "bg-[var(--color-accent)]/10 rounded-md"
              )}
              style={{ height: `${dayCellHeight}px` }}
            >
              {/* 日期数字 */}
              <span
                className={cn(
                  "font-medium leading-none",
                  todayFlag ? "text-[var(--color-accent)] font-bold" : "",
                  !todayFlag && fontColorClass
                )}
                style={{
                  fontSize: `${baseFontSize}px`,
                  ...(todayFlag ? {} : fontColorStyle),
                }}
              >
                {cell.day}
              </span>

              {/* 农历/节日文字 */}
              {(lunarText || festival) && (
                <span
                  className={cn("leading-none truncate max-w-full px-0.5", !festival && fontColorClass)}
                  style={{
                    fontSize: `${lunarFontSize}px`,
                    color: festival ? festivalColor : undefined,
                    opacity: festival ? 1 : 0.8,
                    ...(!festival && !fontColor.startsWith("#") ? {} : fontColorStyle),
                  }}
                >
                  {festival || lunarText}
                </span>
              )}

              {/* 事件指示点 */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: ev.color || "#3b82f6" }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

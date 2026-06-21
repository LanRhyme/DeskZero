import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Timer, PartyPopper } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WidgetComponentProps } from "@/types/widget";
import { cn } from "@/utils/cn";

interface CountdownEventItem {
  id: string;
  name: string;
  targetDate: string;
  mode: string;
  color: string;
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getAnniversaryInfo(dateStr: string): { years: number; days: number } {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let years = today.getFullYear() - target.getFullYear();
  const monthDiff = today.getMonth() - target.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < target.getDate())) {
    years--;
  }

  // 最近一次周年日期
  let anniversary = new Date(target);
  anniversary.setFullYear(today.getFullYear());
  if (anniversary < target && years >= 0) {
    // 还没到今年的纪念日
  }
  // 今年的纪念日
  let thisYearAnniversary = new Date(today.getFullYear(), target.getMonth(), target.getDate());
  if (thisYearAnniversary < today) {
    // 今年已过，算明年
    thisYearAnniversary = new Date(today.getFullYear() + 1, target.getMonth(), target.getDate());
  }
  const daysToNext = Math.ceil((thisYearAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // 已过的年数
  let passedYears = today.getFullYear() - target.getFullYear();
  if (today.getMonth() < target.getMonth() || (today.getMonth() === target.getMonth() && today.getDate() < target.getDate())) {
    passedYears--;
  }

  return { years: Math.max(0, passedYears), days: daysToNext };
}

export function CountdownWidget({
  config,
  height,
  containerId,
}: WidgetComponentProps) {
  const c = config.config;
  const displayMode = c.displayMode || "list";
  const fontSizeScale = c.fontSizeScale ?? 1.0;
  const fontColor = c.fontColor || "theme";
  const sortOrder = c.sortOrder || "date-asc";

  const [events, setEvents] = useState<CountdownEventItem[]>([]);
  const [, setTick] = useState(0);

  const fetchEvents = async () => {
    try {
      const data = await invoke<CountdownEventItem[]>("get_countdown_events");
      setEvents(data);
    } catch (e) {
      console.error("获取倒计日数据失败:", e);
    }
  };

  useEffect(() => {
    fetchEvents();
    const unlistenPromise = listen("countdown-events-updated", () => {
      fetchEvents();
    });

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000); // 每分钟刷新天数

    return () => {
      clearInterval(interval);
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [containerId]);

  // 排序事件
  const sortedEvents = useMemo(() => {
    const sorted = [...events];
    sorted.sort((a, b) => {
      const daysA = a.mode === "anniversary" ? getAnniversaryInfo(a.targetDate).days : getDaysUntil(a.targetDate);
      const daysB = b.mode === "anniversary" ? getAnniversaryInfo(b.targetDate).days : getDaysUntil(b.targetDate);
      switch (sortOrder) {
        case "date-desc": return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
        case "days-asc": return daysA - daysB;
        case "days-desc": return daysB - daysA;
        default: return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      }
    });
    return sorted;
  }, [events, sortOrder]);

  // 字体大小
  const isCompact = height <= 120;
  const baseFontSize = Math.max(10, Math.min(18, (isCompact ? 10 : 12) * fontSizeScale));
  const daysFontSize = Math.max(16, Math.min(36, (isCompact ? 20 : 28) * fontSizeScale));

  // 文字颜色
  const fontColorClass = cn(
    fontColor === "theme" && "text-[var(--color-text)]",
    fontColor === "accent" && "text-[var(--color-accent)]"
  );
  const fontColorStyle: React.CSSProperties = fontColor.startsWith("#") ? { color: fontColor } : {};

  const secondaryColorClass = "text-[var(--color-text-secondary)]";


  if (sortedEvents.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-40 select-none">
        <CalendarDays size={isCompact ? 28 : 40} strokeWidth={1.2} className="text-[var(--color-text)]" />
        <span style={{ fontSize: `${baseFontSize}px` }} className={secondaryColorClass}>
          点击设置添加倒计日
        </span>
      </div>
    );
  }

  const isCards = displayMode === "cards";

  return (
    <div
      className={cn(
        "w-full h-full overflow-y-auto hidden-native-scrollbar p-3",
        isCards ? "grid gap-2" : "flex flex-col gap-1.5"
      )}
      style={isCards ? {
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        alignContent: "start",
      } : {}}
    >
      <AnimatePresence>
        {sortedEvents.map((event, i) => {
          const isAnniversary = event.mode === "anniversary";
          const days = isAnniversary ? getAnniversaryInfo(event.targetDate) : null;
          const daysUntil = isAnniversary ? null : getDaysUntil(event.targetDate);

          const displayDays = isAnniversary ? days!.years : daysUntil!;
          const subText = isAnniversary
            ? `还有 ${days!.days} 天`
            : daysUntil! > 0
              ? `还有 ${daysUntil} 天`
              : daysUntil === 0
                ? "就是今天"
                : "已过期";

          const Icon = isAnniversary ? PartyPopper : Timer;

          if (isCards) {
            const isToday = isAnniversary ? days!.days === 0 : daysUntil === 0;
            const isExpired = !isAnniversary && daysUntil! < 0;
            const valNum = isAnniversary ? displayDays : Math.abs(displayDays);
            const cardSubText = isExpired ? `已过 ${valNum} 天` : subText;
            const cardDisplayDays = isExpired ? `${valNum}` : `${displayDays}`;

            const hexToRgba = (hex: string, alpha: number) => {
              if (!hex) return undefined;
              let h = hex.replace("#", "");
              if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
              const r = parseInt(h.slice(0, 2), 16) || 0;
              const g = parseInt(h.slice(2, 4), 16) || 0;
              const b = parseInt(h.slice(4, 6), 16) || 0;
              return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };

            const cardBgStyle = {
              backgroundColor: event.color ? hexToRgba(event.color, 0.15) : undefined,
              borderColor: event.color ? hexToRgba(event.color, 0.4) : undefined,
            };

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "relative overflow-hidden pl-4 pr-3 py-2.5 flex flex-col gap-1 transition-all rounded-xl",
                  "border hover:scale-[1.03] hover:shadow-md cursor-default group",
                  isExpired && "opacity-60 hover:opacity-80"
                )}
                style={cardBgStyle}
              >
                {/* 悬浮光晕背景效果 */}
                <div 
                  className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none"
                  style={{ backgroundColor: event.color || "#3b82f6" }}
                />
                
                {/* 悬浮的圆角药丸装饰小立条 */}
                <div
                  className={cn(
                    "absolute left-1.5 top-[15%] bottom-[15%] w-1 rounded-full group-hover:scale-y-110 transition-transform duration-300",
                    isToday && "animate-pulse"
                  )}
                  style={{ backgroundColor: isExpired ? "#9ca3af" : (event.color || "#3b82f6") }}
                />
                
                {/* 标题 */}
                <div 
                  className={cn("font-medium truncate opacity-90 leading-tight", fontColorClass)} 
                  style={{ fontSize: `${baseFontSize}px`, ...fontColorStyle }}
                >
                  {event.name}
                </div>
                
                {/* 天数 */}
                <div 
                  className={cn("mt-auto pt-1 font-extrabold tabular-nums tracking-tight leading-none flex items-baseline gap-0.5", !event.color && fontColorClass)} 
                  style={{ fontSize: `${daysFontSize}px`, color: event.color || fontColorStyle.color, ...fontColorStyle }}
                >
                  <span>{isAnniversary ? `${valNum}` : cardDisplayDays}</span>
                  <span className="text-[10px] font-normal opacity-70" style={{ fontSize: `${baseFontSize * 0.7}px` }}>
                    {isAnniversary ? "年" : "天"}
                  </span>
                </div>
                
                {/* 辅助信息 */}
                <div 
                  className={cn("text-[10px] opacity-75 font-medium flex items-center gap-1", secondaryColorClass)} 
                  style={{ fontSize: `${baseFontSize * 0.72}px` }}
                >
                  {isToday ? (
                    <span className="text-[var(--color-accent)] font-semibold animate-bounce">🎉 今天！</span>
                  ) : (
                    <span>{cardSubText}</span>
                  )}
                </div>
              </motion.div>
            );
          }

          // 列表模式
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border border-black/[0.01] dark:border-white/[0.03] rounded-xl overflow-hidden px-3 py-2 transition-all hover:translate-x-0.5 shadow-sm"
            >
              <div
                className="w-1 h-5 rounded-full flex-shrink-0"
                style={{ backgroundColor: event.color || "#3b82f6" }}
              />
              <Icon size={isCompact ? 13 : 15} className={cn(secondaryColorClass, "opacity-70")} strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className={cn("font-medium truncate opacity-90", fontColorClass)} style={{ fontSize: `${baseFontSize}px`, ...fontColorStyle }}>
                  {event.name}
                </div>
                <div className={cn("text-[10px] opacity-70", secondaryColorClass)} style={{ fontSize: `${baseFontSize * 0.7}px` }}>
                  {event.targetDate} · {subText}
                </div>
              </div>
              <div className={cn("font-bold tabular-nums flex-shrink-0 tracking-tight", !event.color && fontColorClass)} style={{ fontSize: `${daysFontSize}px`, color: event.color || fontColorStyle.color, ...fontColorStyle }}>
                {isAnniversary ? `${displayDays}年` : displayDays}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

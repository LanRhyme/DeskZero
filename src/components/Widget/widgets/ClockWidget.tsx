import { useEffect, useState } from "react";
import type { WidgetComponentProps } from "@/types/widget";

export function ClockWidget({ config, onConfigChange: _onConfigChange, width, height }: WidgetComponentProps) {
  const [time, setTime] = useState(new Date());

  // 配置解构与默认值
  const clockStyle = config.config?.clockStyle || "digital";
  const digitalStyle = config.config?.digitalStyle || "minimal"; // "minimal" | "glow" | "retro"
  const hour12 = config.config?.hour12 === true;
  const showSeconds = config.config?.showSeconds !== false;
  const showDate = config.config?.showDate !== false;
  const showWeekday = config.config?.showWeekday !== false;
  const fontSizeScale = config.config?.fontSizeScale ?? 1.0;
  const fontColor = config.config?.fontColor || "theme"; // "theme" | "accent" | "gradient-rainbow" | HEX

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const rawHours = time.getHours();
  const rawMinutes = time.getMinutes();
  const rawSeconds = time.getSeconds();

  const formattedHours = hour12 ? (rawHours % 12 || 12).toString().padStart(2, "0") : rawHours.toString().padStart(2, "0");
  const formattedMinutes = rawMinutes.toString().padStart(2, "0");
  const formattedSeconds = rawSeconds.toString().padStart(2, "0");
  const ampm = hour12 ? (rawHours >= 12 ? " PM" : " AM") : "";

  const dateStr = time.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const weekdayStr = time.toLocaleDateString("zh-CN", { weekday: "short" });

  // 1. 模拟表盘时钟模式
  if (clockStyle === "analog") {
    const hourDeg = (rawHours % 12) * 30 + rawMinutes * 0.5;
    const minuteDeg = rawMinutes * 6;
    const secondDeg = rawSeconds * 6;
    const size = Math.min(width, height) - 24;

    return (
      <div className="w-full h-full flex items-center justify-center select-none">
        <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-lg">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2.5" opacity={0.15} />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const isQuarter = i % 3 === 0;
            return (
              <line
                key={i}
                x1={50 + (isQuarter ? 36 : 39) * Math.cos(angle)}
                y1={50 + (isQuarter ? 36 : 39) * Math.sin(angle)}
                x2={50 + 43 * Math.cos(angle)}
                y2={50 + 43 * Math.sin(angle)}
                stroke="currentColor"
                strokeWidth={isQuarter ? "2" : "1"}
                opacity={isQuarter ? 0.6 : 0.3}
              />
            );
          })}
          {/* 时针 */}
          <line
            x1="50" y1="50"
            x2={50 + 22 * Math.cos((hourDeg - 90) * Math.PI / 180)}
            y2={50 + 22 * Math.sin((hourDeg - 90) * Math.PI / 180)}
            stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity={0.8}
          />
          {/* 分针 */}
          <line
            x1="50" y1="50"
            x2={50 + 32 * Math.cos((minuteDeg - 90) * Math.PI / 180)}
            y2={50 + 32 * Math.sin((minuteDeg - 90) * Math.PI / 180)}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity={0.6}
          />
          {/* 秒针 */}
          <line
            x1="50" y1="50"
            x2={50 + 37 * Math.cos((secondDeg - 90) * Math.PI / 180)}
            y2={50 + 37 * Math.sin((secondDeg - 90) * Math.PI / 180)}
            stroke="var(--color-accent)" strokeWidth="1" strokeLinecap="round"
          />
          <circle cx="50" cy="50" r="3" fill="var(--color-accent)" />
        </svg>
      </div>
    );
  }

  // 2. 数字时钟模式 — 动态计算主字号
  const baseFontSize = Math.min(width * 0.17, height * 0.42) * fontSizeScale;
  const timeFontSize = `${baseFontSize}px`;
  const metaFontSize = `${baseFontSize * 0.3}px`;

  // 字体系列类名
  const fontClass =
    digitalStyle === "retro"
      ? "font-mono font-bold tracking-tight"
      : digitalStyle === "glow"
        ? "font-light tracking-wide"
        : "font-light tracking-wider";

  // 颜色行内样式与外发光 CSS
  const getStyleColorAndShadow = () => {
    const styles: React.CSSProperties = { fontSize: timeFontSize };
    
    // 文字发光效果
    const glowShadow =
      digitalStyle === "glow"
        ? `0 0 10px var(--color-accent), 0 0 20px var(--color-accent)`
        : undefined;

    if (fontColor === "theme") {
      styles.color = "var(--color-text)";
      if (glowShadow) styles.textShadow = glowShadow;
    } else if (fontColor === "accent") {
      styles.color = "var(--color-accent)";
      if (glowShadow) styles.textShadow = glowShadow;
    } else if (fontColor === "gradient-rainbow") {
      if (glowShadow) styles.textShadow = glowShadow;
    } else {
      styles.color = fontColor;
      if (glowShadow) styles.textShadow = glowShadow;
    }
    return styles;
  };

  const textStyle = getStyleColorAndShadow();
  const isGradient = fontColor === "gradient-rainbow";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center select-none p-3 overflow-hidden text-center gap-1.5 relative">
      {/* LED 时钟底板背景字效果 */}
      {digitalStyle === "retro" && (
        <div 
          className="absolute font-mono font-bold tracking-tight opacity-5 pointer-events-none select-none"
          style={{ fontSize: timeFontSize, color: "var(--color-text)" }}
        >
          88:88{showSeconds ? ":88" : ""}
        </div>
      )}

      {/* 时间内容 */}
      <div 
        className={`${fontClass} transition-all duration-300 leading-none flex items-baseline`}
        style={textStyle}
      >
        <span className={isGradient ? "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent" : ""}>
          {formattedHours}:{formattedMinutes}
        </span>
        {showSeconds && (
          <span 
            className={`opacity-60 ml-1.5 ${isGradient ? "bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent" : ""}`}
            style={{ fontSize: `${baseFontSize * 0.55}px` }}
          >
            :{formattedSeconds}
          </span>
        )}
        {ampm && (
          <span className="text-[0.4em] font-medium opacity-65 ml-1">{ampm}</span>
        )}
      </div>

      {/* 日期和星期信息 */}
      {(showDate || showWeekday) && (
        <div 
          className="opacity-70 font-medium tracking-wide flex gap-2"
          style={{ fontSize: metaFontSize, color: "var(--color-text-secondary)" }}
        >
          {showDate && <span>{dateStr}</span>}
          {showWeekday && <span>{weekdayStr}</span>}
        </div>
      )}
    </div>
  );
}

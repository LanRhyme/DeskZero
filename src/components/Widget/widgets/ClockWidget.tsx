import { useEffect, useState } from "react";
import type { WidgetComponentProps } from "@/types/widget";

export function ClockWidget({ config, onConfigChange: _onConfigChange, width, height }: WidgetComponentProps) {
  const [time, setTime] = useState(new Date());
  const clockStyle = config.config?.clockStyle || "digital";

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");
  const dateStr = time.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  if (clockStyle === "analog") {
    const hourDeg = (time.getHours() % 12) * 30 + time.getMinutes() * 0.5;
    const minuteDeg = time.getMinutes() * 6;
    const secondDeg = time.getSeconds() * 6;
    const size = Math.min(width, height) - 16;

    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity={0.3} />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            return (
              <line
                key={i}
                x1={50 + 38 * Math.cos(angle)}
                y1={50 + 38 * Math.sin(angle)}
                x2={50 + 43 * Math.cos(angle)}
                y2={50 + 43 * Math.sin(angle)}
                stroke="currentColor"
                strokeWidth="2"
              />
            );
          })}
          <line
            x1="50" y1="50"
            x2={50 + 25 * Math.cos((hourDeg - 90) * Math.PI / 180)}
            y2={50 + 25 * Math.sin((hourDeg - 90) * Math.PI / 180)}
            stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          />
          <line
            x1="50" y1="50"
            x2={50 + 32 * Math.cos((minuteDeg - 90) * Math.PI / 180)}
            y2={50 + 32 * Math.sin((minuteDeg - 90) * Math.PI / 180)}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          />
          <line
            x1="50" y1="50"
            x2={50 + 36 * Math.cos((secondDeg - 90) * Math.PI / 180)}
            y2={50 + 36 * Math.sin((secondDeg - 90) * Math.PI / 180)}
            stroke="var(--color-accent)" strokeWidth="1" strokeLinecap="round"
          />
          <circle cx="50" cy="50" r="3" fill="var(--color-accent)" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 select-none">
      <div className="text-3xl font-light tracking-wider" style={{ color: "var(--color-text)" }}>
        {hours}:{minutes}
        <span className="text-base opacity-50 ml-1">{seconds}</span>
      </div>
      <div className="text-xs opacity-60" style={{ color: "var(--color-text-secondary)" }}>
        {dateStr}
      </div>
    </div>
  );
}

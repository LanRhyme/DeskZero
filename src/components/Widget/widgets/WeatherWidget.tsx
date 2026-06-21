import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sun, CloudSun, Cloud, CloudRain, Snowflake, CloudFog,
  Droplets, Wind, Thermometer
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { WidgetComponentProps } from "@/types/widget";
import { cn } from "@/utils/cn";

interface ForecastDay {
  fxDate: string;
  tempMax: string;
  tempMin: string;
  textDay: string;
  iconDay: string;
}

interface WeatherData {
  temp: string;
  text: string;
  icon: string;
  humidity: string;
  windDir: string;
  windScale: string;
  feelsLike: string;
  forecast: ForecastDay[];
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  "100": Sun,
  "101": CloudSun,
  "102": CloudSun,
  "103": CloudSun,
  "104": Cloud,
  "150": Sun, // 晴夜
  "151": CloudSun,
  "152": CloudSun,
  "153": CloudSun,
  "300": CloudRain,
  "301": CloudRain,
  "302": CloudRain,
  "303": CloudRain,
  "304": CloudRain,
  "305": CloudRain,
  "306": CloudRain,
  "307": CloudRain,
  "308": CloudRain,
  "309": CloudRain,
  "310": CloudRain,
  "311": CloudRain,
  "312": CloudRain,
  "313": CloudRain,
  "314": CloudRain,
  "315": CloudRain,
  "316": CloudRain,
  "317": CloudRain,
  "318": CloudRain,
  "350": CloudRain,
  "351": CloudRain,
  "399": CloudRain,
  "400": Snowflake,
  "401": Snowflake,
  "402": Snowflake,
  "403": Snowflake,
  "404": Snowflake,
  "405": Snowflake,
  "406": Snowflake,
  "407": Snowflake,
  "408": Snowflake,
  "409": Snowflake,
  "410": Snowflake,
  "456": Snowflake,
  "457": Snowflake,
  "499": Snowflake,
  "500": CloudFog,
  "501": CloudFog,
  "502": CloudFog,
  "503": CloudFog,
  "504": CloudFog,
  "507": CloudFog,
  "508": CloudFog,
  "509": CloudFog,
  "510": CloudFog,
  "511": CloudFog,
  "512": CloudFog,
  "513": CloudFog,
  "514": CloudFog,
  "515": CloudFog,
  "900": Thermometer, // 极端天气
  "901": Snowflake,
};

function getWeatherIcon(iconCode: string) {
  return ICON_MAP[iconCode] || CloudSun;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "今天";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "明天";
  return days[d.getDay()];
}

export function WeatherWidget({
  config,
  width,
  height,
}: WidgetComponentProps) {
  const c = config.config;
  const fontSizeScale = c.fontSizeScale ?? 1.0;
  const fontColor = c.fontColor || "theme";
  const showForecast = c.showForecast !== false;
  const showDetails = c.showDetails !== false;
  const weatherStyle = c.weatherStyle || "auto"; // auto, horizontal, vertical

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<WeatherData>("get_weather");
      setWeather(data);
    } catch (e) {
      console.error("获取天气失败:", e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000); // 30分钟刷新
    return () => clearInterval(interval);
  }, []);

  // 计算动态尺寸和布局方向
  const aspect = width / height;
  let layoutMode = weatherStyle;
  if (layoutMode === "auto") {
    layoutMode = aspect > 1.8 ? "horizontal" : "vertical";
  }

  // 基础缩放因子：根据组件大小和用户设置动态计算
  const containerScale = Math.min(width / 150, height / 100);
  const baseFontSize = Math.max(10, Math.min(14, 11 * fontSizeScale * (layoutMode === "vertical" ? 1.1 : 1)));
  const tempFontSize = Math.max(24, Math.min(64, 32 * fontSizeScale * (layoutMode === "vertical" ? 1.5 : 1) * containerScale));
  const forecastFontSize = Math.max(9, Math.min(12, 10 * fontSizeScale));
  const iconSize = Math.max(28, Math.min(72, 40 * (layoutMode === "vertical" ? 1.4 : 1) * containerScale));

  // 极端尺寸保护
  const isExtremelyCompact = height <= 100;
  const isExtremelyNarrow = width <= 130;
  const isVertical = layoutMode === "vertical";
  
  // 如果空间极度压缩，自动隐藏部分可选信息以保护核心排版
  const _showForecast = showForecast && (!isExtremelyCompact || !isVertical) && (!isExtremelyNarrow || isVertical);
  const _showDetails = showDetails && (!isExtremelyCompact && height > 120);

  // 文字颜色
  const fontColorClass = cn(
    fontColor === "theme" && "text-[var(--color-text)]",
    fontColor === "accent" && "text-[var(--color-accent)]"
  );
  const fontColorStyle: React.CSSProperties = fontColor.startsWith("#") ? { color: fontColor } : {};
  const secondaryClass = "text-[var(--color-text-secondary)]";

  // 加载状态
  if (loading && !weather) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <Sun size={28} className="text-[var(--color-accent)] opacity-50" />
        </motion.div>
      </div>
    );
  }

  // 错误状态
  if (error && !weather) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-40 select-none px-4">
        <CloudSun size={32} strokeWidth={1.2} className="text-[var(--color-text)]" />
        <span style={{ fontSize: `${baseFontSize * 0.9}px` }} className={secondaryClass + " text-center leading-tight"}>
          {error}
        </span>
      </div>
    );
  }

  if (!weather) return null;

  const WeatherIcon = getWeatherIcon(weather.icon);

  return (
    <div className={cn(
      "w-full h-full flex select-none overflow-hidden",
      isVertical ? "flex-col items-center justify-center p-2.5 gap-1.5" : "flex-col p-3.5 justify-center"
    )}>
      
      {/* 主天气信息区 */}
      <div className={cn(
        "flex w-full",
        !_showDetails && !_showForecast ? "flex-1" : isVertical ? "flex-col items-center justify-center min-h-0" : "flex-row items-center justify-between"
      )}>
        
        {/* 左侧/顶部：图标和温度 */}
        <div className={cn(
          "flex items-center gap-2.5 shrink-0",
          !_showDetails && !_showForecast ? "w-full justify-center" : "",
          isVertical ? "flex-col gap-1 text-center" : "flex-row text-left"
        )}>
          <WeatherIcon
            size={iconSize}
            strokeWidth={1.2}
            className="text-[var(--color-accent)] shrink-0"
          />
          <div className={cn("flex min-w-0 justify-center", isVertical ? "flex-col items-center" : "flex-col")}>
            <span
              className={cn("font-bold leading-none tabular-nums truncate", fontColorClass)}
              style={{ fontSize: `${tempFontSize}px`, ...fontColorStyle }}
            >
              {weather.temp}°
            </span>
            <span className={cn(secondaryClass, "truncate", isVertical && "mt-1")} style={{ fontSize: `${baseFontSize}px` }}>
              {weather.text}
            </span>
          </div>
        </div>

        {/* 右侧/底部：预报 */}
        {_showForecast && weather.forecast.length > 0 && (
          <div className={cn(
            "flex gap-2.5 overflow-hidden",
            isVertical ? "mt-2.5 w-full justify-around bg-black/5 dark:bg-white/5 p-2 rounded-xl shrink-0" : "justify-end flex-1 pl-3"
          )}>
            {weather.forecast.slice(0, 3).map((day) => {
              const DayIcon = getWeatherIcon(day.iconDay);
              return (
                <div key={day.fxDate} className="flex flex-col items-center gap-0.5 shrink-0 min-w-0">
                  <span className={cn("truncate", secondaryClass)} style={{ fontSize: `${forecastFontSize}px` }}>
                    {formatDate(day.fxDate)}
                  </span>
                  <DayIcon size={isVertical ? 18 : 16} strokeWidth={1.3} className="text-[var(--color-accent)] my-0.5 shrink-0" />
                  <span className={cn("tabular-nums truncate w-full text-center", fontColorClass)} style={{ fontSize: `${forecastFontSize}px`, ...fontColorStyle }}>
                    {day.tempMin}°<span className="opacity-40 mx-0.5">/</span>{day.tempMax}°
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部详细信息 (在垂直模式下如果空间不够可能会被挤压，水平模式下固定在底部) */}
      {_showDetails && (
        <div className={cn(
          "flex items-center justify-center gap-3 shrink-0 overflow-hidden w-full",
          isVertical ? "pt-2 opacity-80" : "pt-2 mt-2 border-t border-black/5 dark:border-white/5"
        )}>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Droplets size={12} className={secondaryClass} strokeWidth={1.5} />
            <span className={secondaryClass} style={{ fontSize: `${forecastFontSize}px` }}>
              {weather.humidity}%
            </span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Wind size={12} className={secondaryClass} strokeWidth={1.5} />
            <span className={secondaryClass} style={{ fontSize: `${forecastFontSize}px` }}>
              {weather.windDir} {weather.windScale}级
            </span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Thermometer size={12} className={secondaryClass} strokeWidth={1.5} />
            <span className={secondaryClass} style={{ fontSize: `${forecastFontSize}px` }}>
              体感 {weather.feelsLike}°
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

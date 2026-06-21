import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music, Play, Pause, SkipBack, SkipForward
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { WidgetComponentProps } from "@/types/widget";
import { cn } from "@/utils/cn";

interface MusicStatusData {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string | null;
  positionMs: number;
  durationMs: number;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// 音频可视化组件
function AudioVisualizer({ isPlaying, colorClass = "bg-[var(--color-accent)]" }: { isPlaying: boolean; colorClass?: string }) {
  const bars = [1, 2, 3, 4, 5];
  
  return (
    <div className="w-full h-full flex items-center justify-center gap-[8%] py-[15%]">
      {bars.map((i) => (
        <motion.div
          key={i}
          className={cn("w-[10%] max-w-[6px] rounded-full", colorClass)}
          initial={{ height: "20%" }}
          animate={isPlaying ? {
            height: ["20%", "100%", "40%", "80%", "30%", "20%"]
          } : { height: "20%" }}
          transition={isPlaying ? {
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
            times: [0, 0.2, 0.4, 0.6, 0.8, 1]
          } : { duration: 0.5 }}
        />
      ))}
    </div>
  );
}

// 样式1：水平卡片（封面 + 信息 + 控制）
function HorizontalStyle({
  width, height,
  status, artUrl, showProgress, fontSizeScale, fontColorClass, fontColorStyle,
  handlePlayPause, handleNext, handlePrev, handleSeekStart, handleSeekEnd, updateSeek,
  seeking, seekPos, progressRef, displayPos, progress,
}: {
  width: number; height: number;
  status: MusicStatusData; artUrl: string | null; showProgress: boolean;
  fontSizeScale: number; fontColorClass: string; fontColorStyle: React.CSSProperties;
  handlePlayPause: () => void; handleNext: () => void; handlePrev: () => void;
  handleSeekStart: (e: React.PointerEvent) => void; handleSeekEnd: () => void;
  updateSeek: (e: React.PointerEvent) => void;
  seeking: boolean; seekPos: number; progressRef: React.RefObject<HTMLDivElement | null>;
  displayPos: number; progress: number;
}) {
  const baseFontSize = Math.max(10, Math.min(14, 12 * fontSizeScale));
  const titleFontSize = Math.max(13, Math.min(20, 16 * fontSizeScale));
  const timeFontSize = Math.max(8, Math.min(11, 9 * fontSizeScale));
  const secondaryClass = "text-[var(--color-text-secondary)]";

  const isExtremelyNarrow = width <= 150;
  const isExtremelyCompact = height <= 70;

  return (
    <div className="w-full h-full flex select-none p-1">
      {/* 左侧：可视化 */}
      {!isExtremelyNarrow && (
        <div className="w-[30%] max-w-[120px] h-full p-2 flex-shrink-0 flex items-center justify-center">
          <AudioVisualizer isPlaying={status.isPlaying} />
        </div>
      )}

      {/* 右侧：信息 + 控制 */}
      <div className={cn("flex-1 flex flex-col justify-center py-2 min-w-0 overflow-hidden", isExtremelyNarrow ? "px-2 items-center text-center" : "pr-3.5")}>
        {/* 歌名 */}
        <div
          className={cn("font-bold truncate leading-tight tracking-tight w-full", fontColorClass)}
          style={{ fontSize: `${titleFontSize}px`, ...fontColorStyle }}
        >
          {status.title || "未知曲目"}
        </div>
        {/* 歌手 */}
        <div
          className={cn("truncate leading-tight mt-1 w-full opacity-80", secondaryClass)}
          style={{ fontSize: `${baseFontSize * 0.85}px` }}
        >
          {status.artist || "未知艺术家"}
        </div>
        {/* 专辑 */}
        {status.album && !isExtremelyCompact && (
          <div className={cn("truncate leading-tight mt-0.5 w-full opacity-40", secondaryClass)} style={{ fontSize: `${baseFontSize * 0.72}px` }}>
            {status.album}
          </div>
        )}

        {/* 进度条 */}
        {showProgress && (
          <div className="flex items-center gap-2 mt-2.5">
            <span className={cn("opacity-70 tabular-nums", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>
              {formatTime(displayPos)}
            </span>
            <div
              ref={progressRef}
              className="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full cursor-pointer relative group/progress"
              onPointerDown={handleSeekStart}
              onPointerMove={(e) => seeking && updateSeek(e)}
              onPointerUp={handleSeekEnd}
              onPointerLeave={handleSeekEnd}
            >
              <div
                className="h-full bg-[var(--color-accent)] rounded-full transition-all group-hover/progress:bg-[var(--color-accent)]/80"
                style={{ width: `${seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress}%`, transitionDuration: seeking ? "0ms" : "200ms" }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-[var(--color-accent)] rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                style={{ left: `calc(${seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress}% - 5px)` }}
              />
            </div>
            <span className={cn("opacity-70 tabular-nums", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>
              {formatTime(status.durationMs)}
            </span>
          </div>
        )}

        {/* 控制按钮 */}
        <div className={cn("flex items-center gap-3.5 mt-2.5", isExtremelyNarrow ? "justify-center" : "")}>
          <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all">
            <SkipBack size={13} className={cn(secondaryClass, "fill-current stroke-none")} />
          </button>
          <button onClick={handlePlayPause} className="p-2.5 rounded-full bg-[var(--color-accent)] text-white hover:scale-105 active:scale-95 hover:shadow-md transition-all shadow-[0_2px_8px_-2px_rgba(var(--color-accent-rgb),0.3)] flex items-center justify-center">
            {status.isPlaying ? <Pause size={13} className="fill-current stroke-none" /> : <Play size={13} className="fill-current stroke-none translate-x-[0.5px]" />}
          </button>
          <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all">
            <SkipForward size={13} className={cn(secondaryClass, "fill-current stroke-none")} />
          </button>
        </div>
      </div>
    </div>
  );
}

// 样式2：垂直卡片（大封面在上，信息在下）
function VerticalStyle({
  width, height,
  status, artUrl, showProgress, fontSizeScale, fontColorClass, fontColorStyle,
  handlePlayPause, handleNext, handlePrev, handleSeekStart, handleSeekEnd, updateSeek,
  seeking, seekPos, progressRef, displayPos, progress,
}: {
  width: number; height: number;
  status: MusicStatusData; artUrl: string | null; showProgress: boolean;
  fontSizeScale: number; fontColorClass: string; fontColorStyle: React.CSSProperties;
  handlePlayPause: () => void; handleNext: () => void; handlePrev: () => void;
  handleSeekStart: (e: React.PointerEvent) => void; handleSeekEnd: () => void;
  updateSeek: (e: React.PointerEvent) => void;
  seeking: boolean; seekPos: number; progressRef: React.RefObject<HTMLDivElement | null>;
  displayPos: number; progress: number;
}) {
  const baseFontSize = Math.max(10, Math.min(14, 12 * fontSizeScale));
  const titleFontSize = Math.max(12, Math.min(18, 15 * fontSizeScale));
  const timeFontSize = Math.max(8, Math.min(11, 9 * fontSizeScale));
  const secondaryClass = "text-[var(--color-text-secondary)]";

  const isExtremelyCompact = height <= 140;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center select-none px-4.5 py-3 overflow-hidden">
      {/* 可视化 */}
      {!isExtremelyCompact && (
        <div className="flex-1 w-full max-w-[60%] min-h-0 flex items-center justify-center">
          <AudioVisualizer isPlaying={status.isPlaying} />
        </div>
      )}

      {/* 信息 */}
      <div className="w-full text-center mt-2.5 flex-shrink-0 min-w-0 px-2">
        <div
          className={cn("font-bold truncate leading-tight tracking-tight", fontColorClass)}
          style={{ fontSize: `${titleFontSize}px`, ...fontColorStyle }}
        >
          {status.title || "未知曲目"}
        </div>
        <div className={cn("truncate mt-0.5 opacity-80", secondaryClass)} style={{ fontSize: `${baseFontSize * 0.8}px` }}>
          {status.artist || "未知艺术家"}
        </div>
      </div>

      {/* 进度条 */}
      {showProgress && (
        <div className="w-full flex items-center gap-2 mt-2.5 flex-shrink-0">
          <span className={cn("opacity-70 tabular-nums", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>
            {formatTime(displayPos)}
          </span>
          <div
            ref={progressRef}
            className="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full cursor-pointer relative group/progress"
            onPointerDown={handleSeekStart}
            onPointerMove={(e) => seeking && updateSeek(e)}
            onPointerUp={handleSeekEnd}
            onPointerLeave={handleSeekEnd}
          >
            <div
              className="h-full bg-[var(--color-accent)] rounded-full transition-all group-hover/progress:bg-[var(--color-accent)]/80"
              style={{ width: `${seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress}%`, transitionDuration: seeking ? "0ms" : "200ms" }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-[var(--color-accent)] rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
              style={{ left: `calc(${seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress}% - 5px)` }}
            />
          </div>
          <span className={cn("opacity-70 tabular-nums", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>
            {formatTime(status.durationMs)}
          </span>
        </div>
      )}

      {/* 控制 */}
      <div className="flex items-center gap-4.5 mt-2 flex-shrink-0">
        <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all">
          <SkipBack size={15} className={cn(secondaryClass, "fill-current stroke-none")} />
        </button>
        <button onClick={handlePlayPause} className="p-3 rounded-full bg-[var(--color-accent)] text-white hover:scale-105 active:scale-95 hover:shadow-md transition-all shadow-[0_2px_8px_-2px_rgba(var(--color-accent-rgb),0.3)] flex items-center justify-center">
          {status.isPlaying ? <Pause size={15} className="fill-current stroke-none" /> : <Play size={15} className="fill-current stroke-none translate-x-[0.5px]" />}
        </button>
        <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all">
          <SkipForward size={15} className={cn(secondaryClass, "fill-current stroke-none")} />
        </button>
      </div>
    </div>
  );
}

// 样式3：迷你模式（紧凑横排）
function MiniStyle({
  width, height,
  status, artUrl, showProgress, fontSizeScale, fontColorClass, fontColorStyle,
  handlePlayPause, handleNext, handlePrev, handleSeekStart, handleSeekEnd, updateSeek,
  seeking, seekPos, progressRef, displayPos, progress,
}: {
  width: number; height: number;
  status: MusicStatusData; artUrl: string | null; showProgress: boolean;
  fontSizeScale: number; fontColorClass: string; fontColorStyle: React.CSSProperties;
  handlePlayPause: () => void; handleNext: () => void; handlePrev: () => void;
  handleSeekStart: (e: React.PointerEvent) => void; handleSeekEnd: () => void;
  updateSeek: (e: React.PointerEvent) => void;
  seeking: boolean; seekPos: number; progressRef: React.RefObject<HTMLDivElement | null>;
  displayPos: number; progress: number;
}) {
  const baseFontSize = Math.max(10, Math.min(14, 11 * fontSizeScale));
  const timeFontSize = Math.max(7, Math.min(10, 8 * fontSizeScale));
  const secondaryClass = "text-[var(--color-text-secondary)]";

  const isExtremelyNarrow = width <= 140;

  return (
    <div className="w-full h-full flex items-center justify-center gap-3 px-3.5 select-none overflow-hidden">
      {/* 小封面可视化 */}
      {!isExtremelyNarrow && (
        <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-black/5 dark:bg-white/10 flex items-center justify-center shadow-sm border border-black/5 dark:border-white/5 p-1.5">
          <AudioVisualizer isPlaying={status.isPlaying} />
        </div>
      )}

      {/* 信息 + 进度 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className={cn("font-semibold truncate", fontColorClass)} style={{ fontSize: `${baseFontSize}px`, ...fontColorStyle }}>
            {status.title || "未知曲目"}
          </span>
          <span className={cn("truncate flex-shrink opacity-80", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>
            {status.artist || ""}
          </span>
        </div>
        {showProgress && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn("opacity-70 tabular-nums", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>{formatTime(displayPos)}</span>
            <div
              ref={progressRef}
              className="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full cursor-pointer relative group/progress"
              onPointerDown={handleSeekStart}
              onPointerMove={(e) => seeking && updateSeek(e)}
              onPointerUp={handleSeekEnd}
              onPointerLeave={handleSeekEnd}
            >
              <div
                className="h-full bg-[var(--color-accent)] rounded-full transition-all group-hover/progress:bg-[var(--color-accent)]/80"
                style={{ width: `${seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress}%`, transitionDuration: seeking ? "0ms" : "200ms" }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white border border-[var(--color-accent)] rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none shadow-sm"
                style={{ left: `calc(${seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress}% - 4px)` }}
              />
            </div>
            <span className={cn("opacity-70 tabular-nums", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>{formatTime(status.durationMs)}</span>
          </div>
        )}
      </div>

      {/* 控制 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={handlePrev} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all">
          <SkipBack size={11} className={cn(secondaryClass, "fill-current stroke-none")} />
        </button>
        <button onClick={handlePlayPause} className="p-1.5 rounded-full bg-[var(--color-accent)] text-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm">
          {status.isPlaying ? <Pause size={10} className="fill-current stroke-none" /> : <Play size={10} className="fill-current stroke-none translate-x-[0.5px]" />}
        </button>
        <button onClick={handleNext} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all">
          <SkipForward size={11} className={cn(secondaryClass, "fill-current stroke-none")} />
        </button>
      </div>
    </div>
  );
}

// 终端字符进度条
function getCharProgress(progress: number, totalChars: number = 15): string {
  const filledCount = Math.round((progress / 100) * totalChars);
  const emptyCount = totalChars - filledCount;
  return "█".repeat(Math.max(0, filledCount)) + "░".repeat(Math.max(0, emptyCount));
}

// 终端字符频谱仪
function AsciiVisualizer({ isPlaying }: { isPlaying: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setFrame((f) => f + 1);
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const frames = [
    " ▃▅▃ ",
    " ▅█▅▂",
    "▂▇█▇▃",
    "▃▅█▅▂",
    " ▂▄▆▄",
    "  ▃▅▃"
  ];
  return <span className="font-mono tracking-widest text-[9px]">{isPlaying ? frames[frame % frames.length] : " ▂▃▂ "}</span>;
}

function TerminalStyle({
  width, height,
  status, showProgress, fontSizeScale, fontColorClass, fontColorStyle,
  handlePlayPause, handleNext, handlePrev, handleSeekStart, handleSeekEnd, updateSeek,
  seeking, seekPos, progressRef, displayPos, progress,
}: {
  width: number; height: number;
  status: MusicStatusData; showProgress: boolean;
  fontSizeScale: number; fontColorClass: string; fontColorStyle: React.CSSProperties;
  handlePlayPause: () => void; handleNext: () => void; handlePrev: () => void;
  handleSeekStart: (e: React.PointerEvent) => void; handleSeekEnd: () => void;
  updateSeek: (e: React.PointerEvent) => void;
  seeking: boolean; seekPos: number; progressRef: React.RefObject<HTMLDivElement | null>;
  displayPos: number; progress: number;
}) {
  const baseFontSize = Math.max(8, Math.min(13, 11 * fontSizeScale));
  
  // 动态字符长度和隐藏规则
  const isExtremelyCompact = height <= 90;
  const isExtremelyNarrow = width <= 130;
  const charCount = Math.max(5, Math.floor(width / (baseFontSize * 0.75)) - 10);

  return (
    <div 
      className={cn("w-full h-full relative p-2.5 flex flex-col font-mono select-none overflow-hidden", fontColorClass)}
      style={fontColorStyle}
    >
      <div className="flex-1 border-2 border-current rounded-sm flex flex-col relative opacity-80 overflow-hidden">
        {/* Title bar */}
        {!isExtremelyCompact && (
          <div className="absolute -top-2 left-3 bg-white dark:bg-[#1a1a1a] px-1.5 flex items-center gap-1.5" style={{ fontSize: `${baseFontSize * 0.85}px` }}>
            <span className="font-bold">cmus_lite</span>
            {status.isPlaying && <span className="animate-pulse">▶</span>}
          </div>
        )}

        <div className="p-3 pt-4 flex-1 flex flex-col justify-center gap-1.5 min-w-0" style={{ fontSize: `${baseFontSize}px` }}>
          {/* 歌曲信息 */}
          <div className="flex min-w-0 items-baseline">
            {!isExtremelyNarrow && (
              <>
                <span className="opacity-60 flex-shrink-0 w-9">Title</span>
                <span className="opacity-40 mx-1.5">│</span>
              </>
            )}
            <span className="font-bold truncate flex-1 text-[1.05em]">{status.title || "No Media"}</span>
          </div>
          <div className="flex min-w-0 items-baseline">
            {!isExtremelyNarrow && (
              <>
                <span className="opacity-60 flex-shrink-0 w-9">Artst</span>
                <span className="opacity-40 mx-1.5">│</span>
              </>
            )}
            <span className="truncate flex-1">{status.artist || "Unknown"}</span>
          </div>
          {!isExtremelyCompact && (
            <div className="flex min-w-0 items-baseline mt-1">
              {!isExtremelyNarrow && (
                <>
                  <span className="opacity-60 flex-shrink-0 w-9">State</span>
                  <span className="opacity-40 mx-1.5">│</span>
                </>
              )}
              <span className={cn("flex-1", status.isPlaying ? "font-bold" : "opacity-70")}>
                [{status.isPlaying ? "PLAYING" : "STOPPED"}]
              </span>
            </div>
          )}

          {/* 进度条 */}
          {showProgress && (
            <div className="mt-2 flex flex-col gap-0.5">
              <div 
                ref={progressRef}
                className="cursor-pointer tracking-wider flex select-none items-center"
                onPointerDown={handleSeekStart}
                onPointerMove={(e) => seeking && updateSeek(e)}
                onPointerUp={handleSeekEnd}
                onPointerLeave={handleSeekEnd}
              >
                <span className="font-mono tracking-normal w-full overflow-hidden whitespace-nowrap text-[0.85em]">
                  {getCharProgress(seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress, charCount)}
                </span>
              </div>
              {!isExtremelyCompact && (
                <div className="flex justify-between opacity-60 font-mono mt-0.5" style={{ fontSize: `${baseFontSize * 0.75}px` }}>
                  <span>{formatTime(displayPos)}</span>
                  <span>{formatTime(status.durationMs)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-between border-t-2 border-current border-dashed px-3 py-1.5 flex-shrink-0" style={{ fontSize: `${baseFontSize * 0.85}px` }}>
          <button onClick={handlePrev} className="hover:font-bold active:scale-95 transition-all">[&lt;&lt;]</button>
          <button onClick={handlePlayPause} className="hover:font-bold active:scale-95 transition-all">
            {status.isPlaying ? "[||]" : "[ >]"}
          </button>
          <button onClick={handleNext} className="hover:font-bold active:scale-95 transition-all">[&gt;&gt;]</button>
        </div>
      </div>
    </div>
  );
}

// 样式5：自定义排版
function CustomStyle({
  config, width, height,
  status, artUrl, showProgress, fontSizeScale, fontColorClass, fontColorStyle,
  handlePlayPause, handleNext, handlePrev, handleSeekStart, handleSeekEnd, updateSeek,
  seeking, seekPos, progressRef, displayPos, progress,
}: {
  config: any; width: number; height: number;
  status: MusicStatusData; artUrl: string | null; showProgress: boolean;
  fontSizeScale: number; fontColorClass: string; fontColorStyle: React.CSSProperties;
  handlePlayPause: () => void; handleNext: () => void; handlePrev: () => void;
  handleSeekStart: (e: React.PointerEvent) => void; handleSeekEnd: () => void;
  updateSeek: (e: React.PointerEvent) => void;
  seeking: boolean; seekPos: number; progressRef: React.RefObject<HTMLDivElement | null>;
  displayPos: number; progress: number;
}) {
  const coverPos = config?.coverPosition || "left"; // left, top, right, bottom, none
  const align = config?.textAlign || "left"; // left, center, right
  const hideControls = config?.hideControls === true;
  
  // 根据真实宽高进一步计算自适应系数
  const isExtremelyCompact = height <= 60;
  const isExtremelyNarrow = width <= 100;
  
  const baseFontSize = Math.max(9, Math.min(14, 12 * fontSizeScale));
  const titleFontSize = Math.max(12, Math.min(20, (isExtremelyCompact ? 13 : 16) * fontSizeScale));
  const timeFontSize = Math.max(8, Math.min(11, 9 * fontSizeScale));
  const secondaryClass = "text-[var(--color-text-secondary)]";

  const isVertical = coverPos === "top" || coverPos === "bottom";
  const coverFirst = coverPos === "left" || coverPos === "top";

  const renderCover = () => {
    if (coverPos === "none" || (isExtremelyNarrow && !isVertical) || (isExtremelyCompact && isVertical)) return null;
    return (
      <div className={cn(
        "flex-shrink-0 flex items-center justify-center relative",
        isVertical ? "w-full min-h-0 flex-1" : "h-full min-w-0"
      )} style={{ 
        flexBasis: isVertical ? 'auto' : 'clamp(40px, 35%, 120px)', 
        maxWidth: isVertical ? 'clamp(40px, 80%, 150px)' : '100px'
      }}>
        <AudioVisualizer isPlaying={status.isPlaying} colorClass={fontColorClass} />
      </div>
    );
  };

  return (
    <div className={cn(
      "w-full h-full select-none flex p-3 overflow-hidden",
      isVertical ? "flex-col items-center gap-2" : "flex-row gap-3",
      !coverFirst && (isVertical ? "flex-col-reverse" : "flex-row-reverse")
    )}>
      {renderCover()}
      
      <div className={cn(
        "flex-1 flex flex-col justify-center min-w-0 w-full overflow-hidden",
        align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left"
      )}>
        <div className={cn("font-bold truncate leading-tight w-full", fontColorClass)} style={{ fontSize: `${titleFontSize}px`, ...fontColorStyle }}>
          {status.title || "未知曲目"}
        </div>
        <div className={cn("truncate opacity-80 w-full mt-0.5", secondaryClass)} style={{ fontSize: `${baseFontSize * 0.85}px` }}>
          {status.artist || "未知艺术家"}
        </div>
        {status.album && !isExtremelyCompact && (
          <div className={cn("truncate opacity-40 w-full mt-0.5", secondaryClass)} style={{ fontSize: `${baseFontSize * 0.72}px` }}>
            {status.album}
          </div>
        )}

        {showProgress && !isExtremelyCompact && (
          <div className="w-full flex items-center gap-2 mt-2.5">
            {!isExtremelyNarrow && <span className={cn("opacity-70 tabular-nums flex-shrink-0", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>{formatTime(displayPos)}</span>}
            <div
              ref={progressRef}
              className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-full cursor-pointer relative group/progress min-w-[20px]"
              onPointerDown={handleSeekStart}
              onPointerMove={(e) => seeking && updateSeek(e)}
              onPointerUp={handleSeekEnd}
              onPointerLeave={handleSeekEnd}
            >
              <div
                className="h-full bg-[var(--color-accent)] rounded-full transition-all group-hover/progress:bg-[var(--color-accent)]/80"
                style={{ width: `${seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress}%`, transitionDuration: seeking ? "0ms" : "200ms" }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white border border-[var(--color-accent)] rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `calc(${seeking ? (seekPos / (status.durationMs || 1)) * 100 : progress}% - 4px)` }}
              />
            </div>
            {!isExtremelyNarrow && <span className={cn("opacity-70 tabular-nums flex-shrink-0", secondaryClass)} style={{ fontSize: `${timeFontSize}px` }}>{formatTime(status.durationMs)}</span>}
          </div>
        )}

        {!hideControls && (
          <div className={cn("flex items-center gap-3.5 mt-2.5", align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start")}>
            <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all">
              <SkipBack size={13} className={cn(secondaryClass, "fill-current stroke-none")} />
            </button>
            <button onClick={handlePlayPause} className="p-2.5 rounded-full bg-[var(--color-accent)] text-white hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center">
              {status.isPlaying ? <Pause size={13} className="fill-current stroke-none" /> : <Play size={13} className="fill-current stroke-none translate-x-[0.5px]" />}
            </button>
            <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all">
              <SkipForward size={13} className={cn(secondaryClass, "fill-current stroke-none")} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MusicWidget({
  config,
  width,
  height,
}: WidgetComponentProps) {
  const c = config.config;
  const fontSizeScale = c.fontSizeScale ?? 1.0;
  const fontColor = c.fontColor || "theme";
  const showProgress = c.showProgress !== false;
  const musicStyle = c.musicStyle || "horizontal";

  const [status, setStatus] = useState<MusicStatusData | null>(null);
  const [error, setError] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekPos, setSeekPos] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await invoke<MusicStatusData>("get_music_status");
      setStatus(data);
      setError(false);
    } catch (e) {
      console.error("[Music] 前端获取状态失败:", e);
      setError(true);
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const interval = status?.isPlaying ? 2000 : 10000;
    pollRef.current = setInterval(fetchStatus, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status?.isPlaying]);

  const handlePlayPause = async () => {
    if (error || !status) return;
    try { await invoke("music_play_pause"); setTimeout(fetchStatus, 300); } catch (e) { console.error(e); }
  };
  const handleNext = async () => {
    if (error || !status) return;
    try { await invoke("music_next"); setTimeout(fetchStatus, 500); } catch (e) { console.error(e); }
  };
  const handlePrev = async () => {
    if (error || !status) return;
    try { await invoke("music_prev"); setTimeout(fetchStatus, 500); } catch (e) { console.error(e); }
  };
  const handleSeekStart = (e: React.PointerEvent) => {
    if (!progressRef.current || !status) return;
    setSeeking(true);
    updateSeek(e);
  };
  const updateSeek = (e: React.PointerEvent) => {
    if (!progressRef.current || !status) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSeekPos(ratio * status.durationMs);
  };
  const handleSeekEnd = async () => {
    if (!seeking || !status) return;
    setSeeking(false);
    try { await invoke("music_seek", { positionMs: Math.round(seekPos) }); setTimeout(fetchStatus, 300); } catch (e) { console.error(e); }
  };

  // 字体颜色
  const fontColorClass = cn(
    fontColor === "theme" && "text-[var(--color-text)]",
    fontColor === "accent" && "text-[var(--color-accent)]"
  );
  const fontColorStyle: React.CSSProperties = fontColor.startsWith("#") ? { color: fontColor } : {};

  // 构造 Dummy 状态以支持无媒体时样式一致性
  const dummyStatus: MusicStatusData = {
    isPlaying: false,
    title: "无媒体播放",
    artist: "未检测到播放中的音乐",
    album: "",
    albumArtUrl: null,
    positionMs: 0,
    durationMs: 0,
  };

  const currentStatus = (error || !status) ? dummyStatus : status;

  const progress = currentStatus.durationMs > 0 ? (currentStatus.positionMs / currentStatus.durationMs) * 100 : 0;
  const displayPos = seeking ? seekPos : currentStatus.positionMs;
  const artUrl = currentStatus.albumArtUrl || null;

  const isTerminal = musicStyle === "terminal";
  const finalFontColorStyle = fontColorStyle;

  const commonProps = {
    status: currentStatus, artUrl, showProgress, fontSizeScale, fontColorClass, fontColorStyle: finalFontColorStyle,
    handlePlayPause, handleNext, handlePrev, handleSeekStart, handleSeekEnd, updateSeek,
    seeking, seekPos, progressRef, displayPos, progress,
  };

  return (
    <AnimatePresence mode="wait">
      {musicStyle === "vertical" ? (
        <VerticalStyle key="vertical" width={width} height={height} {...commonProps} />
      ) : musicStyle === "mini" ? (
        <MiniStyle key="mini" width={width} height={height} {...commonProps} />
      ) : musicStyle === "terminal" ? (
        <TerminalStyle key="terminal" width={width} height={height} {...commonProps} />
      ) : musicStyle === "custom" ? (
        <CustomStyle key="custom" config={c} width={width} height={height} {...commonProps} />
      ) : (
        <HorizontalStyle key="horizontal" width={width} height={height} {...commonProps} />
      )}
    </AnimatePresence>
  );
}

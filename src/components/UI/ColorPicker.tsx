import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

// ── HSV ↔ Hex 转换 ──────────────────────────────────────────────

interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

function hexToHSV(hex: string): HSV {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const sat = max === 0 ? 0 : (d / max) * 100;
  const val = max * 100;

  return { h: hue, s: sat, v: val };
}

function hsvToHex({ h, s, v }: HSV): string {
  const sN = s / 100;
  const vN = v / 100;
  const c = vN * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vN - c;

  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// ── 色盘面板 ─────────────────────────────────────────────────────

function SaturationPanel({
  hsv,
  onChange,
}: {
  hsv: HSV;
  onChange: (hsv: HSV) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 渲染色盘：横向=饱和度, 纵向=亮度
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 底层：色相纯色
    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
    ctx.fillRect(0, 0, w, h);

    // 横向：白色→透明
    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, "rgba(255,255,255,1)");
    whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);

    // 纵向：透明→黑色
    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, "rgba(0,0,0,0)");
    blackGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);
  }, [hsv.h]);

  const updateFromPointer = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
      const s = (x / rect.width) * 100;
      const v = (1 - y / rect.height) * 100;
      onChange({ ...hsv, s, v });
    },
    [hsv, onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateFromPointer(e);
    },
    [updateFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging.current) updateFromPointer(e);
    },
    [updateFromPointer],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // 指示器位置
  const left = `${hsv.s}%`;
  const top = `${100 - hsv.v}%`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[150px] rounded-lg overflow-hidden cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        width={200}
        height={150}
        className="w-full h-full"
      />
      <div
        className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(0,0,0,0.15)] pointer-events-none"
        style={{
          left,
          top,
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

// ── 色相条 ───────────────────────────────────────────────────────

function HueBar({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (h: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updateFromPointer = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const bar = barRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const h = (x / rect.width) * 360;
      onChange(h);
    },
    [onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateFromPointer(e);
    },
    [updateFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging.current) updateFromPointer(e);
    },
    [updateFromPointer],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      ref={barRef}
      className="relative w-full h-3.5 rounded-full cursor-pointer mt-2"
      style={{
        background:
          "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="absolute top-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] pointer-events-none"
        style={{
          left: `${(hue / 360) * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: { color: string; label?: string }[];
  size?: "sm" | "md";
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  presets,
  size = "md",
  className,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // 内部 HSV 状态，从外部 value 初始化
  const [hsv, setHsv] = useState<HSV>(() => hexToHSV(value || "#000000"));

  // 同步外部 value 变化
  useEffect(() => {
    if (isValidHex(value) && value !== hsvToHex(hsv)) {
      setHsv(hexToHSV(value));
      setHexInput(value);
    }
  }, [value]);

  // HSV 变化时同步外部
  const handleHsvChange = useCallback(
    (newHsv: HSV) => {
      setHsv(newHsv);
      const hex = hsvToHex(newHsv);
      setHexInput(hex);
      onChange(hex);
    },
    [onChange],
  );

  // Hex 输入提交
  const handleHexCommit = useCallback(() => {
    const cleaned = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    if (isValidHex(cleaned)) {
      setHsv(hexToHSV(cleaned));
      onChange(cleaned);
    } else {
      setHexInput(value);
    }
  }, [hexInput, value, onChange]);

  // 计算 popover 位置（四向边界修正）
  const openPopover = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popoverW = 220;
    const popoverH = 260; // 色盘150 + 色相14 + 输入~40 + 预设~30 + padding~26
    const gap = 8;

    // 水平：居中，左右不超出
    let left = rect.left + rect.width / 2 - popoverW / 2;
    left = Math.max(gap, Math.min(left, window.innerWidth - popoverW - gap));

    // 垂直：优先显示在下方，空间不够则翻到上方
    let top = rect.bottom + gap;
    if (top + popoverH > window.innerHeight - gap) {
      top = rect.top - popoverH - gap;
    }
    // 上方也不够时贴顶
    if (top < gap) top = gap;

    setPopoverPos({ top, left });
    setIsOpen(true);
  }, []);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const pop = popoverRef.current;
      const trig = triggerRef.current;
      if (
        pop && !pop.contains(e.target as Node) &&
        trig && !trig.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const sizeClasses =
    size === "sm" ? "w-[18px] h-[18px]" : "w-8 h-8";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 预设色 */}
      {presets && presets.length > 0 && (
        <>
          <div className="flex gap-2 items-center">
            {presets.map((preset) => (
              <div
                key={preset.color}
                onClick={() => {
                  onChange(preset.color);
                  setHsv(hexToHSV(preset.color));
                  setHexInput(preset.color);
                }}
                className={cn(
                  "w-6 h-6 rounded-full cursor-pointer transition-transform shadow-inner border-2",
                  value === preset.color
                    ? "border-black/30 dark:border-white/50 scale-110"
                    : "border-transparent hover:scale-110",
                )}
                style={{ backgroundColor: preset.color }}
                title={preset.label}
              />
            ))}
          </div>
          <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1" />
        </>
      )}

      {/* 触发按钮 */}
      <div
        ref={triggerRef}
        className={cn(
          "rounded-full shadow-inner ring-1 ring-black/10 dark:ring-white/10 cursor-pointer shrink-0 transition-transform hover:scale-105",
          sizeClasses,
        )}
        style={{ backgroundColor: value || "#000000" }}
        onClick={() => (isOpen ? setIsOpen(false) : openPopover())}
      />

      {/* Popover — portal 到 body，fixed 定位 */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999] w-[220px] p-3 rounded-xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl shadow-2xl border border-black/5 dark:border-white/10 ring-1 ring-black/5"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 色盘 */}
            <SaturationPanel hsv={hsv} onChange={handleHsvChange} />

            {/* 色相条 */}
            <HueBar
              hue={hsv.h}
              onChange={(h) => handleHsvChange({ ...hsv, h })}
            />

            {/* 输入区 */}
            <div className="flex items-center gap-2 mt-3">
              <div
                className="w-7 h-7 rounded-md shrink-0 shadow-inner ring-1 ring-black/10 dark:ring-white/10"
                style={{ backgroundColor: hsvToHex(hsv) }}
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onBlur={handleHexCommit}
                onKeyDown={(e) => e.key === "Enter" && handleHexCommit()}
                className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md px-2 py-1 text-xs text-[var(--color-text)] font-mono outline-none focus:border-[var(--color-accent)]/50 transition-colors"
                maxLength={7}
              />
            </div>

            {/* 预设色 */}
            {presets && presets.length > 0 && (
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {presets.map((preset) => (
                  <div
                    key={preset.color}
                    onClick={() => {
                      onChange(preset.color);
                      setHsv(hexToHSV(preset.color));
                      setHexInput(preset.color);
                    }}
                    className={cn(
                      "w-5 h-5 rounded-full cursor-pointer transition-all shadow-inner border-2",
                      hsvToHex(hsv) === preset.color
                        ? "border-white/60 scale-110"
                        : "border-transparent hover:scale-110",
                    )}
                    style={{ backgroundColor: preset.color }}
                    title={preset.label}
                  />
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

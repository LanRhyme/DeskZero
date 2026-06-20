import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  position?: "top" | "bottom";
  size?: "sm" | "md";
}

export function CustomSelect({
  value,
  onChange,
  options,
  position = "bottom",
  size = "sm",
}: CustomSelectProps) {
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

  const triggerClasses = size === "sm"
    ? "text-[11px] px-2.5 py-1.5"
    : "text-xs px-3 py-2";

  const itemClasses = size === "sm"
    ? "text-[11px] px-3 py-1.5"
    : "text-xs px-3 py-2";

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded-lg text-left outline-none border border-black/10 dark:border-white/10 flex justify-between items-center cursor-default hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
          triggerClasses,
        )}
      >
        <span>{currentOption?.label}</span>
        <span className={cn("opacity-60", size === "sm" ? "text-[9px]" : "text-[10px]")}>▼</span>
      </button>
      {isOpen && (
        <div className={cn(
          "absolute z-[110] left-0 right-0 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-lg shadow-xl overflow-hidden py-1 max-h-[160px] overflow-y-auto hidden-native-scrollbar",
          position === "top" ? "bottom-full mb-1" : "top-full mt-1",
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
                "w-full text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-default block",
                itemClasses,
                opt.value === value
                  ? "text-[var(--color-accent)] font-semibold"
                  : "text-[var(--color-text)]",
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

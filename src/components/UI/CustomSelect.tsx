import { createPortal } from "react-dom";
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        portalRef.current && !portalRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  const updateDropdownPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (position === "top") {
      setDropdownStyle({
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 4,
        width: rect.width,
      });
    } else {
      setDropdownStyle({
        position: "fixed",
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
  };

  const currentOption = options.find((o) => o.value === value) || options[0];

  const triggerClasses = size === "sm"
    ? "text-[11px] px-2.5 py-1.5"
    : "text-xs px-3 py-2";

  const itemClasses = size === "sm"
    ? "text-[11px] px-3 py-1.5"
    : "text-xs px-3 py-2";

  return (
    <div ref={triggerRef} className="relative w-full">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "w-full bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded-lg text-left outline-none border border-black/10 dark:border-white/10 flex justify-between items-center cursor-default hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
          triggerClasses,
        )}
      >
        <span>{currentOption?.label}</span>
        <span className={cn("opacity-60", size === "sm" ? "text-[9px]" : "text-[10px]")}>▼</span>
      </button>
      {isOpen && createPortal(
        <div
          ref={portalRef}
          style={dropdownStyle}
          className={cn(
            "z-[9999] bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-lg shadow-xl overflow-hidden py-1 max-h-[160px] overflow-y-auto hidden-native-scrollbar",
          )}
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}

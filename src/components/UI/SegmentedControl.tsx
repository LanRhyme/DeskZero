import { cn } from "@/utils/cn";

interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (val: string) => void;
  variant?: "default" | "accent";
  size?: "sm" | "md";
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  variant = "default",
  size = "sm",
  className,
}: SegmentedControlProps) {
  const sizeClasses = size === "sm"
    ? "py-1 px-2 text-[11px] rounded-md"
    : "py-1.5 px-3 text-xs rounded-lg";

  const containerClasses = size === "sm"
    ? "p-0.5 rounded-lg"
    : "p-1 rounded-xl";

  return (
    <div className={cn(
      "flex bg-black/5 dark:bg-white/5 gap-0.5",
      containerClasses,
      className,
    )}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 font-medium transition-all duration-200",
              sizeClasses,
              variant === "accent"
                ? isActive
                  ? "bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20"
                  : "text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                : isActive
                  ? "bg-white dark:bg-neutral-800 shadow-sm text-[var(--color-text)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

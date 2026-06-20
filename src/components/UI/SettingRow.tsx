import { cn } from "@/utils/cn";

interface SettingRowProps {
  title: string;
  desc?: string;
  children: React.ReactNode;
  layout?: "horizontal" | "vertical";
  noBorder?: boolean;
  className?: string;
}

export function SettingRow({
  title,
  desc,
  children,
  layout = "horizontal",
  noBorder = false,
  className,
}: SettingRowProps) {
  if (layout === "vertical") {
    return (
      <div className={cn("space-y-2", className)}>
        <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
          {title}
        </label>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between py-4 group transition-colors",
        !noBorder && "border-b border-black/5 dark:border-white/5",
        className,
      )}
    >
      <div className="pr-8 flex-1">
        <div className="font-medium text-sm text-[var(--color-text)] mb-1 tracking-wide">
          {title}
        </div>
        {desc && (
          <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed group-hover:text-[var(--color-text)]/80 transition-colors duration-300">
            {desc}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center justify-end min-w-[120px]">
        {children}
      </div>
    </div>
  );
}

import { cn } from '@/utils/cn';
import { Minus, Plus } from 'lucide-react';

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  prefix?: string;
}

export function NumberInput({ value, onChange, min = -Infinity, max = Infinity, step = 1, className, prefix }: NumberInputProps) {
  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  return (
    <div className={cn("flex items-center h-6 bg-black/5 dark:bg-white/5 rounded-md border border-transparent focus-within:border-blue-500/50 transition-all", className)}>
      {prefix && <span className="pl-2 pr-0.5 text-[10px] text-[var(--color-text-secondary)] select-none flex items-center h-full">{prefix}</span>}
      <button 
        type="button"
        onClick={handleDecrement}
        className="w-6 h-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-l-md transition-colors"
      >
        <Minus size={12} />
      </button>
      <input 
        type="text"
        value={value}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          if (!isNaN(val)) {
            onChange(Math.max(min, Math.min(max, val)));
          }
        }}
        className="w-8 h-full flex-1 text-center text-xs bg-transparent text-[var(--color-text)] outline-none"
      />
      <button 
        type="button"
        onClick={handleIncrement}
        className="w-6 h-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-r-md transition-colors"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

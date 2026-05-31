import { useRef, useState } from 'react';
import { cn } from '@/utils/cn';

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

export function Slider({ min, max, step, value, onChange, className }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateValue(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      updateValue(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const updateValue = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    let percentage = (clientX - rect.left) / rect.width;
    percentage = Math.max(0, Math.min(1, percentage));
    
    let rawValue = min + percentage * (max - min);
    
    if (step) {
      rawValue = Math.round(rawValue / step) * step;
    }
    
    rawValue = Math.max(min, Math.min(max, rawValue));
    onChange(rawValue);
  };

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div 
      className={cn("relative w-full h-4 flex items-center cursor-pointer group", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div ref={trackRef} className="absolute w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-[var(--color-accent)] transition-all duration-75 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div 
        className={cn(
          "absolute w-3 h-3 bg-white rounded-full shadow border border-black/10 transition-transform duration-75 ease-out",
          isDragging ? "scale-125" : "group-hover:scale-110"
        )}
        style={{ left: `calc(${percentage}% - 6px)` }}
      />
    </div>
  );
}

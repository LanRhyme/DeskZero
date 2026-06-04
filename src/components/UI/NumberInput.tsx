import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

interface NumberInputProps {
	value: number;
	onChange: (val: number) => void;
	min?: number;
	max?: number;
	step?: number;
	className?: string;
	prefix?: string;
}

export function NumberInput({
	value,
	onChange,
	min = -Infinity,
	max = Infinity,
	step = 1,
	className,
	prefix,
}: NumberInputProps) {
	const [localValue, setLocalValue] = useState(value.toString());

	useEffect(() => {
		setLocalValue(value.toString());
	}, [value]);

	const handleDecrement = () => {
		onChange(Math.max(min, value - step));
	};

	const handleIncrement = () => {
		onChange(Math.min(max, value + step));
	};

	const handleBlur = () => {
		const val = parseInt(localValue);
		if (isNaN(val)) {
			setLocalValue(value.toString());
			return;
		}
		const clamped = Math.max(min, Math.min(max, val));
		setLocalValue(clamped.toString());
		if (clamped !== value) {
			onChange(clamped);
		}
	};

	return (
		<div
			className={cn(
				"flex items-center h-6 bg-black/5 dark:bg-white/5 rounded-md border border-transparent focus-within:border-[var(--color-accent)]/50 transition-all",
				className,
			)}
			onDoubleClick={(e) => e.stopPropagation()}
		>
			{prefix && (
				<span className="pl-2 pr-0.5 text-[10px] text-[var(--color-text-secondary)] select-none flex items-center h-full">
					{prefix}
				</span>
			)}
			<button
				type="button"
				onClick={handleDecrement}
				onDoubleClick={(e) => e.stopPropagation()}
				className="w-6 h-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-l-md transition-colors"
			>
				<Minus size={12} />
			</button>
			<input
				type="text"
				value={localValue}
				onChange={(e) => setLocalValue(e.target.value)}
				onBlur={handleBlur}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.currentTarget.blur();
					}
				}}
				className="w-8 h-full flex-1 text-center text-xs bg-transparent text-[var(--color-text)] outline-none"
			/>
			<button
				type="button"
				onClick={handleIncrement}
				onDoubleClick={(e) => e.stopPropagation()}
				className="w-6 h-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-r-md transition-colors"
			>
				<Plus size={12} />
			</button>
		</div>
	);
}

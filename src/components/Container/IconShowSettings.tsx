import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Slider } from "@/components/UI/Slider";
import { NumberInput } from "@/components/UI/NumberInput";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import type { Container } from "@/types/container";
import { cn } from "@/utils/cn";
import { getGridSize } from "@/utils/grid";

interface IconShowSettingsProps {
	container: Container;
	onClose: () => void;
}

export function IconShowSettings({ container, onClose }: IconShowSettingsProps) {
	const { updateContainerStyle, updateContainerSize, deleteContainer } = useContainerStore();

	const grid = getGridSize();
	const stepX = grid.w + grid.gapX;
	const stepY = grid.h + grid.gapY;

	const [cols, setCols] = useState(Math.max(1, Math.round((container.size.width + grid.gapX) / stepX)));
	const [rows, setRows] = useState(Math.max(1, Math.round((container.size.height + grid.gapY) / stepY)));

	const [opacity, setOpacity] = useState(container.style.backgroundOpacity ?? 0.3);
	const [bgColor, setBgColor] = useState(container.style.backgroundColor || "theme");
	const [cornerRadius, setCornerRadius] = useState(container.style.cornerRadius ?? 10);
	const [featherX, setFeatherX] = useState(container.style.featherX ?? 0);
	const [featherY, setFeatherY] = useState(container.style.featherY ?? 0);
	const [iconOpacityInside, setIconOpacityInside] = useState(container.style.iconOpacityInside ?? 1.0);
	const [iconSizeInside, setIconSizeInside] = useState(container.style.iconSizeInside ?? 64);
	const [hoverAnimation, setHoverAnimation] = useState(container.style.hoverAnimation || "scale");
	const [showNamesInside, setShowNamesInside] = useState(container.style.showNamesInside ?? false);
	const [iconGapRatio, setIconGapRatio] = useState(container.style.iconGapRatio ?? 1.0);

	const containerRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		if (containerRef.current) {
			const parent = containerRef.current.parentElement;
			if (parent) {
				const rect = containerRef.current.getBoundingClientRect();
				const padding = 10;
				const styleLeft = parseFloat(parent.style.left) || 0;
				const styleTop = parseFloat(parent.style.top) || 0;

				let newLeft = styleLeft;
				let newTop = styleTop;

				if (styleLeft + rect.width > window.innerWidth) {
					newLeft = Math.max(padding, window.innerWidth - rect.width - padding);
				}
				if (newLeft < padding) newLeft = padding;

				if (styleTop + rect.height > window.innerHeight) {
					newTop = Math.max(padding, window.innerHeight - rect.height - padding);
				}
				if (newTop < padding) newTop = padding;

				parent.style.left = `${newLeft}px`;
				parent.style.top = `${newTop}px`;
			}
		}
	});

	const handleSave = () => {
		const newWidth = cols * stepX - grid.gapX;
		const newHeight = rows * stepY - grid.gapY;
		updateContainerSize(container.id, { width: newWidth, height: newHeight });

		updateContainerStyle(container.id, {
			backgroundOpacity: opacity,
			backgroundColor: bgColor,
			cornerRadius,
			featherX,
			featherY,
			iconOpacityInside,
			iconSizeInside,
			hoverAnimation,
			showNamesInside,
			iconGapRatio,
		});
		onClose();
	};

	const handleDelete = async () => {
		const { moveItemsToDesktop } = useDesktopStore.getState();
		await moveItemsToDesktop(container.items, container.position.x, container.position.y, true);
		await deleteContainer(container.id);
		onClose();
	};

	return (
		<div ref={containerRef} className="w-full transform overflow-hidden rounded-xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl p-3 text-left align-middle shadow-2xl transition-all border border-black/5 dark:border-white/10 ring-1 ring-black/5">
			<div className="text-sm font-medium leading-5 text-[var(--color-text)] flex justify-between items-center mb-3">
				<span>展示容器设置</span>
				<button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]">
					<X size={12} />
				</button>
			</div>

			<div className="space-y-3 max-h-[420px] overflow-y-auto hidden-native-scrollbar pr-1 pb-4">
				{/* Colors */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">背景设置</label>
					<div className="flex gap-1.5 mb-2">
						<button onClick={() => setBgColor("theme")} className={cn("flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200", bgColor === "theme" ? "bg-[var(--color-accent)] text-white" : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)]")}>跟随主题</button>
						<button onClick={() => setBgColor(bgColor === "theme" ? "#000000" : bgColor)} className={cn("flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200", bgColor !== "theme" ? "bg-[var(--color-accent)] text-white" : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)]")}>自定义颜色</button>
					</div>

					<div className="flex items-center gap-3">
						{bgColor !== "theme" && (
							<div className="relative w-8 h-8 rounded-full overflow-hidden shadow-inner ring-1 ring-black/10 dark:ring-white/10 cursor-pointer shrink-0">
								<input type="color" value={bgColor.startsWith("#") ? bgColor : "#000000"} onChange={(e) => setBgColor(e.target.value)} className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" />
							</div>
						)}
						<div className="flex-1">
							<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
								<span>不透明度</span>
								<span>{Math.round(opacity * 100)}%</span>
							</div>
							<Slider min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} />
						</div>
					</div>
				</div>

				{/* Corner Radius */}
				<div className="space-y-2">
					<div className="flex justify-between text-xs font-medium text-[var(--color-text)]">
						<span>圆角半径</span>
						<span>{cornerRadius}px</span>
					</div>
					<Slider min={0} max={64} step={1} value={cornerRadius} onChange={setCornerRadius} />
				</div>

				<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

				{/* Grid Size */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">网格尺寸 (格数)</label>
					<div className="flex gap-3">
						<div className="flex-1 space-y-1">
							<span className="text-[10px] text-[var(--color-text-secondary)] block">列数 (宽)</span>
							<NumberInput min={1} max={20} value={cols} onChange={setCols} />
						</div>
						<div className="flex-1 space-y-1">
							<span className="text-[10px] text-[var(--color-text-secondary)] block">行数 (高)</span>
							<NumberInput min={1} max={20} value={rows} onChange={setRows} />
						</div>
					</div>
				</div>

				<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

				{/* Feathering */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">边缘羽化</label>
					<div>
						<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
							<span>X 轴羽化</span>
							<span>{featherX}px</span>
						</div>
						<Slider min={0} max={100} step={1} value={featherX} onChange={setFeatherX} />
					</div>
					<div className="pt-1">
						<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
							<span>Y 轴羽化</span>
							<span>{featherY}px</span>
						</div>
						<Slider min={0} max={100} step={1} value={featherY} onChange={setFeatherY} />
					</div>
				</div>

				<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

				{/* Icon Styles */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">图标设置</label>
					<div>
						<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
							<span>图标大小</span>
							<span>{iconSizeInside}px</span>
						</div>
						<Slider min={24} max={128} step={2} value={iconSizeInside} onChange={setIconSizeInside} />
					</div>
					<div className="pt-1">
						<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
							<span>图标不透明度</span>
							<span>{Math.round(iconOpacityInside * 100)}%</span>
						</div>
						<Slider min={0.1} max={1} step={0.05} value={iconOpacityInside} onChange={setIconOpacityInside} />
					</div>
					<div className="pt-2 flex items-center justify-between">
						<span className="text-xs text-[var(--color-text)] font-medium">显示图标名称</span>
						<input type="checkbox" checked={showNamesInside} onChange={(e) => setShowNamesInside(e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] animate-none" />
					</div>
					<div className="pt-2">
						<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
							<span>图标间距比例</span>
							<span>{Math.round(iconGapRatio * 100)}%</span>
						</div>
						<Slider min={0.2} max={1.8} step={0.05} value={iconGapRatio} onChange={setIconGapRatio} />
					</div>
				</div>

				{/* Hover Animations */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">悬停微动画</label>
					<CustomSelect
						value={hoverAnimation}
						onChange={setHoverAnimation}
						options={[
							{ value: "none", label: "无" },
							{ value: "scale", label: "放大" },
							{ value: "lift", label: "上浮" },
							{ value: "glow", label: "发光" },
							{ value: "rotate", label: "微旋" },
						]}
						position="top"
					/>
				</div>
			</div>

			<div className="pt-3 flex gap-2">
				<button type="button" className="flex-1 justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors focus:outline-none" onClick={handleDelete}>移除</button>
				<button type="button" className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none" onClick={onClose}>取消</button>
				<button type="button" className="flex-1 justify-center rounded-lg border border-transparent bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)] transition-colors shadow-md shadow-[var(--color-accent)]/25 focus:outline-none" onClick={handleSave}>保存</button>
			</div>
		</div>
	);
}

function CustomSelect({
	value,
	onChange,
	options,
	position = "bottom",
}: {
	value: string;
	onChange: (v: string) => void;
	options: { value: string; label: string }[];
	position?: "top" | "bottom";
}) {
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

	return (
		<div ref={dropdownRef} className="relative w-full">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full text-xs bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded-lg px-3 py-2 text-left outline-none border border-black/10 dark:border-white/10 flex justify-between items-center cursor-default hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
			>
				<span>{currentOption?.label}</span>
				<span className="text-[10px] opacity-60">▼</span>
			</button>
			{isOpen && (
				<div className={cn(
					"absolute z-[110] left-0 right-0 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-lg shadow-xl overflow-hidden py-1",
					position === "top" ? "bottom-full mb-1" : "top-full mt-1"
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
								"w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-default block",
								opt.value === value ? "text-[var(--color-accent)] font-semibold" : "text-[var(--color-text)]"
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

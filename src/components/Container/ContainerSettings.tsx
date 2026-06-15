import { motion } from "framer-motion";
import { LayoutGrid, List, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { NumberInput } from "@/components/UI/NumberInput";
import { Slider } from "@/components/UI/Slider";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import type { Container } from "@/types/container";
import { cn } from "@/utils/cn";

interface ContainerSettingsProps {
	container: Container;
	onClose: () => void;
}

export function ContainerSettings({
	container,
	onClose,
}: ContainerSettingsProps) {
	const { updateContainerStyle, updateContainerName, deleteContainer } =
		useContainerStore();

	const [name, setName] = useState(container.name);
	const [opacity, setOpacity] = useState(
		container.style.backgroundOpacity ?? 0.3,
	);
	const [bgColor, setBgColor] = useState(
		container.style.backgroundColor || "theme",
	);
	const [layout, setLayout] = useState(container.style.layout || "grid");
	const [gridWidth, setGridWidth] = useState(container.style.gridWidth ?? 80);
	const [gridHeight, setGridHeight] = useState(
		container.style.gridHeight ?? 104,
	);
	const [listHeight, setListHeight] = useState(
		container.style.listHeight ?? 30,
	);
	const [showDetails, setShowDetails] = useState(
		container.style.showDetails ?? false,
	);
	const [hideAppNames, setHideAppNames] = useState(
		container.style.hideAppNames ?? false,
	);
	const [cornerRadius, setCornerRadius] = useState(
		container.style.cornerRadius ?? 10,
	);

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
		if (name.trim() !== container.name) {
			updateContainerName(container.id, name.trim());
		}
		updateContainerStyle(container.id, {
			backgroundOpacity: opacity,
			backgroundColor: bgColor,
			layout: layout as "grid" | "list",
			gridWidth,
			gridHeight,
			listHeight,
			showDetails,
			hideAppNames,
			cornerRadius,
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
				<span>
					收纳盒设置{" "}
					{container.name && (
						<span className="text-[10px] font-normal text-[var(--color-text-secondary)] opacity-70">
							({container.name})
						</span>
					)}
				</span>
				<button
					onClick={onClose}
					className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
				>
					<X size={12} />
				</button>
			</div>

			<div className="space-y-3">
				{/* Name */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
						收纳盒名称
					</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow"
						placeholder="输入收纳盒名称..."
					/>
				</div>

				{/* Colors */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
						背景设置
					</label>
					<div className="flex gap-1.5 mb-2">
						<button
							onClick={() => setBgColor("theme")}
							className={cn(
								"flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200",
								bgColor === "theme" || !bgColor
									? "bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20"
									: "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10",
							)}
						>
							跟随主题
						</button>
						<button
							onClick={() =>
								setBgColor(
									bgColor === "theme" || !bgColor ? "#000000" : bgColor,
								)
							}
							className={cn(
								"flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200",
								bgColor !== "theme" && bgColor
									? "bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20"
									: "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10",
							)}
						>
							自定义
						</button>
					</div>

					<div className="flex items-center gap-3">
						{bgColor !== "theme" && bgColor && (
							<div className="relative w-8 h-8 rounded-full overflow-hidden shadow-inner ring-1 ring-black/10 dark:ring-white/10 cursor-pointer group shrink-0">
								<input
									type="color"
									value={bgColor.startsWith("#") ? bgColor : "#000000"}
									onChange={(e) => setBgColor(e.target.value)}
									className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer"
								/>
							</div>
						)}
						<div className="flex-1">
							<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
								<span>不透明度</span>
								<span>{Math.round(opacity * 100)}%</span>
							</div>
							<Slider
								min={0}
								max={1}
								step={0.05}
								value={opacity}
								onChange={setOpacity}
							/>
						</div>
					</div>
				</div>

				{/* Corner Radius */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
						圆角大小
					</label>
					<div className="flex-1">
						<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
							<span>半径</span>
							<span className="text-[var(--color-text)]">{cornerRadius}px</span>
						</div>
						<Slider
							min={0}
							max={64}
							step={1}
							value={cornerRadius}
							onChange={setCornerRadius}
						/>
					</div>
				</div>

				<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

				{/* Layout */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
						排版方式
					</label>
					<div className="flex gap-1.5">
						<button
							onClick={() => setLayout("grid")}
							className={cn(
								"flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-200",
								layout === "grid"
									? "bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20"
									: "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10",
							)}
						>
							<LayoutGrid size={14} />
							网格
						</button>
						<button
							onClick={() => setLayout("list")}
							className={cn(
								"flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-200",
								layout === "list"
									? "bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20"
									: "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10",
							)}
						>
							<List size={14} />
							列表
						</button>
					</div>
				</div>

				{/* Grid Size Config */}
				<motion.div
					initial={false}
					animate={{
						height: layout === "grid" ? "auto" : 0,
						opacity: layout === "grid" ? 1 : 0,
					}}
					className="overflow-hidden"
				>
					<div className="space-y-2 pt-2">
						<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
							网格尺寸
						</label>
						<div className="flex gap-2">
							<NumberInput
								value={gridWidth}
								onChange={setGridWidth}
								prefix="W"
								className="flex-1"
								min={20}
							/>
							<NumberInput
								value={gridHeight}
								onChange={setGridHeight}
								prefix="H"
								className="flex-1"
								min={20}
							/>
						</div>
					</div>
					<div className="space-y-3 pt-4">
						<label className="flex items-center gap-2 cursor-pointer group">
							<div className="relative flex items-center">
								<input
									type="checkbox"
									checked={hideAppNames}
									onChange={(e) => setHideAppNames(e.target.checked)}
									className="peer sr-only"
								/>
								<div className="w-8 h-4.5 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[14px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
							</div>
							<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
								隐藏应用名称
							</span>
						</label>
					</div>
				</motion.div>

				{/* List Size Config */}
				<motion.div
					initial={false}
					animate={{
						height: layout === "list" ? "auto" : 0,
						opacity: layout === "list" ? 1 : 0,
					}}
					className="overflow-hidden"
				>
					<div className="space-y-3 pt-2">
						<div className="space-y-2">
							<label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">
								列表项高度
							</label>
							<NumberInput
								value={listHeight}
								onChange={setListHeight}
								prefix="H"
								min={20}
							/>
						</div>

						<label className="flex items-center gap-2 cursor-pointer group">
							<div className="relative flex items-center">
								<input
									type="checkbox"
									checked={showDetails}
									onChange={(e) => setShowDetails(e.target.checked)}
									className="peer sr-only"
								/>
								<div className="w-8 h-4.5 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[14px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[var(--color-accent)] transition-colors"></div>
							</div>
							<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
								显示详细信息
							</span>
						</label>
					</div>
				</motion.div>

				<div className="pt-4 flex gap-2">
					<button
						type="button"
						className="flex-1 justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors focus:outline-none"
						onClick={handleDelete}
					>
						移除
					</button>
					<button
						type="button"
						className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none"
						onClick={onClose}
					>
						取消
					</button>
					<button
						type="button"
						className="flex-1 justify-center rounded-lg border border-transparent bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)] transition-colors shadow-md shadow-[var(--color-accent)]/25 focus:outline-none"
						onClick={handleSave}
					>
						保存
					</button>
				</div>
			</div>
		</div>
	);
}

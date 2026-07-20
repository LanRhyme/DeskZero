import { X, LayoutGrid, Paintbrush, MousePointerClick } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Slider } from "@/components/UI/Slider";
import { SwitchToggle } from "@/components/UI/SwitchToggle";
import { ConfirmDialog } from "@/components/UI/ConfirmDialog";
import { ColorPicker } from "@/components/UI/ColorPicker";
import { CustomSelect } from "@/components/UI/CustomSelect";
import { NumberInput } from "@/components/UI/NumberInput";
import { SettingRow } from "@/components/UI/SettingRow";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import type { Container } from "@/types/container";
import { cn } from "@/utils/cn";
import { getGridSize } from "@/utils/grid";
import { motion, AnimatePresence } from "framer-motion";

interface IconShowSettingsProps {
	container: Container;
	onClose: () => void;
}

type SettingCategory = "appearance" | "layout" | "behavior";

export function IconShowSettings({ container, onClose }: IconShowSettingsProps) {
	const { t } = useTranslation();
	const { updateContainerStyle, updateContainerSize, deleteContainer } = useContainerStore();

	const grid = getGridSize();
	const stepX = grid.w + grid.gapX;
	const stepY = grid.h + grid.gapY;

	const [activeCategory, setActiveCategory] = useState<SettingCategory>("appearance");

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
	const [clickAnimation, setClickAnimation] = useState(container.style.clickAnimation || "pop");
	const [singleClickLaunch, setSingleClickLaunch] = useState(container.style.singleClickLaunch ?? false);
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
			clickAnimation,
			singleClickLaunch,
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

	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const renderContent = () => {
		switch (activeCategory) {
			case "appearance":
				return (
					<motion.div
						key="appearance"
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 10 }}
						className="space-y-3"
					>
						<SettingRow title={t("container.iconShowBg")} layout="vertical">
							<div className="flex gap-1.5 mb-2">
								<button onClick={() => setBgColor("theme")} className={cn("flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200", bgColor === "theme" ? "bg-[var(--color-accent)] text-white" : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)]")}>{t("container.followThemeBtn")}</button>
								<button onClick={() => setBgColor(bgColor === "theme" ? "#000000" : bgColor)} className={cn("flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200", bgColor !== "theme" ? "bg-[var(--color-accent)] text-white" : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)]")}>{t("container.customColor")}</button>
							</div>

							<div className="flex items-center gap-3">
								{bgColor !== "theme" && (
									<ColorPicker
										value={bgColor.startsWith("#") ? bgColor : "#000000"}
										onChange={setBgColor}
										size="md"
									/>
								)}
								<div className="flex-1">
									<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
										<span>{t("container.opacity")}</span>
										<span>{Math.round(opacity * 100)}%</span>
									</div>
									<Slider min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} />
								</div>
							</div>
						</SettingRow>

						<SettingRow title={t("container.cornerRadius")} layout="vertical">
							<div className="flex-1">
								<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
									<span>{t("container.radius")}</span>
									<span className="text-[var(--color-text)]">{cornerRadius}px</span>
								</div>
								<Slider min={0} max={64} step={1} value={cornerRadius} onChange={setCornerRadius} />
							</div>
						</SettingRow>

						<SettingRow title={t("container.edgeFeather")} layout="vertical">
							<div>
								<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
									<span>{t("container.xFade")}</span>
									<span>{featherX}px</span>
								</div>
								<Slider min={0} max={100} step={1} value={featherX} onChange={setFeatherX} />
							</div>
							<div className="pt-1">
								<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
									<span>{t("container.yFade")}</span>
									<span>{featherY}px</span>
								</div>
								<Slider min={0} max={100} step={1} value={featherY} onChange={setFeatherY} />
							</div>
						</SettingRow>
					</motion.div>
				);

			case "layout":
				return (
					<motion.div
						key="layout"
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 10 }}
						className="space-y-3"
					>
						<SettingRow title={t("container.gridSizeLabel")} layout="vertical">
							<div className="flex gap-3">
								<div className="flex-1 space-y-1">
									<span className="text-[10px] text-[var(--color-text-secondary)] block">{t("container.columns")}</span>
									<NumberInput min={1} max={20} value={cols} onChange={setCols} />
								</div>
								<div className="flex-1 space-y-1">
									<span className="text-[10px] text-[var(--color-text-secondary)] block">{t("container.rows")}</span>
									<NumberInput min={1} max={20} value={rows} onChange={setRows} />
								</div>
							</div>
						</SettingRow>

						<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

						<SettingRow title={t("container.iconSettings")} layout="vertical">
							<div>
								<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
									<span>{t("container.iconSize")}</span>
									<span>{iconSizeInside}px</span>
								</div>
								<Slider min={24} max={128} step={2} value={iconSizeInside} onChange={setIconSizeInside} />
							</div>
							<div className="pt-1">
								<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
									<span>{t("container.iconOpacity")}</span>
									<span>{Math.round(iconOpacityInside * 100)}%</span>
								</div>
								<Slider min={0.1} max={1} step={0.05} value={iconOpacityInside} onChange={setIconOpacityInside} />
							</div>
							<div className="pt-2 flex items-center justify-between">
								<span className="text-xs text-[var(--color-text)] font-medium">{t("container.showIconName")}</span>
								<SwitchToggle checked={showNamesInside} onChange={setShowNamesInside} />
							</div>
							<div className="pt-2">
								<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
									<span>{t("container.iconSpacing")}</span>
									<span>{Math.round(iconGapRatio * 100)}%</span>
								</div>
								<Slider min={0.2} max={1.8} step={0.05} value={iconGapRatio} onChange={setIconGapRatio} />
							</div>
						</SettingRow>
					</motion.div>
				);

			case "behavior":
				return (
					<motion.div
						key="behavior"
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 10 }}
						className="space-y-3"
					>
						<SettingRow title={t("container.hoverAnimation")} layout="vertical">
							<CustomSelect
								value={hoverAnimation}
								onChange={setHoverAnimation}
								options={[
									{ value: "none", label: t("container.animNone") },
									{ value: "scale", label: t("container.animScale") },
									{ value: "lift", label: t("container.animFloat") },
									{ value: "glow", label: t("container.animGlow") },
									{ value: "rotate", label: t("container.animSpin") },
								]}
								position="bottom"
								size="md"
							/>
						</SettingRow>

						<SettingRow title={t("container.clickAnimation")} layout="vertical">
							<CustomSelect
								value={clickAnimation}
								onChange={setClickAnimation}
								options={[
									{ value: "none", label: t("container.animNone") },
									{ value: "pop", label: t("container.animPop") },
									{ value: "shake", label: t("container.animShake") },
									{ value: "sink", label: t("container.animSink") },
								]}
								position="bottom"
								size="md"
							/>
						</SettingRow>

						<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

						<div className="space-y-3 pt-2">
							<label className="flex items-center gap-2 cursor-pointer group">
								<SwitchToggle checked={singleClickLaunch} onChange={setSingleClickLaunch} />
								<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
									{t("container.singleClickLaunch")}
								</span>
							</label>
						</div>
					</motion.div>
				);
		}
	};

	return (
		<>
		<div ref={containerRef} className="w-full transform overflow-hidden rounded-xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl p-3 text-left align-middle shadow-2xl transition-all border border-black/5 dark:border-white/10 ring-1 ring-black/5 max-h-[85vh] flex flex-col">
			<div className="text-sm font-medium leading-5 text-[var(--color-text)] flex justify-between items-center mb-3">
				<span>{t("container.iconShowSettings")}</span>
				<button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]">
					<X size={12} />
				</button>
			</div>

			<div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 mb-4 shrink-0">
				{[
					{ id: "appearance", icon: <Paintbrush size={14} />, label: t("container.appearance", "外观") },
					{ id: "layout", icon: <LayoutGrid size={14} />, label: t("container.layout", "布局") },
					{ id: "behavior", icon: <MousePointerClick size={14} />, label: t("container.behavior", "交互") },
				].map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveCategory(tab.id as SettingCategory)}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-200",
							activeCategory === tab.id
								? "bg-white dark:bg-[#2a2a2a] text-[var(--color-text)] shadow-sm"
								: "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50 dark:hover:bg-white/5"
						)}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			<div className="flex-1 overflow-y-auto hidden-native-scrollbar pr-1 relative">
				<AnimatePresence mode="wait">
					{renderContent()}
				</AnimatePresence>
			</div>

			<div className="pt-4 mt-2 border-t border-black/5 dark:border-white/5 flex gap-2 shrink-0">
				<button
					type="button"
					className="flex-1 justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors focus:outline-none"
					onClick={() => setShowDeleteConfirm(true)}
				>
					{t("common.remove")}
				</button>
				<button
					type="button"
					className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none"
					onClick={onClose}
				>
					{t("common.cancel")}
				</button>
				<button
					type="button"
					className="flex-1 justify-center rounded-lg border border-transparent bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)] transition-colors shadow-md shadow-[var(--color-accent)]/25 focus:outline-none"
					onClick={handleSave}
				>
					{t("common.save")}
				</button>
			</div>
		</div>

		<ConfirmDialog
			isOpen={showDeleteConfirm}
			title={t("container.removeIconShow")}
			message={t("container.removeIconShowConfirm", { name: container.name })}
			confirmLabel={t("common.remove")}
			onConfirm={async () => {
				setShowDeleteConfirm(false);
				await handleDelete();
			}}
			onCancel={() => setShowDeleteConfirm(false)}
		/>
		</>
	);
}



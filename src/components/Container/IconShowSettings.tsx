import { X } from "lucide-react";
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

interface IconShowSettingsProps {
	container: Container;
	onClose: () => void;
}

export function IconShowSettings({ container, onClose }: IconShowSettingsProps) {
	const { t } = useTranslation();
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

	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	return (
		<>
		<div ref={containerRef} className="w-full transform overflow-hidden rounded-xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl p-3 text-left align-middle shadow-2xl transition-all border border-black/5 dark:border-white/10 ring-1 ring-black/5">
			<div className="text-sm font-medium leading-5 text-[var(--color-text)] flex justify-between items-center mb-3">
				<span>{t("container.iconShowSettings")}</span>
				<button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]">
					<X size={12} />
				</button>
			</div>

			<div className="space-y-3 max-h-[420px] overflow-y-auto hidden-native-scrollbar pr-1 pb-4">
				{/* Colors */}
				<div className="space-y-2">
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
				</div>

				{/* Corner Radius */}
				<div className="space-y-2">
				<div className="flex justify-between text-xs font-medium text-[var(--color-text)]">
					<span>{t("container.cornerRadiusLabel")}</span>
						<span>{cornerRadius}px</span>
					</div>
					<Slider min={0} max={64} step={1} value={cornerRadius} onChange={setCornerRadius} />
				</div>

				<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

				{/* Grid Size */}
				<div className="space-y-2">
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
				</div>

				<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

				{/* Feathering */}
				<div className="space-y-2">
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
				</div>

				<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

				{/* Icon Styles */}
				<div className="space-y-2">
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
				</div>

				{/* Hover Animations */}
				<div className="space-y-2">
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
						position="top"
						size="md"
					/>
				</SettingRow>
				</div>
			</div>

			<div className="pt-3 flex gap-2">
			<button type="button" className="flex-1 justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors focus:outline-none" onClick={() => setShowDeleteConfirm(true)}>{t("common.remove")}</button>
			<button type="button" className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none" onClick={onClose}>{t("common.cancel")}</button>
			<button type="button" className="flex-1 justify-center rounded-lg border border-transparent bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)] transition-colors shadow-md shadow-[var(--color-accent)]/25 focus:outline-none" onClick={handleSave}>{t("common.save")}</button>
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



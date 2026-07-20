import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NumberInput } from "@/components/UI/NumberInput";
import { SettingRow } from "@/components/UI/SettingRow";
import { Slider } from "@/components/UI/Slider";
import { TextInput } from "@/components/UI/TextInput";
import { useContainerStore } from "@/stores/containerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Container as ContainerType } from "@/types/container";
import { LayoutGrid, Paintbrush, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { motion, AnimatePresence } from "framer-motion";

interface GameContainerSettingsProps {
	container: ContainerType;
	onClose: () => void;
}

type SettingCategory = "layout" | "appearance";

export function GameContainerSettings({
	container,
	onClose,
}: GameContainerSettingsProps) {
	const { t } = useTranslation();
	const { updateContainerStyle, updateContainerSize } = useContainerStore();
	const { settings } = useSettingsStore();

	const [activeCategory, setActiveCategory] = useState<SettingCategory>("appearance");

	const gw = settings.gridWidth || 80;
	const gh = settings.gridHeight || 104;
	const gx = settings.gridGapX ?? 20;
	const gy = settings.gridGapY ?? 20;

	// Calculate current grid size
	const gridW = Math.max(1, Math.round(container.size.width / (gw + gx)));
	const gridH = Math.max(1, Math.round(container.size.height / (gh + gy)));

	const containerRef = useRef<HTMLDivElement>(null);

	// Since the wrapper has styling in GameContainer, we just manage height here.
	// We'll update GameContainer to NOT provide the wrapper so we can unify it here.
	// Wait, we shouldn't modify GameContainer.tsx if we can just return the content.
	// But to have a consistent UI with ContainerSettings, let's keep the content structured.
	// For GameContainer, the wrapper is provided by GameContainer.tsx. We will just render the content here.
	
	const updateSize = (w: number, h: number) => {
		updateContainerSize(container.id, {
			width: w * (gw + gx) - gx,
			height: h * (gh + gy) - gy,
		});
	};

	const renderContent = () => {
		switch (activeCategory) {
			case "layout":
				return (
					<motion.div
						key="layout"
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 10 }}
						className="space-y-3"
					>
						<SettingRow title={t("container.gameGridSize")} layout="vertical">
							<div className="flex gap-2 items-center">
								<NumberInput
									value={gridW}
									onChange={(val) => updateSize(val, gridH)}
									min={1}
									className="flex-1"
								/>
								<span className="text-[var(--color-text)] text-xs font-medium opacity-50">
									x
								</span>
								<NumberInput
									value={gridH}
									onChange={(val) => updateSize(gridW, val)}
									min={1}
									className="flex-1"
								/>
							</div>
						</SettingRow>
					</motion.div>
				);
			case "appearance":
				return (
					<motion.div
						key="appearance"
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 10 }}
						className="space-y-3"
					>
						<SettingRow title={`${t("container.opacity")} (${Math.round((container.style.backgroundOpacity ?? 1) * 100)}%)`} layout="vertical">
							<Slider
								min={0}
								max={1}
								step={0.1}
								value={container.style.backgroundOpacity ?? 1}
								onChange={(val) =>
									updateContainerStyle(container.id, { backgroundOpacity: val })
								}
							/>
						</SettingRow>

						<SettingRow title={`${t("container.cornerRadius")} (${container.style.cornerRadius ?? 16}px)`} layout="vertical">
							<Slider
								min={0}
								max={40}
								step={1}
								value={container.style.cornerRadius ?? 16}
								onChange={(val) =>
									updateContainerStyle(container.id, { cornerRadius: val })
								}
							/>
						</SettingRow>

						<SettingRow title={t("container.coverImage")} layout="vertical">
							<TextInput
								placeholder={t("container.coverPlaceholder")}
								value={container.style.coverImage || ""}
								onChange={(val) =>
									updateContainerStyle(container.id, { coverImage: val })
								}
							/>
							<span className="text-[10px] text-[var(--color-text-secondary)]">
								{t("container.coverHelp")}
							</span>
						</SettingRow>
					</motion.div>
				);
		}
	};

	return (
		<div ref={containerRef} className="flex flex-col text-sm max-h-[85vh]">
			<div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 mb-4 shrink-0">
				{[
					{ id: "appearance", icon: <Paintbrush size={14} />, label: t("container.appearance", "外观") },
					{ id: "layout", icon: <LayoutGrid size={14} />, label: t("container.layout", "布局") },
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

			<div className="flex-1 overflow-y-auto hidden-native-scrollbar relative px-1">
				<AnimatePresence mode="wait">
					{renderContent()}
				</AnimatePresence>
			</div>

			<div className="flex justify-end pt-4 mt-2 border-t border-black/5 dark:border-white/5 shrink-0">
				<button
					onClick={onClose}
					className="px-4 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)] transition-colors shadow-md shadow-[var(--color-accent)]/25"
				>
					{t("common.finish")}
				</button>
			</div>
		</div>
	);
}

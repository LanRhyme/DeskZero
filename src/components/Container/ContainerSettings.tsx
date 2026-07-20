import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, List, X, Settings2, Paintbrush, SlidersHorizontal } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NumberInput } from "@/components/UI/NumberInput";
import { Slider } from "@/components/UI/Slider";
import { ConfirmDialog } from "@/components/UI/ConfirmDialog";
import { SwitchToggle } from "@/components/UI/SwitchToggle";
import { ColorPicker } from "@/components/UI/ColorPicker";
import { SegmentedControl } from "@/components/UI/SegmentedControl";
import { SettingRow } from "@/components/UI/SettingRow";
import { TextInput } from "@/components/UI/TextInput";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Container } from "@/types/container";
import { cn } from "@/utils/cn";

interface ContainerSettingsProps {
	container: Container;
	onClose: () => void;
}

type SettingCategory = "general" | "layout" | "appearance";

export function ContainerSettings({
	container,
	onClose,
}: ContainerSettingsProps) {
	const { t } = useTranslation();
	const { updateContainerStyle, updateContainerName, deleteContainer } =
		useContainerStore();

	const [activeCategory, setActiveCategory] = useState<SettingCategory>("general");

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
	const [collapsible, setCollapsible] = useState(
		container.style.collapsible ?? (container.type === "folder"),
	);
	const [expandOnHover, setExpandOnHover] = useState(
		container.style.expandOnHover ?? false,
	);
	const [enableTabs, setEnableTabs] = useState(
		container.style.enableTabs ?? false,
	);
	
	const settingsStore = useSettingsStore();
	const [isAutoOrganize, setIsAutoOrganize] = useState(
		settingsStore.settings.autoOrganizeContainerId === container.id
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
			collapsible,
			expandOnHover,
			enableTabs,
		});

		if (isAutoOrganize) {
			settingsStore.saveSettings({ autoOrganizeContainerId: container.id });
		} else if (settingsStore.settings.autoOrganizeContainerId === container.id) {
			settingsStore.saveSettings({ autoOrganizeContainerId: undefined });
		}

		onClose();
	};

	const handleDelete = async () => {
		const { moveItemsToDesktop } = useDesktopStore.getState();
		await moveItemsToDesktop(container.items, container.position.x, container.position.y, true);
		await deleteContainer(container.id);
		onClose();
	};

	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

	const handleToggleAutoOrganize = (checked: boolean) => {
		if (checked) {
			const currentTargetId = settingsStore.settings.autoOrganizeContainerId;
			if (currentTargetId && currentTargetId !== container.id) {
				setShowOverrideConfirm(true);
			} else {
				setIsAutoOrganize(true);
			}
		} else {
			setIsAutoOrganize(false);
		}
	};

	const renderContent = () => {
		switch (activeCategory) {
			case "general":
				return (
					<motion.div
						key="general"
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 10 }}
						className="space-y-3"
					>
						<SettingRow title={t("container.name")} layout="vertical">
							<TextInput value={name} onChange={setName} placeholder={t("container.namePlaceholder")} />
						</SettingRow>

						<div className="space-y-3 pt-2">
							<label className="flex items-center gap-2 cursor-pointer group">
								<SwitchToggle checked={collapsible} onChange={setCollapsible} />
								<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
									{t("container.clickHeaderCollapse", "点击标题栏折叠")}
								</span>
							</label>

							<motion.div
								initial={false}
								animate={{ height: collapsible ? "auto" : 0, opacity: collapsible ? 1 : 0 }}
								className="overflow-hidden"
							>
								<label className="flex items-center gap-2 cursor-pointer group">
									<SwitchToggle checked={expandOnHover} onChange={setExpandOnHover} />
									<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
										{t("container.expandOnHover", "鼠标悬停自动展开")}
									</span>
								</label>
							</motion.div>
						</div>

						<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

						<div className="space-y-3">
							<label className="flex items-center gap-2 cursor-pointer group">
								<SwitchToggle checked={isAutoOrganize} onChange={handleToggleAutoOrganize} />
								<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
									{t("settings.general.autoOrganizeContainer", "自动整理新文件到此收纳盒")}
								</span>
							</label>
						</div>

						<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

						<div className="space-y-3">
							<label className="flex items-center gap-2 cursor-pointer group">
								<SwitchToggle checked={enableTabs} onChange={setEnableTabs} />
								<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
									{t("container.enableTabs", "开启多标签页")}
								</span>
							</label>
						</div>
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
						<SettingRow title={t("container.layout")} layout="vertical">
							<SegmentedControl
								options={[
									{ value: "grid", label: t("container.grid"), icon: <LayoutGrid size={14} /> },
									{ value: "list", label: t("container.list"), icon: <List size={14} /> },
								]}
								value={layout}
								onChange={(v) => setLayout(v as "grid" | "list")}
								variant="accent"
							/>
						</SettingRow>

						<motion.div
							initial={false}
							animate={{ height: layout === "grid" ? "auto" : 0, opacity: layout === "grid" ? 1 : 0 }}
							className="overflow-hidden"
						>
							<SettingRow title={t("container.gridSize")} layout="vertical">
								<div className="flex gap-2">
									<NumberInput value={gridWidth} onChange={setGridWidth} prefix="W" className="flex-1" min={20} />
									<NumberInput value={gridHeight} onChange={setGridHeight} prefix="H" className="flex-1" min={20} />
								</div>
							</SettingRow>
						</motion.div>

						<motion.div
							initial={false}
							animate={{ height: layout === "list" ? "auto" : 0, opacity: layout === "list" ? 1 : 0 }}
							className="overflow-hidden"
						>
							<div className="space-y-3">
								<SettingRow title={t("container.listHeight")} layout="vertical">
									<NumberInput value={listHeight} onChange={setListHeight} prefix="H" min={20} />
								</SettingRow>
								<label className="flex items-center gap-2 cursor-pointer group">
									<SwitchToggle checked={showDetails} onChange={setShowDetails} />
									<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
										{t("container.showDetails")}
									</span>
								</label>
							</div>
						</motion.div>
						
						<div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

						<div className="space-y-3 pt-2">
							<label className="flex items-center gap-2 cursor-pointer group">
								<SwitchToggle checked={hideAppNames} onChange={setHideAppNames} />
								<span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
									{t("container.hideAppName")}
								</span>
							</label>
						</div>
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
						<SettingRow title={t("container.background")} layout="vertical">
							<SegmentedControl
								options={[
									{ value: "theme", label: t("container.followTheme") },
									{ value: "custom", label: t("common.custom") },
								]}
								value={bgColor === "theme" || !bgColor ? "theme" : "custom"}
								onChange={(v) => setBgColor(v === "theme" ? "theme" : "#000000")}
								variant="accent"
							/>
							<div className="flex items-center gap-3">
								{bgColor !== "theme" && bgColor && (
									<ColorPicker
										value={bgColor.startsWith("#") ? bgColor : "#000000"}
										onChange={setBgColor}
										size="md"
									/>
								)}
								<div className="flex-1">
									<div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
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
					</motion.div>
				);
		}
	};

	return (
		<>
			<div ref={containerRef} className="w-[320px] max-h-[85vh] transform overflow-hidden rounded-xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl p-4 text-left align-middle shadow-2xl transition-all border border-black/5 dark:border-white/10 ring-1 ring-black/5 flex flex-col">
				<div className="text-sm font-medium leading-5 text-[var(--color-text)] flex justify-between items-center mb-4">
					<span className="flex items-center gap-2">
						{t("container.settingsTitle")}{" "}
						{container.name && (
							<span className="text-[10px] font-normal text-[var(--color-text-secondary)] opacity-70 truncate max-w-[120px]">
								({container.name})
							</span>
						)}
					</span>
					<button
						onClick={onClose}
						className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
					>
						<X size={14} />
					</button>
				</div>

				<div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 mb-4 shrink-0">
					{[
						{ id: "general", icon: <Settings2 size={14} />, label: t("container.basic", "常规") },
						{ id: "layout", icon: <LayoutGrid size={14} />, label: t("container.layout", "布局") },
						{ id: "appearance", icon: <Paintbrush size={14} />, label: t("container.appearance", "外观") },
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

				<div className="pt-4 mt-2 border-t border-black/5 dark:border-white/5 flex gap-2 shrink-0">
					<button
						type="button"
						className="flex-1 justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors focus:outline-none"
						onClick={() => setShowDeleteConfirm(true)}
					>
						{t("common.remove")}
					</button>
					<button
						type="button"
						className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none"
						onClick={onClose}
					>
						{t("common.cancel")}
					</button>
					<button
						type="button"
						className="flex-1 justify-center rounded-lg border border-transparent bg-[var(--color-accent)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--color-accent)] transition-colors shadow-md shadow-[var(--color-accent)]/25 focus:outline-none"
						onClick={handleSave}
					>
						{t("common.save")}
					</button>
				</div>
			</div>

			<ConfirmDialog
				isOpen={showDeleteConfirm}
				title={t("container.removeTitle")}
				message={t("container.removeConfirm", { name: container.name })}
				confirmLabel={t("common.remove")}
				onConfirm={async () => {
					setShowDeleteConfirm(false);
					await handleDelete();
				}}
				onCancel={() => setShowDeleteConfirm(false)}
			/>
			<ConfirmDialog
				isOpen={showOverrideConfirm}
				title={t("container.overrideAutoOrganizeTitle")}
				message={t("container.overrideAutoOrganizeConfirm")}
				confirmLabel={t("common.confirm")}
				onConfirm={() => {
					setShowOverrideConfirm(false);
					setIsAutoOrganize(true);
				}}
				onCancel={() => setShowOverrideConfirm(false)}
			/>
		</>
	);
}

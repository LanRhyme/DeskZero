import { Tab } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	Archive,
	Info,
	LayoutGrid,
	Palette,
	Plus,
	RotateCcw,
	Settings,
	Shield,
	Trash2,
	X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ColorPicker } from "@/components/UI/ColorPicker";
import { ConfirmDialog } from "@/components/UI/ConfirmDialog";
import { SegmentedControl } from "@/components/UI/SegmentedControl";
import { SettingRow } from "@/components/UI/SettingRow";
import { Slider } from "@/components/UI/Slider";
import { SwitchToggle } from "@/components/UI/SwitchToggle";
import { useContainerStore } from "@/stores/containerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import type { BackupRecord, BackupSettings } from "@/types/backup";
import {
	createBackup,
	deleteBackup,
	getBackupSettings,
	listBackups,
	restoreBackup,
	saveBackupSettings,
} from "@/services/backupService";
import { syncWindowsLayout } from "@/services/desktopService";
import { cn } from "@/utils/cn";
import appConfig from "../../../deskzero.config.json";

export function SettingsPage() {
	const { t } = useTranslation();
	const { settings, saveSettings, loading, error } = useSettingsStore();
	const [syncing, setSyncing] = useState(false);
	const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
	const [syncMultiplier, setSyncMultiplier] = useState(1.0);

	const handleSyncWindowsLayout = async (multiplier: number) => {
		try {
			setSyncing(true);
			await syncWindowsLayout(multiplier);
			await useSettingsStore.getState().loadSettings();
			
			// 后端 Rust 会自动广播 settings-updated 和 sync-desktop-layout 事件到所有窗口
			useToastStore.getState().addToast(
				t("settings.general.syncSuccess") + multiplier.toFixed(2) + "x）",
				"success"
			);
		} catch (err: any) {
			useToastStore.getState().addToast(
				err.toString(),
				"error"
			);
		} finally {
			setSyncing(false);
		}
	};

	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// 备份管理状态
	const [backupList, setBackupList] = useState<BackupRecord[]>([]);
	const [backupSettings, setBackupSettingsState] = useState<BackupSettings>({
		autoBackupEnabled: true,
		autoBackupHours: 6,
		maxBackups: 20,
	});
	const [backupLoading, setBackupLoading] = useState(false);
	const [backupNote, setBackupNote] = useState("");
	const [confirmDialog, setConfirmDialog] = useState<{
		open: boolean;
		title: string;
		message: string;
		onConfirm: () => void;
	}>({ open: false, title: "", message: "", onConfirm: () => {} });

	const loadBackupData = useCallback(async () => {
		try {
			const [list, settings] = await Promise.all([
				listBackups(),
				getBackupSettings(),
			]);
			setBackupList(list);
			setBackupSettingsState(settings);
		} catch (err) {
			console.error("加载备份数据失败:", err);
		}
	}, []);

	useEffect(() => {
		loadBackupData();
	}, [loadBackupData]);

	const handleCreateBackup = async () => {
		try {
			setBackupLoading(true);
			const name = backupNote.trim() || undefined;
			await createBackup(name);
			setBackupNote("");
			await loadBackupData();
			useToastStore.getState().addToast(t("settings.backup.backupSuccess"), "success");
		} catch (err: any) {
			useToastStore.getState().addToast(t("settings.backup.backupFailed") + err.toString(), "error");
		} finally {
			setBackupLoading(false);
		}
	};

	const handleRestoreBackup = (backup: BackupRecord) => {
		setConfirmDialog({
			open: true,
			title: t("settings.backup.restoreTitle"),
			message: t("settings.backup.restoreConfirm", { name: backup.name }),
			onConfirm: async () => {
				try {
					setBackupLoading(true);
					await restoreBackup(backup.id);
					await useSettingsStore.getState().loadSettings();
					await useContainerStore.getState().fetchContainers();
					
					// 发送事件到主窗口刷新桌面图标
					const { emit } = await import("@tauri-apps/api/event");
					await emit("sync-desktop-layout");
					
					useToastStore.getState().addToast(t("settings.backup.restoreSuccess"), "success");
				} catch (err: any) {
					useToastStore.getState().addToast(t("settings.backup.restoreFailed") + err.toString(), "error");
				} finally {
					setBackupLoading(false);
					setConfirmDialog((prev) => ({ ...prev, open: false }));
				}
			},
		});
	};

	const handleDeleteBackup = (backup: BackupRecord) => {
		setConfirmDialog({
			open: true,
			title: t("settings.backup.deleteTitle"),
			message: t("settings.backup.deleteConfirm", { name: backup.name }),
			onConfirm: async () => {
				try {
					await deleteBackup(backup.id);
					await loadBackupData();
					useToastStore.getState().addToast(t("settings.backup.deleteSuccess"), "success");
				} catch (err: any) {
					useToastStore.getState().addToast(t("settings.backup.deleteFailed") + err.toString(), "error");
				} finally {
					setConfirmDialog((prev) => ({ ...prev, open: false }));
				}
			},
		});
	};

	const handleSaveBackupSettings = async (changes: Partial<BackupSettings>) => {
		const newSettings = { ...backupSettings, ...changes };
		setBackupSettingsState(newSettings);
		try {
			await saveBackupSettings(changes);
		} catch (err: any) {
			useToastStore.getState().addToast(t("settings.backup.saveFailed") + err.toString(), "error");
		}
	};

	const formatBackupTime = (timestamp: number) => {
		const date = new Date(timestamp);
		const locale = settings.language === "en" ? "en-US" : "zh-CN";
		return date.toLocaleString(locale, {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	};
	const thumbRef = useRef<HTMLDivElement>(null);
	const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [isScrolling, setIsScrolling] = useState(false);

	const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);

	const handleScroll = () => {
		const el = scrollContainerRef.current;
		const thumb = thumbRef.current;
		if (!el || !thumb) return;

		if (el.scrollHeight <= el.clientHeight) {
			if (isScrolling) setIsScrolling(false);
			return;
		}

		const scrollRatio = el.scrollTop / (el.scrollHeight - el.clientHeight);
		const thumbHeight = Math.max(
			30,
			(el.clientHeight / el.scrollHeight) * el.clientHeight,
		);
		const maxThumbTop = el.clientHeight - thumbHeight;

		thumb.style.height = `${thumbHeight}px`;
		thumb.style.transform = `translateY(${scrollRatio * maxThumbTop}px)`;

		if (!isScrolling) setIsScrolling(true);

		if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
		scrollTimeout.current = window.setTimeout(() => {
			setIsScrolling(false);
		}, 1000);
	};

		const tabs = [
		{ id: "general", name: t("settings.tabs.general"), icon: Settings },
		{ id: "appearance", name: t("settings.tabs.appearance"), icon: Palette },
		{ id: "backup", name: t("settings.tabs.backup"), icon: Archive },
		{ id: "about", name: t("settings.tabs.about"), icon: Info },
	];

	return (
		<div className="w-screen h-screen flex flex-col bg-[#fafafa] dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 select-none overflow-hidden font-sans">
			{loading && (
				<div className="fixed top-0 left-0 right-0 h-1 bg-[var(--color-accent)]/20 z-50 overflow-hidden">
					<div className="w-1/3 h-full bg-[var(--color-accent)] rounded-full animate-ping"></div>
				</div>
			)}

			{error && (
				<motion.div
					initial={{ opacity: 0, y: -20, x: "-50%" }}
					animate={{ opacity: 1, y: 16, x: "-50%" }}
					className="fixed top-0 left-1/2 bg-red-500/90 backdrop-blur-xl text-white text-xs px-4 py-2.5 rounded-full shadow-lg shadow-red-500/20 z-50 flex items-center gap-2 font-medium"
				>
					<AlertCircle size={14} />
					{error}
				</motion.div>
			)}

			<Tab.Group
				vertical
				as="div"
				className="flex flex-1 overflow-hidden min-h-0 w-full relative"
			>
				{/* Subtle ambient background glow */}
				<div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-accent-subtle)] blur-[120px] rounded-full pointer-events-none" />
				<div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-accent-subtle)] blur-[120px] rounded-full pointer-events-none" />

				{/* Sidebar */}
				<Tab.List className="w-64 p-6 border-r border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-2xl flex flex-col gap-2 z-10 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
					<div className="mb-8 px-2 pt-2">
						<div className="text-2xl font-extrabold text-[var(--color-accent)] inline-flex items-center gap-3 tracking-tight">
							<LayoutGrid className="text-[var(--color-accent)] w-7 h-7" />
							DeskZero
						</div>
					</div>

					{tabs.map((tab) => (
						<Tab as={Fragment} key={tab.id}>
							{({ selected }) => (
								<button
									className={cn(
										"relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors outline-none w-full text-left group",
										selected
											? "text-[var(--color-accent)]"
											: "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5",
									)}
								>
									{selected && (
										<motion.div
											layoutId="active-tab"
											className="absolute inset-0 bg-[var(--color-accent)]/10 dark:bg-[var(--color-accent)]/20 rounded-xl"
											initial={false}
											transition={{
												type: "spring",
												stiffness: 400,
												damping: 30,
											}}
										/>
									)}
									<tab.icon
										className={cn(
											"relative z-10 w-5 h-5 transition-transform duration-300",
											selected ? "scale-110" : "group-hover:scale-110",
										)}
									/>
									<span className="relative z-10">{tab.name}</span>
								</button>
							)}
						</Tab>
					))}
				</Tab.List>

				{/* Content */}
				<div className="flex-1 relative overflow-hidden bg-transparent z-10">
					<Tab.Panels
						ref={scrollContainerRef}
						onScroll={handleScroll}
						className="w-full h-full overflow-y-auto hidden-native-scrollbar relative"
					>
						{/* General Settings */}
						<Tab.Panel className="p-10 max-w-4xl mx-auto min-h-full">
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
							>
							<h2 className="text-3xl font-extrabold mb-8 text-[var(--color-text)] tracking-tight">
								{t("settings.general.title")}
							</h2>

								<div className="space-y-6">
								<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
								<SettingRow
									title={t("settings.general.language")}
									desc={t("settings.general.languageDesc")}
								>
									<SegmentedControl
										options={[
											{ value: "zh", label: "中文" },
											{ value: "en", label: "English" },
										]}
										value={settings.language || "zh"}
										onChange={(v) => saveSettings({ language: v as "zh" | "en" })}
									/>
								</SettingRow>
								<SettingRow
									title={t("settings.general.autoStart")}
									desc={t("settings.general.autoStartDesc")}
								>
									<div className="flex items-center gap-3">
										{settings.autoStart && (
											<button
												onClick={async () => {
													const newValue = !(settings.autoStartHighPriority === true);
													saveSettings({ autoStartHighPriority: newValue });
													try {
														const { invoke } = await import("@tauri-apps/api/core");
														await invoke("set_auto_start", {
															enable: true,
															highPriority: newValue,
														});
													} catch (err) {
														console.error("设置高优先级启动失败:", err);
														useToastStore.getState().addToast(
															t("settings.general.autoStartFailed") + (err instanceof Error ? err.message : String(err)),
															"error"
														);
														// 回滚前端状态
														saveSettings({ autoStartHighPriority: !newValue });
													}
												}}
												title={t("settings.general.autoStartHighPriorityDesc")}
												className={cn(
													"flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all duration-200 border cursor-pointer select-none",
													settings.autoStartHighPriority
														? "bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400"
														: "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300"
												)}
											>
												<Shield className="w-3 h-3" />
												{settings.autoStartHighPriority
													? t("settings.general.autoStartHighPriorityActive")
													: t("settings.general.autoStartHighPrioritySetup")}
											</button>
										)}
										<SwitchToggle
											checked={settings.autoStart === true}
											onChange={async () => {
												const newValue = !(settings.autoStart === true);
												saveSettings({ autoStart: newValue });
												try {
													const { invoke } = await import("@tauri-apps/api/core");
													await invoke("set_auto_start", {
														enable: newValue,
														highPriority: settings.autoStartHighPriority === true,
													});
												} catch (err) {
													console.error("设置开机自启失败:", err);
													useToastStore.getState().addToast(
														t("settings.general.autoStartFailed") + (err instanceof Error ? err.message : String(err)),
														"error"
													);
													// 回滚前端状态
													saveSettings({ autoStart: !newValue });
												}
											}}
										/>
									</div>
								</SettingRow>

									<SettingRow
										title={t("settings.general.hideFileExt")}
										desc={t("settings.general.hideFileExtDesc")}
									>
											<SwitchToggle
												checked={settings.hideFileExtensions !== false}
												onChange={() =>
													saveSettings({
														hideFileExtensions: !(
															settings.hideFileExtensions !== false
														),
													})
												}
											/>
										</SettingRow>

									<SettingRow
										title={t("settings.general.doubleClickHide")}
										desc={t("settings.general.doubleClickHideDesc")}
										noBorder
									>
											<SwitchToggle
												checked={settings.doubleClickHide !== false}
												onChange={() =>
													saveSettings({
														doubleClickHide: !settings.doubleClickHide,
													})
												}
											/>
										</SettingRow>
									</div>

									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
									<SettingRow
										title={t("settings.general.syncLayout")}
										desc={t("settings.general.syncLayoutDesc")}
									>
											<button
												onClick={() => setIsSyncModalOpen(true)}
												disabled={syncing}
												className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
											>
												{syncing ? t("settings.general.syncing") : t("settings.general.syncNow")}
											</button>
										</SettingRow>
									<SettingRow
										title={t("settings.general.gridWidth")}
										desc={t("settings.general.gridWidthDesc")}
									>
											<div className="flex items-center gap-4 w-48">
												<Slider value={settings.gridWidth ?? 80} onChange={(v: number) => saveSettings({ gridWidth: v })} min={60} max={150} step={5} className="flex-1" />
												<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${settings.gridWidth ?? 80}px`}</span>
											</div>
										</SettingRow>
									<SettingRow
										title={t("settings.general.gridHeight")}
										desc={t("settings.general.gridHeightDesc")}
									>
											<div className="flex items-center gap-4 w-48">
												<Slider value={settings.gridHeight ?? 104} onChange={(v: number) => saveSettings({ gridHeight: v })} min={60} max={150} step={5} className="flex-1" />
												<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${settings.gridHeight ?? 104}px`}</span>
											</div>
										</SettingRow>
									<SettingRow
										title={t("settings.general.gridGapX")}
										desc={t("settings.general.gridGapXDesc")}
									>
											<div className="flex items-center gap-4 w-48">
												<Slider value={settings.gridGapX ?? 20} onChange={(v: number) => saveSettings({ gridGapX: v })} min={0} max={100} step={5} className="flex-1" />
												<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${settings.gridGapX ?? 20}px`}</span>
											</div>
										</SettingRow>
									<SettingRow
										title={t("settings.general.gridGapY")}
										desc={t("settings.general.gridGapYDesc")}
									>
											<div className="flex items-center gap-4 w-48">
												<Slider value={settings.gridGapY ?? 20} onChange={(v: number) => saveSettings({ gridGapY: v })} min={0} max={100} step={5} className="flex-1" />
												<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${settings.gridGapY ?? 20}px`}</span>
											</div>
										</SettingRow>
									<SettingRow
										title={t("settings.general.showGridOnDrag")}
										desc={t("settings.general.showGridOnDragDesc")}
									>
											<SwitchToggle checked={settings.showGridOnDrag !== false} onChange={(checked: boolean) => saveSettings({ showGridOnDrag: checked })} />
										</SettingRow>
									<SettingRow
										title={t("settings.general.fontSize")}
										desc={t("settings.general.fontSizeDesc")}
										noBorder
									>
											<div className="flex items-center gap-4 w-48">
												<Slider value={settings.fontSize || 12} onChange={(v: number) => saveSettings({ fontSize: v })} min={10} max={24} step={1} className="flex-1" />
												<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${settings.fontSize || 12}px`}</span>
											</div>
										</SettingRow>
									</div>
								</div>
							</motion.div>
						</Tab.Panel>

						{/* Appearance Settings */}
						<Tab.Panel className="p-10 max-w-4xl mx-auto min-h-full">
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
							>
							<h2 className="text-3xl font-extrabold mb-8 text-[var(--color-text)] tracking-tight">
								{t("settings.appearance.title")}
							</h2>

								<div className="space-y-6">
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
								<SettingRow title={t("settings.appearance.theme")} desc={t("settings.appearance.themeDesc")}>
									<SegmentedControl
										options={[
											{ value: "light", label: t("settings.appearance.light") },
											{ value: "dark", label: t("settings.appearance.dark") },
											{ value: "system", label: t("settings.appearance.systemTheme") },
										]}
											value={settings.theme}
											onChange={(v) => saveSettings({ theme: v as any })}
										/>
									</SettingRow>

								<SettingRow
									title={t("settings.appearance.accentColor")}
									desc={t("settings.appearance.accentColorDesc")}
								>
										<ColorPicker
											value={settings.accentColor || "#0078d4"}
											onChange={(color) => saveSettings({ accentColor: color })}
											presets={[
												{ color: "#0078d4" },
												{ color: "#8b5cf6" },
												{ color: "#10b981" },
												{ color: "#f43f5e" },
											]}
										/>
									</SettingRow>

								<SettingRow
									title={t("settings.appearance.selectedBg")}
									desc={t("settings.appearance.selectedBgDesc")}
								>
									<SegmentedControl
										options={[
											{ value: "white", label: t("settings.appearance.selectedBgLight") },
											{ value: "black", label: t("settings.appearance.selectedBgDark") },
										]}
											value={settings.selectedItemBackground || "white"}
											onChange={(v) => saveSettings({ selectedItemBackground: v as any })}
										/>
									</SettingRow>

									<SettingRow
										title={t("settings.appearance.selectedBlur")}
										desc={t("settings.appearance.selectedBlurDesc")}
									>
											<SwitchToggle
												checked={!!settings.selectedItemBlur}
												onChange={() =>
													saveSettings({
														selectedItemBlur: !settings.selectedItemBlur,
													})
												}
											/>
										</SettingRow>

									<SettingRow
										title={t("settings.appearance.globalBlur")}
										desc={t("settings.appearance.globalBlurDesc")}
									>
											<SwitchToggle
												checked={!!settings.globalBlur}
												onChange={() =>
													saveSettings({ globalBlur: !settings.globalBlur })
												}
											/>
										</SettingRow>

									<SettingRow
										title={t("settings.appearance.blurRepair")}
										desc={t("settings.appearance.blurRepairDesc")}
									>
										<button
											onClick={async () => {
												const { emit } = await import("@tauri-apps/api/event");
												const { useToastStore } = await import("@/stores/toastStore");
												await emit("re-capture-wallpaper");
												useToastStore.getState().addToast(t("settings.appearance.blurRepairTriggered"), "success");
											}}
											className="px-4 py-1.5 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 active:scale-95 transition-all shadow-sm"
										>
											{t("settings.appearance.repair")}
										</button>
									</SettingRow>

									<SettingRow
										title={t("settings.appearance.hideShortcutBadge")}
										desc={t("settings.appearance.hideShortcutBadgeDesc")}
										noBorder
									>
											<SwitchToggle
												checked={!!settings.hideShortcutBadge}
												onChange={() =>
													saveSettings({
														hideShortcutBadge: !settings.hideShortcutBadge,
													})
												}
											/>
										</SettingRow>
									</div>

									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl transition-all duration-500">
									<SettingRow
										title={t("settings.appearance.iconGlow")}
										desc={t("settings.appearance.iconGlowDesc")}
										noBorder={!settings.iconGlow}
									>
											<SwitchToggle
												checked={!!settings.iconGlow}
												onChange={() =>
													saveSettings({ iconGlow: !settings.iconGlow })
												}
											/>
										</SettingRow>

										<AnimatePresence>
											{settings.iconGlow && (
												<motion.div
													initial={{ height: 0, opacity: 0 }}
													animate={{ height: "auto", opacity: 1 }}
													exit={{ height: 0, opacity: 0 }}
													className="overflow-hidden"
												>
													<div className="pl-6 pb-2 relative before:absolute before:left-2 before:top-0 before:bottom-6 before:w-[2px] before:rounded-full before:bg-[var(--color-accent)]/20">
													<SettingRow
														title={t("settings.appearance.glowRadius")}
														desc={t("settings.appearance.glowRadiusDesc")}
													>
															<div className="flex items-center gap-4 w-48">
																<Slider value={settings.iconGlowRadius ?? 12} onChange={(v: number) => saveSettings({ iconGlowRadius: v })} min={2} max={30} step={1} className="flex-1" />
																<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${settings.iconGlowRadius ?? 12}px`}</span>
															</div>
														</SettingRow>
													<SettingRow
														title={t("settings.appearance.glowIntensity")}
														desc={t("settings.appearance.glowIntensityDesc")}
														noBorder
													>
															<div className="flex items-center gap-4 w-48">
																<Slider value={settings.iconGlowIntensity ?? 0.6} onChange={(v: number) => saveSettings({ iconGlowIntensity: v })} min={0.1} max={1.0} step={0.05} className="flex-1" />
																<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${Math.round((settings.iconGlowIntensity ?? 0.6) * 100)}%`}</span>
															</div>
														</SettingRow>
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</div>

									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
									<SettingRow
										title={t("settings.appearance.iconOpacity")}
										desc={t("settings.appearance.iconOpacityDesc")}
									>
											<div className="flex items-center gap-4 w-48">
												<Slider value={settings.iconOpacity ?? 1.0} onChange={(v: number) => saveSettings({ iconOpacity: v })} min={0.1} max={1.0} step={0.05} className="flex-1" />
												<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${Math.round((settings.iconOpacity ?? 1.0) * 100)}%`}</span>
											</div>
										</SettingRow>
									<SettingRow
										title={t("settings.appearance.textOpacity")}
										desc={t("settings.appearance.textOpacityDesc")}
										noBorder
									>
											<div className="flex items-center gap-4 w-48">
												<Slider value={settings.textOpacity ?? 1.0} onChange={(v: number) => saveSettings({ textOpacity: v })} min={0.1} max={1.0} step={0.05} className="flex-1" />
												<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{`${Math.round((settings.textOpacity ?? 1.0) * 100)}%`}</span>
											</div>
										</SettingRow>
									</div>

									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl transition-all duration-500">
									<SettingRow
										title={t("settings.appearance.parallax")}
										desc={t("settings.appearance.parallaxDesc")}
										noBorder={!settings.parallaxEnabled}
									>
											<SwitchToggle
												checked={!!settings.parallaxEnabled}
												onChange={() =>
													saveSettings({ parallaxEnabled: !settings.parallaxEnabled })
												}
											/>
										</SettingRow>

										<AnimatePresence>
											{settings.parallaxEnabled && (
												<motion.div
													initial={{ height: 0, opacity: 0 }}
													animate={{ height: "auto", opacity: 1 }}
													exit={{ height: 0, opacity: 0 }}
													className="overflow-hidden"
												>
													<div className="pl-6 pb-2 relative before:absolute before:left-2 before:top-0 before:bottom-6 before:w-[2px] before:rounded-full before:bg-[var(--color-accent)]/20">
													<SettingRow
														title={t("settings.appearance.parallaxIntensity")}
														desc={t("settings.appearance.parallaxIntensityDesc")}
														noBorder
													>
															<div className="flex items-center gap-4 w-48">
																<Slider value={settings.parallaxIntensity ?? 2} onChange={(v: number) => saveSettings({ parallaxIntensity: v })} min={1} max={10} step={1} className="flex-1" />
																<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{settings.parallaxIntensity ?? 2}</span>
															</div>
														</SettingRow>
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								</div>
							</motion.div>
						</Tab.Panel>

						{/* Backup Settings */}
						<Tab.Panel className="p-10 max-w-4xl mx-auto min-h-full">
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
							>
							<h2 className="text-3xl font-extrabold mb-8 text-[var(--color-text)] tracking-tight">
								{t("settings.backup.title")}
							</h2>

								<div className="space-y-6">
									{/* 自动备份设置 */}
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
									<SettingRow
										title={t("settings.backup.autoBackup")}
										desc={t("settings.backup.autoBackupDesc")}
									>
											<SwitchToggle
												checked={backupSettings.autoBackupEnabled}
												onChange={() =>
													handleSaveBackupSettings({
														autoBackupEnabled: !backupSettings.autoBackupEnabled,
													})
												}
											/>
										</SettingRow>

										{backupSettings.autoBackupEnabled && (
											<>
											<SettingRow
												title={t("settings.backup.interval")}
												desc={t("settings.backup.intervalDesc")}
											>
													<div className="flex items-center gap-4 w-48">
														<Slider value={backupSettings.autoBackupHours} onChange={(v: number) => handleSaveBackupSettings({ autoBackupHours: v })} min={1} max={24} step={1} className="flex-1" />
														<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{t("settings.backup.hours", { count: backupSettings.autoBackupHours })}</span>
													</div>
												</SettingRow>
											<SettingRow
												title={t("settings.backup.maxBackups")}
												desc={t("settings.backup.maxBackupsDesc")}
												noBorder
											>
													<div className="flex items-center gap-4 w-48">
														<Slider value={backupSettings.maxBackups} onChange={(v: number) => handleSaveBackupSettings({ maxBackups: v })} min={5} max={100} step={5} className="flex-1" />
														<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{t("settings.backup.count", { count: backupSettings.maxBackups })}</span>
													</div>
												</SettingRow>
											</>
										)}
									</div>

									{/* 手动备份 */}
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-4 shadow-sm backdrop-blur-xl">
										<div className="flex items-center gap-3 mb-3">
											<input
												type="text"
												value={backupNote}
												onChange={(e) => setBackupNote(e.target.value)}
												placeholder={t("settings.backup.notePlaceholder")}
												className="flex-1 px-3 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]/50 outline-none border border-transparent focus:border-[var(--color-accent)]/30 transition-colors"
											/>
											<button
												onClick={handleCreateBackup}
												disabled={backupLoading}
												className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
											>
												<Plus size={14} />
												{t("settings.backup.backupNow")}
											</button>
										</div>
									</div>

									{/* 备份列表 */}
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm backdrop-blur-xl overflow-hidden">
										<div className="px-6 py-3 border-b border-black/5 dark:border-white/5">
											<div className="text-sm font-medium text-[var(--color-text)]">
												{t("settings.backup.history")}
												<span className="ml-2 text-xs text-[var(--color-text-secondary)]">
													{t("settings.backup.totalBackups", { count: backupList.length })}
												</span>
											</div>
										</div>

										{backupList.length === 0 ? (
											<div className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]/60">
												{t("settings.backup.noBackups")}
											</div>
										) : (
											<div className="max-h-[400px] overflow-y-auto hidden-native-scrollbar">
												{backupList.map((backup) => (
													<div
														key={backup.id}
														className="flex items-center justify-between px-6 py-3 border-b border-black/5 dark:border-white/5 last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group"
													>
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2">
																<span className="text-sm font-medium text-[var(--color-text)] truncate">
																	{backup.name}
																</span>
																<span
																	className={cn(
																		"text-[10px] px-1.5 py-0.5 rounded-full font-medium",
																		backup.type === "manual"
																			? "bg-blue-500/10 text-blue-500"
																			: "bg-green-500/10 text-green-500"
																	)}
																>
																	{backup.type === "manual" ? t("common.manual") : t("common.auto")}
																</span>
															</div>
															<div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
																{formatBackupTime(backup.createdAt)}
															</div>
														</div>
														<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
															<button
																onClick={() => handleRestoreBackup(backup)}
																className="p-1.5 rounded-lg hover:bg-[var(--color-accent)]/10 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
																title={t("settings.backup.restore")}
															>
																<RotateCcw size={14} />
															</button>
															<button
																onClick={() => handleDeleteBackup(backup)}
																className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
																title={t("common.delete")}
															>
																<Trash2 size={14} />
															</button>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							</motion.div>
						</Tab.Panel>

						{/* About Settings */}
						<Tab.Panel className="p-10 max-w-4xl mx-auto min-h-full">
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
							>
							<h2 className="text-3xl font-extrabold mb-8 text-[var(--color-text)] tracking-tight">
								{t("settings.about.title")}
							</h2>

								<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 p-8 shadow-sm backdrop-blur-xl mb-6 flex items-center gap-8">
									<img
										src="/icon.png"
										alt="DeskZero Logo"
										className="w-24 h-24 object-contain drop-shadow-md"
									/>
									<div>
										<h3 className="text-3xl font-black text-[var(--color-text)] tracking-tight">
											{appConfig.name}
										</h3>
										<div className="text-[var(--color-text-secondary)] font-medium mt-1">
											Version {appConfig.version}
										</div>
										<div className="text-sm text-[var(--color-text-secondary)] mt-3 leading-relaxed">
											{t("settings.about.description")}
										</div>
									</div>
								</div>

								<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
								<SettingRow
									title={t("settings.about.developer")}
									desc={t("settings.about.developerDesc")}
									noBorder={false}
								>
										<span className="text-sm font-medium text-[var(--color-text)] px-2">
											LanRhyme
										</span>
									</SettingRow>

								<SettingRow
									title={t("settings.about.license")}
									desc={t("settings.about.licenseDesc")}
									noBorder={false}
								>
										<button
											onClick={() => setIsLicenseDialogOpen(true)}
											className="px-4 py-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-lg text-sm font-medium transition-colors outline-none cursor-pointer"
										>
											{t("settings.about.viewLicense")}
										</button>
									</SettingRow>

								<SettingRow
									title={t("settings.about.github")}
									desc={t("settings.about.githubDesc")}
									noBorder={true}
								>
										<a
											href="https://github.com/LanRhyme/DeskZero"
											target="_blank"
											rel="noreferrer"
											className="px-4 py-1.5 bg-[var(--color-accent-subtle)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 rounded-lg text-sm font-medium transition-colors outline-none cursor-pointer"
											onClick={async (e) => {
												e.preventDefault();
												try {
													const { invoke } = await import(
														"@tauri-apps/api/core"
													);
													await invoke("open_file", {
														path: "https://github.com/LanRhyme/DeskZero",
													});
												} catch (err) {
													window.open(
														"https://github.com/LanRhyme/DeskZero",
														"_blank",
													);
												}
											}}
										>
											{t("settings.about.goToGitHub")}
										</a>
									</SettingRow>
								</div>

								<div className="mt-8 pl-2 text-xs text-[var(--color-text-secondary)]/50 font-medium tracking-wide uppercase">
									&copy; {new Date().getFullYear()} LanRhyme. All rights
									reserved.
								</div>
							</motion.div>
						</Tab.Panel>
					</Tab.Panels>

					{/* Custom Animated Scrollbar Thumb */}
					<div
						ref={thumbRef}
						className={cn(
							"absolute top-0 right-1.5 w-1.5 bg-black/20 dark:bg-white/20 rounded-full pointer-events-none",
							"transition-opacity duration-300 ease-in-out backdrop-blur-sm",
							isScrolling ? "opacity-100" : "opacity-0",
						)}
					/>
				</div>
			</Tab.Group>

			{/* License Dialog */}
			<AnimatePresence>
				{isLicenseDialogOpen && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setIsLicenseDialogOpen(false)}
							className="absolute inset-0 bg-black/40 backdrop-blur-sm"
						/>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							transition={{ type: "spring", duration: 0.5, bounce: 0 }}
							className="relative w-full max-w-2xl max-h-[85vh] bg-[#fafafa] dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 flex flex-col overflow-hidden"
						>
							<div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20">
							<h3 className="text-xl font-bold tracking-tight text-[var(--color-text)]">
								{t("settings.about.thirdPartyLicenses")}
							</h3>
								<button
									onClick={() => setIsLicenseDialogOpen(false)}
									className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors outline-none"
								>
									<X size={20} />
								</button>
							</div>
							<div className="flex-1 overflow-y-auto p-6 space-y-6 hidden-native-scrollbar">
								{[
									// 前端核心
									{
										name: "React",
										license: "MIT",
										desc: "用于构建用户界面的 JavaScript 库",
									},
									{
										name: "React DOM",
										license: "MIT",
										desc: "React 的 DOM 渲染器",
									},
									{
										name: "Vite",
										license: "MIT",
										desc: "下一代前端构建工具",
									},
									{
										name: "TypeScript",
										license: "Apache-2.0",
										desc: "JavaScript 的超集，添加了类型系统",
									},
									// UI 框架与样式
									{
										name: "Tailwind CSS",
										license: "MIT",
										desc: "实用优先的 CSS 框架",
									},
									{
										name: "@tailwindcss/vite",
										license: "MIT",
										desc: "Tailwind CSS 的 Vite 插件",
									},
									{
										name: "Headless UI",
										license: "MIT",
										desc: "完全无样式、完全可访问的 UI 组件",
									},
									{
										name: "clsx",
										license: "MIT",
										desc: "用于构建 className 字符串的微型工具",
									},
									{
										name: "tailwind-merge",
										license: "MIT",
										desc: "智能合并 Tailwind CSS 类名",
									},
									// 动画与图标
									{
										name: "Framer Motion",
										license: "MIT",
										desc: "生产级 React 动画和手势库",
									},
									{
										name: "Lucide React",
										license: "ISC",
										desc: "精美且一致的开源图标库",
									},
									{
										name: "@iconify/react",
										license: "MIT",
										desc: "通用图标组件，支持 150+ 图标集",
									},
									{
										name: "@heroicons/react",
										license: "MIT",
										desc: "由 Tailwind CSS 团队制作的 SVG 图标集",
									},
									// 状态管理与数据
									{
										name: "Zustand",
										license: "MIT",
										desc: "轻量级、高性能的 React 状态管理",
									},
									{
										name: "lunar-javascript",
										license: "MIT",
										desc: "农历、节假日、星座等日历工具库",
									},
									// Tauri 生态
									{
										name: "Tauri",
										license: "MIT / Apache-2.0",
										desc: "构建轻量、快速、安全的桌面应用框架",
									},
									{
										name: "@tauri-apps/api",
										license: "MIT / Apache-2.0",
										desc: "Tauri 前端 JavaScript API",
									},
									{
										name: "@tauri-apps/cli",
										license: "MIT / Apache-2.0",
										desc: "Tauri 命令行工具",
									},
									{
										name: "@tauri-apps/plugin-dialog",
										license: "MIT / Apache-2.0",
										desc: "Tauri 原生对话框插件",
									},
									{
										name: "@tauri-apps/plugin-http",
										license: "MIT / Apache-2.0",
										desc: "Tauri HTTP 客户端插件",
									},
									{
										name: "@crabnebula/tauri-plugin-drag",
										license: "MIT",
										desc: "Tauri 文件拖放插件",
									},
									// Rust 后端依赖
									{
										name: "rusqlite",
										license: "MIT",
										desc: "SQLite 的 Rust 封装",
									},
									{
										name: "SQLite",
										license: "Public Domain",
										desc: "嵌入式 SQL 数据库引擎",
									},
									{
										name: "serde / serde_json",
										license: "MIT / Apache-2.0",
										desc: "Rust 序列化与反序列化框架",
									},
									{
										name: "tokio",
										license: "MIT",
										desc: "Rust 异步运行时",
									},
									{
										name: "reqwest",
										license: "MIT / Apache-2.0",
										desc: "Rust HTTP 客户端",
									},
									{
										name: "windows-rs",
										license: "MIT",
										desc: "Microsoft Windows API 的 Rust 绑定",
									},
									{
										name: "sysinfo",
										license: "MIT",
										desc: "跨平台系统信息查询库",
									},
									{
										name: "image",
										license: "MIT / Apache-2.0",
										desc: "Rust 图像处理库",
									},
									{
										name: "winreg",
										license: "MIT",
										desc: "Windows 注册表访问库",
									},
									{
										name: "notify",
										license: "MIT",
										desc: "跨平台文件系统监控库",
									},
									{
										name: "chrono",
										license: "MIT / Apache-2.0",
										desc: "Rust 日期时间处理库",
									},
									{
										name: "uuid",
										license: "MIT / Apache-2.0",
										desc: "UUID 生成与解析库",
									},
									{
										name: "rayon",
										license: "MIT / Apache-2.0",
										desc: "Rust 数据并行计算库",
									},
									{
										name: "trash",
										license: "MIT",
										desc: "跨平台文件删除到回收站",
									},
									{
										name: "clipboard-win",
										license: "MIT",
										desc: "Windows 剪贴板操作库",
									},
									{
										name: "xcap",
										license: "MIT",
										desc: "跨平台屏幕截图库",
									},
									{
										name: "base64",
										license: "MIT / Apache-2.0",
										desc: "Base64 编解码库",
									},
									{
										name: "lnk",
										license: "MIT",
										desc: "Windows 快捷方式 (.lnk) 解析库",
									},
									{
										name: "opener",
										license: "MIT / Apache-2.0",
										desc: "使用系统默认程序打开文件或 URL",
									},
									{
										name: "thiserror",
										license: "MIT / Apache-2.0",
										desc: "派生宏简化 Rust 错误类型定义",
									},
									{
										name: "once_cell",
										license: "MIT / Apache-2.0",
										desc: "单次初始化的惰性静态值",
									},
									{
										name: "pollster",
										license: "MIT / Apache-2.0",
										desc: "轻量级 Rust 异步阻塞执行器",
									},
								].map((lib) => (
									<div
										key={lib.name}
										className="bg-white dark:bg-white/[0.02] p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm"
									>
										<div className="flex items-center justify-between mb-1">
											<span className="font-bold text-[var(--color-text)]">
												{lib.name}
											</span>
											<span className="text-xs px-2 py-1 bg-black/5 dark:bg-white/10 rounded-md font-mono text-[var(--color-text-secondary)]">
												{lib.license}
											</span>
										</div>
										<p className="text-xs text-[var(--color-text-secondary)]">
											{lib.desc}
										</p>
									</div>
								))}
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
			
			<AnimatePresence>
				{isSyncModalOpen && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center">
						{/* Backdrop */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setIsSyncModalOpen(false)}
							className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
						/>
						{/* Dialog Card */}
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 10 }}
							className="relative bg-white/95 dark:bg-[#121212]/95 border border-black/10 dark:border-white/10 backdrop-blur-2xl rounded-2xl p-6 shadow-2xl w-[400px] max-w-[90vw] z-10 text-gray-900 dark:text-gray-100"
						>
							<h3 className="text-lg font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
								<LayoutGrid className="text-[var(--color-accent)] w-5 h-5" />
								{t("settings.syncDialog.title")}
							</h3>
							<p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-5">
								{t("settings.syncDialog.description")}
							</p>
							
							<div className="mb-6 bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-4">
								<div className="flex justify-between items-center mb-2">
								<span className="text-xs font-semibold text-[var(--color-text)]">
									{t("settings.syncDialog.syncMultiplier")}
								</span>
									<span className="text-xs font-bold text-[var(--color-accent)] font-mono">
										{syncMultiplier.toFixed(2)}x
									</span>
								</div>
								<Slider
									value={syncMultiplier}
									onChange={setSyncMultiplier}
									min={0.5}
									max={2.0}
									step={0.05}
								/>
								<div className="flex justify-between text-[9px] text-[var(--color-text-secondary)] mt-1 font-mono">
								<span>{t("settings.syncDialog.multiplier05")}</span>
								<span>{t("settings.syncDialog.multiplier1")}</span>
								<span>{t("settings.syncDialog.multiplier2")}</span>
								</div>
							</div>

							<div className="flex justify-end gap-3">
								<button
									onClick={() => setIsSyncModalOpen(false)}
									className="px-4 py-2 border border-black/10 dark:border-white/10 text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-xs font-medium transition-all"
								>
								{t("common.cancel")}
							</button>
							<button
								onClick={() => {
									setIsSyncModalOpen(false);
									handleSyncWindowsLayout(syncMultiplier);
								}}
								className="px-4 py-2 bg-[var(--color-accent)] text-white hover:bg-opacity-95 rounded-lg text-xs font-medium transition-all shadow-sm shadow-[var(--color-accent)]/20 active:scale-95"
							>
								{t("settings.syncDialog.confirmSync")}
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>

			<ConfirmDialog
				isOpen={confirmDialog.open}
				title={confirmDialog.title}
				message={confirmDialog.message}
				onConfirm={confirmDialog.onConfirm}
				onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
			/>
		</div>
	);
}

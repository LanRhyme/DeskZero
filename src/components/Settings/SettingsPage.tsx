import { Switch, Tab } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	Info,
	LayoutGrid,
	Palette,
	Settings,
	X,
} from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { Slider } from "@/components/UI/Slider";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { syncWindowsLayout } from "@/services/desktopService";
import { cn } from "@/utils/cn";
import appConfig from "../../../deskzero.config.json";

function CustomSwitch({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (val: boolean) => void;
}) {
	return (
		<Switch
			checked={checked}
			onChange={onChange}
			className={cn(
				checked ? "bg-[var(--color-accent)]" : "bg-black/10 dark:bg-white/10",
				"relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent border border-black/5 dark:border-white/5",
			)}
		>
			<span className="sr-only">Toggle</span>
			<span
				aria-hidden="true"
				className={cn(
					checked ? "translate-x-[22px]" : "translate-x-1",
					"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-300 ease-in-out",
				)}
			/>
		</Switch>
	);
}

function SettingRow({
	title,
	desc,
	children,
	noBorder = false,
}: {
	title: string;
	desc: string;
	children: React.ReactNode;
	noBorder?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-between py-4 group transition-colors",
				!noBorder && "border-b border-black/5 dark:border-white/5",
			)}
		>
			<div className="pr-8 flex-1">
				<div className="font-medium text-sm text-[var(--color-text)] mb-1 tracking-wide">
					{title}
				</div>
				<div className="text-xs text-[var(--color-text-secondary)] leading-relaxed group-hover:text-[var(--color-text)]/80 transition-colors duration-300">
					{desc}
				</div>
			</div>
			<div className="shrink-0 flex items-center justify-end min-w-[120px]">
				{children}
			</div>
		</div>
	);
}

function SettingSliderRow({
	title,
	desc,
	value,
	onChange,
	min,
	max,
	step,
	format = (v: number) => `${v}`,
	noBorder = false,
}: any) {
	return (
		<SettingRow title={title} desc={desc} noBorder={noBorder}>
			<div className="flex items-center gap-4 w-48">
				<Slider
					value={value}
					onChange={onChange}
					min={min}
					max={max}
					step={step}
					className="flex-1"
				/>
				<span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">
					{format(value)}
				</span>
			</div>
		</SettingRow>
	);
}

export function SettingsPage() {
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
				"已成功同步 Windows 桌面布局（缩放: " + multiplier.toFixed(2) + "x）",
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
		{ id: "general", name: "通用设置", icon: Settings },
		{ id: "appearance", name: "外观个性化", icon: Palette },
		{ id: "about", name: "关于 DeskZero", icon: Info },
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
									通用设置
								</h2>

								<div className="space-y-6">
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
										<SettingRow
											title="开机启动"
											desc="登录 Windows 时自动运行 DeskZero（功能开发中）"
										>
											<CustomSwitch checked={false} onChange={() => {}} />
										</SettingRow>

										<SettingRow
											title="隐藏文件后缀名"
											desc="桌面非快捷方式文件是否隐藏后缀名"
										>
											<CustomSwitch
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
											title="双击隐藏桌面图标"
											desc="在桌面空白处双击可快速隐藏或显示所有图标"
											noBorder
										>
											<CustomSwitch
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
											title="同步 Windows 桌面布局"
											desc="获取当前 Windows 桌面的图标位置和网格参数"
										>
											<button
												onClick={() => setIsSyncModalOpen(true)}
												disabled={syncing}
												className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
											>
												{syncing ? "同步中..." : "立即同步"}
											</button>
										</SettingRow>
										<SettingSliderRow
											title="桌面网格宽度"
											desc="调整桌面图标的水平对齐间距"
											value={settings.gridWidth ?? 80}
											onChange={(v: number) => saveSettings({ gridWidth: v })}
											min={60}
											max={150}
											step={5}
											format={(v: number) => `${v}px`}
										/>
										<SettingSliderRow
											title="桌面网格高度"
											desc="调整桌面图标的垂直对齐间距"
											value={settings.gridHeight ?? 104}
											onChange={(v: number) => saveSettings({ gridHeight: v })}
											min={60}
											max={150}
											step={5}
											format={(v: number) => `${v}px`}
										/>
										<SettingSliderRow
											title="水平网格间隙"
											desc="调整网格之间的水平不可放置区域"
											value={settings.gridGapX ?? 20}
											onChange={(v: number) => saveSettings({ gridGapX: v })}
											min={0}
											max={100}
											step={5}
											format={(v: number) => `${v}px`}
										/>
										<SettingSliderRow
											title="垂直网格间隙"
											desc="调整网格之间的垂直不可放置区域"
											value={settings.gridGapY ?? 20}
											onChange={(v: number) => saveSettings({ gridGapY: v })}
											min={0}
											max={100}
											step={5}
											format={(v: number) => `${v}px`}
										/>
										<SettingSliderRow
											title="软件名称文字大小"
											desc="调整桌面图标文字的显示大小"
											value={settings.fontSize || 12}
											onChange={(v: number) => saveSettings({ fontSize: v })}
											min={10}
											max={24}
											step={1}
											format={(v: number) => `${v}px`}
											noBorder
										/>
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
									外观个性化
								</h2>

								<div className="space-y-6">
									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
										<SettingRow title="主题" desc="选择应用的主题外观风格">
											<div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 gap-1">
												{["light", "dark", "system"].map((t) => (
													<button
														key={t}
														onClick={() => saveSettings({ theme: t as any })}
														className={cn(
															"px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300",
															settings.theme === t
																? "bg-white dark:bg-black/60 text-[var(--color-text)] shadow-sm scale-100"
																: "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] scale-95 hover:scale-100",
														)}
													>
														{t === "light"
															? "浅色"
															: t === "dark"
																? "深色"
																: "跟随系统"}
													</button>
												))}
											</div>
										</SettingRow>

										<SettingRow
											title="主题色"
											desc="设置高亮和焦点控件的强调色"
										>
											<div className="flex gap-3 items-center">
												{["#0078d4", "#8b5cf6", "#10b981", "#f43f5e"].map(
													(color) => (
														<div
															key={color}
															onClick={() =>
																saveSettings({ accentColor: color })
															}
															className={cn(
																"w-6 h-6 rounded-full cursor-pointer transition-transform shadow-inner border-2",
																(settings.accentColor || "#0078d4") === color
																	? "border-black/30 dark:border-white/50 scale-110"
																	: "border-transparent hover:scale-110",
															)}
															style={{ backgroundColor: color }}
														/>
													),
												)}
												<div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1"></div>
												<div className="relative group">
													<input
														type="color"
														value={settings.accentColor || "#0078d4"}
														onChange={(e) =>
															saveSettings({ accentColor: e.target.value })
														}
														className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
													/>
													<div
														className={cn(
															"w-6 h-6 rounded-full transition-transform shadow-inner border-2",
															![
																"#0078d4",
																"#8b5cf6",
																"#10b981",
																"#f43f5e",
															].includes(settings.accentColor || "#0078d4")
																? "border-black/30 dark:border-white/50 scale-110"
																: "border-transparent group-hover:scale-110",
														)}
														style={{
															background: ![
																"#0078d4",
																"#8b5cf6",
																"#10b981",
																"#f43f5e",
															].includes(settings.accentColor || "#0078d4")
																? settings.accentColor
																: "conic-gradient(from 90deg, #f43f5e, #8b5cf6, #0078d4, #10b981, #eab308, #f43f5e)",
														}}
													/>
												</div>
											</div>
										</SettingRow>

										<SettingRow
											title="选中图标背景"
											desc="设置图标处于选中状态时的背板颜色"
										>
											<div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 gap-1">
												<button
													onClick={() =>
														saveSettings({ selectedItemBackground: "white" })
													}
													className={cn(
														"px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300",
														settings.selectedItemBackground === "white"
															? "bg-white dark:bg-black/60 text-[var(--color-text)] shadow-sm scale-100"
															: "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] scale-95 hover:scale-100",
													)}
												>
													明亮半透明
												</button>
												<button
													onClick={() =>
														saveSettings({ selectedItemBackground: "black" })
													}
													className={cn(
														"px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300",
														settings.selectedItemBackground === "black"
															? "bg-white dark:bg-black/60 text-[var(--color-text)] shadow-sm scale-100"
															: "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] scale-95 hover:scale-100",
													)}
												>
													暗色半透明
												</button>
											</div>
										</SettingRow>

										<SettingRow
											title="选中图标毛玻璃效果"
											desc="为选中项背板添加高斯模糊效果"
										>
											<CustomSwitch
												checked={!!settings.selectedItemBlur}
												onChange={() =>
													saveSettings({
														selectedItemBlur: !settings.selectedItemBlur,
													})
												}
											/>
										</SettingRow>

										<SettingRow
											title="全局毛玻璃效果"
											desc="为收纳盒等容器和界面元素添加毛玻璃"
										>
											<CustomSwitch
												checked={!!settings.globalBlur}
												onChange={() =>
													saveSettings({ globalBlur: !settings.globalBlur })
												}
											/>
										</SettingRow>

										<SettingRow
											title="壁纸模糊穿透兼容模式"
											desc="若毛玻璃无法穿透至桌面壁纸，请开启此选项"
										>
											<CustomSwitch
												checked={!!settings.wallpaperCompatible}
												onChange={() =>
													saveSettings({
														wallpaperCompatible: !settings.wallpaperCompatible,
													})
												}
											/>
										</SettingRow>

										<SettingRow
											title="隐藏快捷方式角标"
											desc="隐藏桌面快捷方式左下角的小箭头标识"
											noBorder
										>
											<CustomSwitch
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
											title="图标发光效果"
											desc="为桌面图标添加柔和的环境发光效果"
											noBorder={!settings.iconGlow}
										>
											<CustomSwitch
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
														<SettingSliderRow
															title="发光范围"
															desc="调整图标发光效果的扩散程度"
															value={settings.iconGlowRadius ?? 12}
															onChange={(v: number) =>
																saveSettings({ iconGlowRadius: v })
															}
															min={2}
															max={30}
															step={1}
															format={(v: number) => `${v}px`}
														/>
														<SettingSliderRow
															title="发光强度"
															desc="调整发光效果的透明度和亮度"
															value={settings.iconGlowIntensity ?? 0.6}
															onChange={(v: number) =>
																saveSettings({ iconGlowIntensity: v })
															}
															min={0.1}
															max={1.0}
															step={0.05}
															format={(v: number) => `${Math.round(v * 100)}%`}
															noBorder
														/>
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</div>

									<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
										<SettingSliderRow
											title="图标不透明度"
											desc="调整桌面所有图标的整体不透明度"
											value={settings.iconOpacity ?? 1.0}
											onChange={(v: number) => saveSettings({ iconOpacity: v })}
											min={0.1}
											max={1.0}
											step={0.05}
											format={(v: number) => `${Math.round(v * 100)}%`}
										/>
										<SettingSliderRow
											title="字体不透明度"
											desc="调整桌面图标文字的不透明度"
											value={settings.textOpacity ?? 1.0}
											onChange={(v: number) => saveSettings({ textOpacity: v })}
											min={0.1}
											max={1.0}
											step={0.05}
											format={(v: number) => `${Math.round(v * 100)}%`}
											noBorder
										/>
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
									关于 DeskZero
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
											一款现代化的 Windows 桌面整理工具，
											<br />
											为您提供毛玻璃质感、丝滑的拖拽动画与高效的分区收纳体验。
										</div>
									</div>
								</div>

								<div className="bg-white/80 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 px-6 py-2 shadow-sm backdrop-blur-xl">
									<SettingRow
										title="开发者"
										desc="DeskZero 作者及主要维护者"
										noBorder={false}
									>
										<span className="text-sm font-medium text-[var(--color-text)] px-2">
											LanRhyme
										</span>
									</SettingRow>

									<SettingRow
										title="开源许可"
										desc="查看 DeskZero 使用的第三方库及授权协议"
										noBorder={false}
									>
										<button
											onClick={() => setIsLicenseDialogOpen(true)}
											className="px-4 py-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-lg text-sm font-medium transition-colors outline-none cursor-pointer"
										>
											查看许可证
										</button>
									</SettingRow>

									<SettingRow
										title="开源仓库"
										desc="在 GitHub 上查看源码、提交问题或贡献代码"
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
											前往 GitHub
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
									第三方开源库授权
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
									{
										name: "React",
										license: "MIT License",
										desc: "A JavaScript library for building user interfaces",
									},
									{
										name: "Tauri",
										license: "Apache License 2.0 / MIT License",
										desc: "Build smaller, faster, and more secure desktop applications with a web frontend",
									},
									{
										name: "Tailwind CSS",
										license: "MIT License",
										desc: "A utility-first CSS framework for rapid UI development",
									},
									{
										name: "Framer Motion",
										license: "MIT License",
										desc: "Open source, production-ready animation and gesture library for React",
									},
									{
										name: "Zustand",
										license: "MIT License",
										desc: "A small, fast and scalable bearbones state-management solution",
									},
									{
										name: "Lucide React",
										license: "ISC License",
										desc: "Beautiful & consistent icons",
									},
									{
										name: "Headless UI",
										license: "MIT License",
										desc: "Completely unstyled, fully accessible UI components",
									},
									{
										name: "Rusqlite",
										license: "MIT License",
										desc: "Ergonomic bindings to SQLite for Rust",
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
								同步 Windows 桌面布局
							</h3>
							<p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-5">
								将根据当前 Windows 系统的图标位置和尺寸一键同步到 DeskZero。如果同步后您的图标显示偏大、偏小或产生了偏移，您可以在下方调节缩放倍数。
							</p>
							
							<div className="mb-6 bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-4">
								<div className="flex justify-between items-center mb-2">
									<span className="text-xs font-semibold text-[var(--color-text)]">
										图标网格同步倍数
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
									<span>0.50x (更小)</span>
									<span>1.00x (默认)</span>
									<span>2.00x (更大)</span>
								</div>
							</div>

							<div className="flex justify-end gap-3">
								<button
									onClick={() => setIsSyncModalOpen(false)}
									className="px-4 py-2 border border-black/10 dark:border-white/10 text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-xs font-medium transition-all"
								>
									取消
								</button>
								<button
									onClick={() => {
										setIsSyncModalOpen(false);
										handleSyncWindowsLayout(syncMultiplier);
									}}
									className="px-4 py-2 bg-[var(--color-accent)] text-white hover:bg-opacity-95 rounded-lg text-xs font-medium transition-all shadow-sm shadow-[var(--color-accent)]/20 active:scale-95"
								>
									确认同步
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
}

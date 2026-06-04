import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/utils/cn";

export interface MenuItem {
	label?: string;
	icon?: React.ReactNode;
	onClick?: (e?: React.MouseEvent) => void;
	disabled?: boolean;
	divider?: boolean;
	subItems?: MenuItem[];
}

interface ContextMenuProps {
	x: number;
	y: number;
	items: MenuItem[];
	onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const [activeSubMenu, setActiveSubMenu] = useState<number | null>(null);
	const { settings } = useSettingsStore();
	const { wallpaper } = useDesktopStore();

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [onClose]);

	// Simple boundary collision detection
	let adjustedX = x;
	let adjustedY = y;
	if (menuRef.current) {
		const rect = menuRef.current.getBoundingClientRect();
		if (x + rect.width > window.innerWidth)
			adjustedX = window.innerWidth - rect.width;
		if (y + rect.height > window.innerHeight)
			adjustedY = window.innerHeight - rect.height;
	}

	return (
		<AnimatePresence>
			<motion.div
				ref={menuRef}
				onContextMenu={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95 }}
				transition={{ duration: 0.1 }}
				className={cn(
					"fixed z-50 min-w-[160px] py-1 border shadow-2xl rounded-lg",
					settings.globalBlur === false
						? "bg-white dark:bg-[#1a1a1a] border-black/5 dark:border-white/10"
						: settings.wallpaperCompatible && wallpaper
							? "border-white/20 dark:border-white/10"
							: "bg-white/60 dark:bg-[#1a1a1a]/70 backdrop-blur-3xl border-white/20 dark:border-white/10",
				)}
				style={{ left: adjustedX, top: adjustedY }}
			>
				{settings.wallpaperCompatible &&
					settings.globalBlur !== false &&
					wallpaper && (
						<div
							className="absolute inset-0 pointer-events-none overflow-hidden"
							style={{ zIndex: -1, borderRadius: "inherit" }}
						>
							<div
								className="absolute inset-0"
								style={{
									backgroundImage: `url(${wallpaper})`,
									backgroundAttachment: "fixed",
									backgroundPosition: "top left",
									backgroundSize: "100vw 100vh",
									filter: "blur(20px)",
								}}
							/>
							<div className="absolute inset-0 bg-white/60 dark:bg-[#1a1a1a]/70" />
						</div>
					)}

				{items.map((item, index) => {
					if (item.divider) {
						return (
							<div
								key={index}
								className="h-px bg-black/5 dark:bg-white/10 my-1 mx-2"
							/>
						);
					}

					const hasSub = item.subItems && item.subItems.length > 0;
					const isActive = activeSubMenu === index;
					const showOnLeft = x > window.innerWidth / 2;

					return (
						<div
							key={index}
							className="relative"
							onPointerEnter={() => setActiveSubMenu(index)}
							onPointerLeave={() => {}}
						>
							<button
								onClick={(e) => {
									if (!item.disabled && !hasSub && item.onClick) {
										item.onClick(e);
										onClose();
									}
								}}
								disabled={item.disabled}
								className={cn(
									"w-full flex items-center justify-between px-3 py-1 text-xs text-left transition-colors",
									"hover:bg-black/5 dark:hover:bg-white/10",
									isActive && hasSub ? "bg-black/5 dark:bg-white/10" : "",
									item.disabled
										? "opacity-50 cursor-not-allowed text-gray-500 dark:text-gray-400"
										: "cursor-default text-gray-800 dark:text-gray-200",
								)}
							>
								<div className="flex items-center gap-2">
									{item.icon ? (
										<span className="w-3.5 h-3.5 flex items-center justify-center text-sm">
											{item.icon}
										</span>
									) : (
										<span className="w-3.5 h-3.5" />
									)}
									{item.label}
								</div>
								{hasSub && <ChevronRight size={14} className="opacity-60" />}
							</button>

							{/* Submenu rendering */}
							{hasSub && isActive && (
								<div
									className={cn(
										"absolute top-0 z-50",
										showOnLeft
											? "right-[calc(100%-4px)] pr-1"
											: "left-[calc(100%-4px)] pl-1",
									)}
								>
									<motion.div
										initial={{ opacity: 0, x: showOnLeft ? 5 : -5 }}
										animate={{ opacity: 1, x: 0 }}
										className={cn(
											"min-w-[160px] py-1 border shadow-2xl rounded-lg",
											settings.globalBlur === false
												? "bg-white dark:bg-[#1a1a1a] border-black/5 dark:border-white/10"
												: settings.wallpaperCompatible && wallpaper
													? "border-white/20 dark:border-white/10"
													: "bg-white/60 dark:bg-[#1a1a1a]/70 backdrop-blur-3xl border-white/20 dark:border-white/10",
										)}
									>
										{settings.wallpaperCompatible &&
											settings.globalBlur !== false &&
											wallpaper && (
												<div
													className="absolute inset-0 pointer-events-none overflow-hidden"
													style={{ zIndex: -1, borderRadius: "inherit" }}
												>
													<div
														className="absolute inset-0"
														style={{
															backgroundImage: `url(${wallpaper})`,
															backgroundAttachment: "fixed",
															backgroundPosition: "top left",
															backgroundSize: "100vw 100vh",
															filter: "blur(20px)",
														}}
													/>
													<div className="absolute inset-0 bg-white/60 dark:bg-[#1a1a1a]/70" />
												</div>
											)}

										{item.subItems!.map((subItem, subIndex) => {
											if (subItem.divider) {
												return (
													<div
														key={subIndex}
														className="h-px bg-black/5 dark:bg-white/10 my-1 mx-2"
													/>
												);
											}
											return (
												<button
													key={subIndex}
													onClick={(e) => {
														if (!subItem.disabled && subItem.onClick) {
															subItem.onClick(e);
															onClose();
														}
													}}
													disabled={subItem.disabled}
													className={cn(
														"w-full flex items-center gap-2 px-3 py-1 text-xs text-left transition-colors",
														"hover:bg-black/5 dark:hover:bg-white/10",
														subItem.disabled
															? "opacity-50 cursor-not-allowed text-gray-500 dark:text-gray-400"
															: "cursor-default text-gray-800 dark:text-gray-200",
													)}
												>
													{subItem.icon ? (
														<span className="w-3.5 h-3.5 flex items-center justify-center text-sm">
															{subItem.icon}
														</span>
													) : (
														<span className="w-3.5 h-3.5" />
													)}
													{subItem.label}
												</button>
											);
										})}
									</motion.div>
								</div>
							)}
						</div>
					);
				})}
			</motion.div>
		</AnimatePresence>
	);
}

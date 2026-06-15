import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import type { Settings } from "@/types/settings";
import { cn } from "@/utils/cn";

export interface SubMenuItem {
	label?: string;
	icon?: React.ReactNode;
	onClick?: (e?: React.MouseEvent) => void;
	disabled?: boolean;
	divider?: boolean;
}

interface SubMenuProps {
	items: SubMenuItem[];
	showOnLeft: boolean;
	onClose: () => void;
	settings: Settings;
	wallpaper: string | null;
	className?: string;
}

export function SubMenu({
	items,
	showOnLeft,
	onClose,
	settings,
	wallpaper,
	className,
}: SubMenuProps) {
	const subMenuRef = useRef<HTMLDivElement>(null);
	const [coords, setCoords] = useState<{ top: number; showOnLeft: boolean } | null>(null);

	useLayoutEffect(() => {
		if (subMenuRef.current) {
			const rect = subMenuRef.current.getBoundingClientRect();
			const padding = 10;

			// 1. 垂直防溢出：如果超出屏幕底部，则向上偏移
			let topOffset = 0;
			if (rect.bottom > window.innerHeight) {
				topOffset = window.innerHeight - rect.bottom - padding;
			}
			// 确保向上偏移后不会超出屏幕顶部
			if (rect.top + topOffset < padding) {
				topOffset = padding - rect.top;
			}

			// 2. 水平翻转：如果向外展开时超出屏幕水平边缘，则翻转展开方向
			let newShowOnLeft = showOnLeft;
			if (showOnLeft) {
				if (rect.left < padding) {
					newShowOnLeft = false;
				}
			} else {
				if (rect.right > window.innerWidth - padding) {
					newShowOnLeft = true;
				}
			}

			setCoords({ top: topOffset, showOnLeft: newShowOnLeft });
		}
	}, [showOnLeft, items]);

	const finalShowOnLeft = coords ? coords.showOnLeft : showOnLeft;

	return (
		<div
			className={cn(
				"absolute z-50",
				finalShowOnLeft
					? "right-full pr-1"
					: "left-full pl-1",
			)}
			style={{
				top: coords ? `${coords.top}px` : 0,
				visibility: coords ? "visible" : "hidden",
			}}
		>
			<motion.div
				ref={subMenuRef}
				initial={{ opacity: 0, x: finalShowOnLeft ? 5 : -5 }}
				animate={coords ? { opacity: 1, x: 0 } : { opacity: 0, x: finalShowOnLeft ? 5 : -5 }}
				transition={{ duration: 0.1 }}
				className={cn(
					"relative py-1 border shadow-2xl rounded-lg",
					settings.globalBlur === false
						? "bg-white dark:bg-[#1a1a1a] border-black/5 dark:border-white/10"
						: settings.wallpaperCompatible && wallpaper
							? "border-white/20 dark:border-white/10"
							: "bg-white/60 dark:bg-[#1a1a1a]/70 backdrop-blur-3xl border-white/20 dark:border-white/10",
					className,
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

				{items.map((subItem, subIndex) => {
					if (subItem.divider) {
						return (
							<div
								key={`divider-${subIndex}`}
								className="h-px bg-black/5 dark:bg-white/10 my-1 mx-2"
							/>
						);
					}
					return (
						<button
							key={subItem.label || `item-${subIndex}`}
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
	);
}

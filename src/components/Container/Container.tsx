import { motion } from "framer-motion";
import { Edit2, Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDrag } from "@/hooks/useDrag";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Container as ContainerType } from "@/types/container";
import { cn } from "@/utils/cn";
import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import type { MenuItem } from "@/components/ContextMenu/ContextMenu";
import { FileItem } from "../Item/FileItem";
import { ContainerSettings } from "./ContainerSettings";
import { FolderContainer } from "./FolderContainer";
import { GameContainer } from "./GameContainer";
import { IconShowContainer } from "./IconShowContainer";

interface ContainerProps {
	container: ContainerType;
}

export function Container({ container }: ContainerProps) {
	if (container.type === "game") {
		return <GameContainer container={container} />;
	}
	if (container.type === "folder") {
		return <FolderContainer container={container} />;
	}
	if (container.type === "iconShow") {
		return <IconShowContainer container={container} />;
	}
	return <NormalContainer container={container} />;
}

function NormalContainer({ container }: ContainerProps) {
	const { updateContainerPosition, updateContainerSize, deleteContainer, updateContainerName } = useContainerStore();
	const { settings } = useSettingsStore();
	const { wallpaper } = useDesktopStore();
	const dragHandleRef = useRef<HTMLDivElement>(null);

	const [resizePosOffset, setResizePosOffset] = useState({ x: 0, y: 0 });
	const resizeOffsetRef = useRef({ x: 0, y: 0 });
	const [settingsPos, setSettingsPos] = useState({ x: 0, y: 0 });
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isEditingName, setIsEditingName] = useState(false);
	const [editNameValue, setEditNameValue] = useState(container.name);
	const [menuState, setMenuState] = useState<{
		visible: boolean;
		x: number;
		y: number;
	}>({ visible: false, x: 0, y: 0 });

	const { ref, pos, isDragging, listeners } = useDrag(container.position, {
		dragHandleRef,
		onDragEnd: (newPos) => {
			// Free drag, no grid snapping for containers
			const safeX = Math.max(0, newPos.x);
			const safeY = Math.max(0, newPos.y);
			updateContainerPosition(container.id, { x: safeX, y: safeY });
		},
	});

	const [isScrolling, setIsScrolling] = useState(false);
	const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const thumbRef = useRef<HTMLDivElement>(null);

	const handleScroll = () => {
		setIsScrolling(true);

		if (scrollContainerRef.current && thumbRef.current) {
			const { scrollTop, scrollHeight, clientHeight } =
				scrollContainerRef.current;
			if (scrollHeight > clientHeight) {
				const scrollRatio = scrollTop / (scrollHeight - clientHeight);
				const thumbHeight = Math.max(
					(clientHeight / scrollHeight) * clientHeight,
					20,
				);
				const maxThumbTop = clientHeight - thumbHeight;
				thumbRef.current.style.height = `${thumbHeight}px`;
				thumbRef.current.style.transform = `translateY(${scrollRatio * maxThumbTop}px)`;
			}
		}

		if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
		scrollTimeoutRef.current = setTimeout(() => {
			setIsScrolling(false);
		}, 1000);
	};

	// Resize logic
	const [isResizing, setIsResizing] = useState(false);
	const [size, setSize] = useState(container.size);

	useEffect(() => {
		setSize(container.size);
	}, [container.size.width, container.size.height]);

	useEffect(() => {
		if (isSettingsOpen) {
			const popupWidth = 288;
			const popupHeight = 500;
			let x = pos.x + size.width + 10;
			if (x + popupWidth > window.innerWidth) {
				x = pos.x - popupWidth - 10;
				if (x < 0) x = 10;
			}
			let y = pos.y;
			if (y + popupHeight > window.innerHeight) {
				y = window.innerHeight - popupHeight - 10;
				if (y < 0) y = 10;
			}
			setSettingsPos({ x, y });
		}
	}, [isSettingsOpen, pos.x, pos.y, size.width, size.height]);

	useEffect(() => {
		setEditNameValue(container.name);
	}, [container.name]);

	const handleDelete = async () => {
		const { moveItemsToDesktop } = useDesktopStore.getState();
		await moveItemsToDesktop(container.items, container.position.x, container.position.y, true);
		await deleteContainer(container.id);
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuState({ visible: true, x: e.clientX, y: e.clientY });
	};

	const contextMenuItems: MenuItem[] = [
		{
			label: "重命名",
			icon: <Edit2 size={14} />,
			onClick: () => setIsEditingName(true),
		},
		{
			label: "设置",
			icon: <Settings size={14} />,
			onClick: () => setIsSettingsOpen(true),
		},
		{
			label: "移除",
			icon: <Trash2 size={14} />,
			onClick: handleDelete,
		},
	];

	const sizeRef = useRef(size);
	sizeRef.current = size;
	const commitResize = () => {
		updateContainerSize(container.id, {
			width: sizeRef.current.width,
			height: sizeRef.current.height,
		});
	};

	const handleResizePointerDown = (
		e: React.PointerEvent,
		direction: "br" | "bl",
	) => {
		e.stopPropagation();
		e.preventDefault();
		setIsResizing(true);
		const startX = e.clientX;
		const startY = e.clientY;
		const startWidth = size.width;
		const startHeight = size.height;
		const startPosX = pos.x;
		const startPosY = pos.y;

		const handlePointerMove = (moveEvent: PointerEvent) => {
			const deltaX = moveEvent.clientX - startX;
			const deltaY = moveEvent.clientY - startY;

			if (direction === "br") {
				const newWidth = Math.max(160, startWidth + deltaX);
				const newHeight = Math.max(120, startHeight + deltaY);
				setSize({ width: newWidth, height: newHeight });
			} else if (direction === "bl") {
				const newWidth = Math.max(160, startWidth - deltaX);
				const newHeight = Math.max(120, startHeight + deltaY);
				const possiblePosX = startPosX + deltaX;

				if (newWidth > 160 && possiblePosX >= 0) {
					setSize({ width: newWidth, height: newHeight });
					setResizePosOffset({ x: deltaX, y: 0 });
					resizeOffsetRef.current = { x: deltaX, y: 0 };
				}
			}
		};

		const handlePointerUp = () => {
			setIsResizing(false);
			if (direction === "bl") {
				const finalX = Math.max(0, startPosX + resizeOffsetRef.current.x);
				updateContainerPosition(container.id, { x: finalX, y: startPosY });
				setResizePosOffset({ x: 0, y: 0 });
				resizeOffsetRef.current = { x: 0, y: 0 };
			}
			commitResize();
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
	};

	// Determine text and icon colors based on container background for accessibility
	const isDarkBg =
		settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

	const bgOpacity = container.style.backgroundOpacity ?? 0.3;
	const customBackground =
		container.style.backgroundColor === "theme" ||
		!container.style.backgroundColor
			? `rgba(var(--color-container-bg-rgb), ${bgOpacity})`
			: container.style.backgroundColor.startsWith("#")
				? `rgba(${hexToRgb(container.style.backgroundColor)}, ${bgOpacity})`
				: container.style.backgroundColor;

	// Simple contrast check for header
	const isCustomBgDark =
		container.style.backgroundColor !== "theme" &&
		container.style.backgroundColor &&
		container.style.backgroundColor.startsWith("#")
			? isColorDark(container.style.backgroundColor)
			: isDarkBg;

	const headerColor = isCustomBgDark ? "#ffffff" : "#1f2937";
	const textShadow = isCustomBgDark
		? "0 1px 2px rgba(0,0,0,0.5)"
		: "0 1px 1px rgba(255,255,255,0.5)";

	// Layout style class
	const layoutStyle =
		container.style.layout === "list"
			? "flex-col items-stretch"
			: "flex-row flex-wrap content-start";

	const cornerRadius = container.style.cornerRadius ?? 10;

	return (
		<>
			<motion.div
				ref={ref}
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					x: pos.x + resizePosOffset.x,
					y: pos.y + resizePosOffset.y,
					width: size.width,
					height: size.height,
					borderRadius: cornerRadius,
					zIndex: isDragging || isResizing ? 40 : 10,
					backgroundColor:
						settings.wallpaperCompatible && settings.globalBlur && wallpaper
							? "transparent"
							: customBackground,
					backdropFilter:
						!settings.wallpaperCompatible && settings.globalBlur
							? "var(--backdrop-blur)"
							: "none",
					WebkitBackdropFilter:
						!settings.wallpaperCompatible && settings.globalBlur
							? "var(--backdrop-blur)"
							: "none",
				}}
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: isDragging ? 0.9 : 1, scale: 1 }}
				className={cn(
					"flex flex-col overflow-hidden transition-colors border shadow-xl select-none relative",
					"border-[var(--color-border)]",
					isDragging && "shadow-2xl ring-1 ring-black/10 dark:ring-white/10",
				)}
				onContextMenu={handleContextMenu}
			>
				{/* Fake Blur Layer for Dynamic Wallpaper Mode */}
				{settings.wallpaperCompatible && settings.globalBlur && wallpaper && (
					<div
						className="absolute inset-0 pointer-events-none overflow-hidden"
						style={{ zIndex: -1, borderRadius: "inherit" }}
					>
						<div
							className="absolute inset-0"
							style={{
								backgroundImage: `url(${wallpaper})`,
								backgroundPosition: `calc(0px - ${pos.x + resizePosOffset.x}px) calc(0px - ${pos.y + resizePosOffset.y}px)`,
								backgroundSize: "100vw 100vh",
								filter: "blur(20px)",
							}}
						/>
						<div
							className="absolute inset-0"
							style={{ backgroundColor: customBackground }}
						/>
					</div>
				)}

				{/* Header (Draggable Area) - optimized height and colors */}
				{container.style.showHeader !== false && (
					<div
						ref={dragHandleRef}
						{...listeners}
						className="flex items-center justify-center px-2 py-1 transition-colors cursor-move touch-none relative min-h-[24px]"
						style={{ backgroundColor: "transparent" }} // Inherits inner color
					>
						{isEditingName ? (
							<input
								autoFocus
								className="bg-white/50 dark:bg-black/50 text-[var(--color-text)] px-1 outline-none rounded text-xs font-medium text-center w-32 relative z-10"
								style={{ color: headerColor }}
								value={editNameValue}
								onChange={(e) => setEditNameValue(e.target.value)}
								onBlur={() => {
									setIsEditingName(false);
									updateContainerName(container.id, editNameValue.trim());
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										setIsEditingName(false);
										updateContainerName(container.id, editNameValue.trim());
									} else if (e.key === "Escape") {
										setIsEditingName(false);
										setEditNameValue(container.name);
									}
								}}
								onPointerDown={(e) => e.stopPropagation()}
							/>
						) : (
							<div
								className="cursor-pointer max-w-[80%] truncate text-xs font-medium transition-colors"
								style={{
									color: headerColor,
									textShadow,
									opacity: settings.textOpacity ?? 1.0,
								}}
								onDoubleClick={(e) => {
									e.stopPropagation();
									setIsEditingName(true);
								}}
							>
								{container.name}
							</div>
						)}
					</div>
				)}

				{/* Body - Relative for free layout */}
				<div className="relative flex-1 overflow-hidden">
					<motion.div
						layoutScroll
						ref={scrollContainerRef}
						onScroll={handleScroll}
						className={cn(
							"w-full h-full p-2 flex gap-1 overflow-y-auto relative hidden-native-scrollbar",
							layoutStyle,
						)}
					>
						{container.items.map((item) => (
							<FileItem
								key={item.id}
								item={item}
								containerStyle={container.style}
							/>
						))}
						{container.items.length === 0 && (
							<div className="w-full h-full flex items-center justify-center text-sm text-[var(--color-text-secondary)] opacity-50 pointer-events-none">
								Drag items here
							</div>
						)}
					</motion.div>

					{/* Custom Animated Scrollbar Thumb */}
					<div
						ref={thumbRef}
						className={cn(
							"absolute top-0 right-1 w-1.5 bg-black/20 dark:bg-white/20 rounded-full pointer-events-none",
							"transition-opacity duration-300 ease-in-out",
							isScrolling ? "opacity-100" : "opacity-0",
						)}
					/>
				</div>

				{/* Resize Handle (Bottom Left) */}
				<div
					className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 opacity-0 hover:opacity-100 transition-opacity"
					onPointerDown={(e) => handleResizePointerDown(e, "bl")}
				>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						stroke="currentColor"
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-[var(--color-text-secondary)] transform -scale-x-100"
					>
						<polyline points="22 12 22 22 12 22"></polyline>
						<line x1="22" y1="22" x2="12" y2="12"></line>
					</svg>
				</div>

				{/* Resize Handle (Bottom Right) */}
				<div
					className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 opacity-0 hover:opacity-100 transition-opacity"
					onPointerDown={(e) => handleResizePointerDown(e, "br")}
				>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						stroke="currentColor"
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-[var(--color-text-secondary)]"
					>
						<polyline points="22 12 22 22 12 22"></polyline>
						<line x1="22" y1="22" x2="12" y2="12"></line>
					</svg>
				</div>
			</motion.div>

			{menuState.visible && (
				<ContextMenu
					x={menuState.x}
					y={menuState.y}
					items={contextMenuItems}
					onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
				/>
			)}

			{isSettingsOpen &&
				createPortal(
					<motion.div
						className="fixed z-[100] pointer-events-auto"
						style={{
							left: settingsPos.x,
							top: settingsPos.y,
							width: 288,
						}}
						onPointerDown={(e) => e.stopPropagation()}
					>
						<ContainerSettings
							container={container}
							onClose={() => setIsSettingsOpen(false)}
						/>
					</motion.div>,
					document.body,
				)}
		</>
	);
}

// Helpers
function isColorDark(hex: string) {
	let c = hex.substring(1).split("");
	if (c.length === 3) {
		c = [c[0], c[0], c[1], c[1], c[2], c[2]];
	}
	const cNum = Number("0x" + c.join(""));
	const r = (cNum >> 16) & 255;
	const g = (cNum >> 8) & 255;
	const b = cNum & 255;
	const brightness = (r * 299 + g * 587 + b * 114) / 1000;
	return brightness < 128;
}

function hexToRgb(hex: string) {
	let c = hex.substring(1).split("");
	if (c.length === 3) {
		c = [c[0], c[0], c[1], c[1], c[2], c[2]];
	}
	const cNum = Number("0x" + c.join(""));
	return [(cNum >> 16) & 255, (cNum >> 8) & 255, cNum & 255].join(",");
}

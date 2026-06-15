import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { Copy, Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	ContextMenu,
	type MenuItem,
} from "@/components/ContextMenu/ContextMenu";
import { useDrag } from "@/hooks/useDrag";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Container as ContainerType } from "@/types/container";
import { cn } from "@/utils/cn";
import { GameContainerSettings } from "./GameContainerSettings";

interface GameContainerProps {
	container: ContainerType;
}

export function GameContainer({ container }: GameContainerProps) {
	const { updateContainerPosition, updateContainerSize, deleteContainer } =
		useContainerStore();

	const { settings } = useSettingsStore();

	const [resizePosOffset, setResizePosOffset] = useState({ x: 0, y: 0 });
	const [menuState, setMenuState] = useState<{
		visible: boolean;
		x: number;
		y: number;
	}>({ visible: false, x: 0, y: 0 });
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [settingsPos, setSettingsPos] = useState({ x: 0, y: 0 });

	// Default size 1x2 grids
	const defaultWidth = settings.gridWidth || 80;
	const defaultHeight =
		(settings.gridHeight || 104) * 2 + (settings.gridGapY ?? 20);

	const width =
		container.size.width === 200 && container.size.height === 300
			? defaultWidth
			: container.size.width;
	const height =
		container.size.width === 200 && container.size.height === 300
			? defaultHeight
			: container.size.height;

	useEffect(() => {
		if (container.size.width === 200 && container.size.height === 300) {
			updateContainerSize(container.id, {
				width: defaultWidth,
				height: defaultHeight,
			});
		}
	}, [
		container.id,
		container.size.width,
		container.size.height,
		defaultWidth,
		defaultHeight,
		updateContainerSize,
	]);

	const { ref, pos, isDragging, listeners } = useDrag(container.position, {
		onDragEnd: (newPos) => {
			// Snap to grid for GameContainer
			const gw = settings.gridWidth || 80;
			const gh = settings.gridHeight || 104;
			const gx = settings.gridGapX ?? 20;
			const gy = settings.gridGapY ?? 20;
			const stepX = gw + gx;
			const stepY = gh + gy;

			const snapX = Math.round(Math.max(0, newPos.x - 10) / stepX) * stepX + 10;
			const snapY = Math.round(Math.max(0, newPos.y - 10) / stepY) * stepY + 10;

			updateContainerPosition(container.id, { x: snapX, y: snapY });
		},
	});

	// Resize logic
	const [isResizing, setIsResizing] = useState(false);
	const [size, setSize] = useState({ width, height });

	useEffect(() => {
		setSize({ width, height });
	}, [width, height]);

	// Calculate dynamic position for settings modal to prevent overflow
	useEffect(() => {
		if (isSettingsOpen) {
			const popupWidth = 288;
			const popupHeight = 400; // approx height for GameContainerSettings
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
	}, [isSettingsOpen, pos.x, pos.y, size.width]);

	const sizeRef = useRef(size);
	sizeRef.current = size;
	const commitResize = () => {
		// Snap to grid sizes
		const gw = settings.gridWidth || 80;
		const gh = settings.gridHeight || 104;
		const gx = settings.gridGapX ?? 20;
		const gy = settings.gridGapY ?? 20;
		const stepX = gw + gx;
		const stepY = gh + gy;

		const snapW =
			Math.max(1, Math.round((sizeRef.current.width + gx) / stepX)) * stepX -
			gx;
		const snapH =
			Math.max(1, Math.round((sizeRef.current.height + gy) / stepY)) * stepY -
			gy;

		updateContainerSize(container.id, { width: snapW, height: snapH });
	};

	const handleResizePointerDown = (
		e: React.PointerEvent,
		direction: "br" | "bl",
	) => {
		e.stopPropagation();
		setIsResizing(true);
		const startX = e.clientX;
		const startY = e.clientY;
		const startWidth = sizeRef.current.width;
		const startHeight = sizeRef.current.height;

		const handlePointerMove = (moveEvent: PointerEvent) => {
			const deltaX = moveEvent.clientX - startX;
			const deltaY = moveEvent.clientY - startY;

			let newWidth = startWidth;
			let offsetX = 0;

			if (direction === "br") {
				newWidth = Math.max(80, startWidth + deltaX);
			} else if (direction === "bl") {
				newWidth = Math.max(80, startWidth - deltaX);
				if (startWidth - deltaX >= 80) {
					offsetX = deltaX;
				} else {
					offsetX = startWidth - 80;
				}
			}

			const newHeight = Math.max(96, startHeight + deltaY);
			setSize({ width: newWidth, height: newHeight });

			if (direction === "bl") {
				setResizePosOffset({ x: offsetX, y: 0 });
			}
		};

		const handlePointerUp = () => {
			setIsResizing(false);
			commitResize();

			let finalOffsetX = 0;
			setResizePosOffset((prev) => {
				finalOffsetX = prev.x;
				return { x: 0, y: 0 };
			});

			if (finalOffsetX !== 0) {
				// Snap pos
				const gw = settings.gridWidth || 80;
				const gx = settings.gridGapX ?? 20;
				const stepX = gw + gx;
				const snapX =
					Math.round(Math.max(0, pos.x + finalOffsetX - 10) / stepX) * stepX +
					10;
				updateContainerPosition(container.id, { x: snapX, y: pos.y });
			}

			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuState({ visible: true, x: e.clientX, y: e.clientY });
	};

	const contextMenuItems: MenuItem[] = [
		{
			label: "设置",
			icon: <Settings size={14} />,
			onClick: () => setIsSettingsOpen(true),
		},
		{
			label: "移除",
			icon: <Trash2 size={14} />,
			onClick: async () => {
				const { moveItemsToDesktop } = useDesktopStore.getState();
				await moveItemsToDesktop(container.items, pos.x, pos.y, true);
				await deleteContainer(container.id);
			},
		},
		{
			label: "复制",
			icon: <Copy size={14} />,
			onClick: async () => {
				const newContainer = await useContainerStore
					.getState()
					.createContainer(container.name + " 副本", "game", {
						x: pos.x + 20,
						y: pos.y + 20,
					});
				useContainerStore
					.getState()
					.updateContainerSize(newContainer.id, container.size);
				useContainerStore
					.getState()
					.updateContainerStyle(newContainer.id, container.style);
			},
		},
	];

	const bgOpacity = container.style.backgroundOpacity === 0.3 ? 1 : (container.style.backgroundOpacity ?? 1);
	const cornerRadius = container.style.cornerRadius ?? 16;
	const glow = settings.iconGlow !== false;

	const coverImage = container.style.coverImage;

	return (
		<>
			<motion.div
				ref={ref}
				{...listeners}
				whileHover={{ scale: 1.02 }}
				whileTap={{ scale: 0.98 }}
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: size.width,
					height: size.height,
					zIndex: isDragging || isResizing ? 40 : 10,
					opacity: bgOpacity,
				}}
				initial={{ opacity: 0, scale: 0.95, x: pos.x, y: pos.y }}
				animate={{ opacity: isDragging ? 0.9 : bgOpacity, scale: 1, x: pos.x + resizePosOffset.x, y: pos.y + resizePosOffset.y }}
				transition={isDragging || isResizing ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
				className={cn(
					"flex flex-col transition-shadow select-none relative bg-transparent",
					isDragging && "shadow-2xl ring-2 ring-[var(--color-accent)]/50",
				)}
				onContextMenu={handleContextMenu}
				onDoubleClick={() => {
					if (container.items.length > 0) {
						invoke("open_file", { path: container.items[0].path });
					}
				}}
			>
				{/* Glow Layer */}
				{glow && (
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							filter: `blur(${settings.iconGlowRadius ?? 12}px)`,
							opacity: settings.iconGlowIntensity ?? 0.6,
							transform: "scale(1.05)",
							zIndex: -1,
							borderRadius: cornerRadius,
						}}
					>
						{coverImage ? (
							<img
								src={coverImage}
								className="w-full h-full object-cover rounded-[inherit]"
							/>
						) : container.items.length > 0 ? (
							(() => {
								const item = container.items[0];
								const isBase64 =
									item.iconPath?.startsWith("data:image") ||
									item.iconPath?.endsWith(".svg") ||
									item.iconPath?.endsWith(".png") ||
									item.iconPath?.endsWith(".jpg") ||
									item.iconPath?.endsWith(".ico");
								const imgSrc = isBase64
									? item.iconPath
									: `asset://${item.iconPath}`;
								return (
									<div className="w-full h-full bg-black/50 dark:bg-black/50 rounded-[inherit] flex items-center justify-center p-4">
										<img
											src={imgSrc}
											className="w-full h-full object-contain opacity-50 blur-md"
										/>
									</div>
								);
							})()
						) : (
							<div className="w-full h-full bg-black/50 dark:bg-black/50 rounded-[inherit]" />
						)}
					</div>
				)}

				{/* Inner Content Layer */}
				<div
					className="absolute inset-0 overflow-hidden pointer-events-none"
					style={{ borderRadius: cornerRadius }}
				>
					<div className="absolute inset-0 bg-black/50 dark:bg-black/50" />
					{coverImage ? (
						<img
							src={coverImage}
							alt={container.name}
							className="absolute inset-0 w-full h-full object-cover select-none"
						/>
					) : container.items.length > 0 ? (
						(() => {
							const item = container.items[0];
							const isBase64 =
								item.iconPath?.startsWith("data:image") ||
								item.iconPath?.endsWith(".svg") ||
								item.iconPath?.endsWith(".png") ||
								item.iconPath?.endsWith(".jpg") ||
								item.iconPath?.endsWith(".ico");
							const imgSrc = isBase64
								? item.iconPath
								: `asset://${item.iconPath}`;
							return (
								<div className="absolute inset-0 flex items-center justify-center p-4">
									<img
										src={imgSrc}
										alt={item.name}
										className="w-20 h-20 object-contain drop-shadow-2xl"
										draggable={false}
									/>
								</div>
							);
						})()
					) : (
						<div className="absolute inset-0 flex items-center justify-center select-none text-white/50 flex-col">
							<span className="text-3xl mb-2">+</span>
							<span className="text-xs">拖入游戏快捷方式</span>
						</div>
					)}
				</div>

				{/* Resize Handle (Bottom Left) */}
				<div
					className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 opacity-0 hover:opacity-100 transition-opacity"
					onPointerDown={(e) => handleResizePointerDown(e, "bl")}
				/>

				{/* Resize Handle (Bottom Right) */}
				<div
					className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 opacity-0 hover:opacity-100 transition-opacity"
					onPointerDown={(e) => handleResizePointerDown(e, "br")}
				/>
			</motion.div>

			{/* Settings Modal - absolute positioned over the container without blocking the whole screen */}
			{isSettingsOpen &&
				createPortal(
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="fixed z-[100] bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 p-4 rounded-xl shadow-2xl w-72 pointer-events-auto"
						style={{
							left: settingsPos.x,
							top: settingsPos.y,
							width: 288,
						}}
						onPointerDown={(e) => e.stopPropagation()}
					>
						<div className="flex justify-between items-center mb-4">
							<h3 className="font-bold text-[var(--color-text)]">
								游戏容器设置
							</h3>
							<button
								onClick={() => setIsSettingsOpen(false)}
								className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
							>
								x
							</button>
						</div>
						<GameContainerSettings
							container={container}
							onClose={() => setIsSettingsOpen(false)}
						/>
					</motion.div>,
					document.body,
				)}

			{menuState.visible && (
				<ContextMenu
					x={menuState.x}
					y={menuState.y}
					items={contextMenuItems}
					onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
				/>
			)}
		</>
	);
}

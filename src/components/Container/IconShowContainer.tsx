import { motion } from "framer-motion";
import { Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDrag } from "@/hooks/useDrag";
import { ConfirmDialog } from "@/components/UI/ConfirmDialog";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Container as ContainerType } from "@/types/container";
import { cn } from "@/utils/cn";
import { FileItem } from "../Item/FileItem";
import { IconShowSettings } from "./IconShowSettings";
import { ContextMenu } from "../ContextMenu/ContextMenu";
import type { MenuItem } from "../ContextMenu/ContextMenu";
import { hexToRgb } from "@/utils/color";
import { snapPosition, snapSize } from "@/utils/grid";

interface IconShowContainerProps {
	container: ContainerType;
}

export function IconShowContainer({ container }: IconShowContainerProps) {
	const { updateContainerPosition, updateContainerSize, deleteContainer } = useContainerStore();
	const { settings } = useSettingsStore();
	const { wallpaper } = useDesktopStore();

	const [size, setSize] = useState(container.size);
	const [resizePosOffset, setResizePosOffset] = useState({ x: 0, y: 0 });
	const resizeOffsetRef = useRef({ x: 0, y: 0 });
	const [isResizing, setIsResizing] = useState(false);

	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [settingsPos, setSettingsPos] = useState({ x: 0, y: 0 });

	const [menuState, setMenuState] = useState<{
		visible: boolean;
		x: number;
		y: number;
	}>({ visible: false, x: 0, y: 0 });


	// Position Dragging with snapping
	const { ref, pos, isDragging, listeners } = useDrag(container.position, {
		onDragEnd: (newPos) => {
			const snapped = snapPosition(newPos.x, newPos.y);
			updateContainerPosition(container.id, snapped);
		},
	});

	useEffect(() => {
		setSize(container.size);
	}, [container.size.width, container.size.height]);

	useEffect(() => {
		if (isSettingsOpen) {
			const popupWidth = 288;
			const popupHeight = 460;
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

	// Size Resizing with snapping
	const sizeRef = useRef(size);
	sizeRef.current = size;

	const handleResizePointerDown = (e: React.PointerEvent, direction: "br" | "bl") => {
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
				const newWidth = Math.max(100, startWidth + deltaX);
				const newHeight = Math.max(100, startHeight + deltaY);
				setSize({ width: newWidth, height: newHeight });
			} else if (direction === "bl") {
				const newWidth = Math.max(100, startWidth - deltaX);
				const newHeight = Math.max(100, startHeight + deltaY);
				const possiblePosX = startPosX + deltaX;

				let targetWidth = startWidth - resizeOffsetRef.current.x;
				let targetXOffset = resizeOffsetRef.current.x;

				if (newWidth > 100 && possiblePosX >= 0) {
					targetWidth = newWidth;
					targetXOffset = deltaX;
				}

				setSize({ width: targetWidth, height: newHeight });
				setResizePosOffset({ x: targetXOffset, y: 0 });
				resizeOffsetRef.current = { x: targetXOffset, y: 0 };
			}
		};

		const handlePointerUp = () => {
			setIsResizing(false);
			const snappedSize = snapSize(sizeRef.current.width, sizeRef.current.height);
			updateContainerSize(container.id, snappedSize);

			if (direction === "bl") {
				const rawX = startPosX + resizeOffsetRef.current.x;
				const finalPos = snapPosition(rawX, startPosY);
				updateContainerPosition(container.id, { x: finalPos.x, y: startPosY });
			}
			setResizePosOffset({ x: 0, y: 0 });
			resizeOffsetRef.current = { x: 0, y: 0 };

			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
	};

	const handleDelete = async () => {
		const { moveItemsToDesktop } = useDesktopStore.getState();
		await moveItemsToDesktop(container.items, container.position.x, container.position.y, true);
		await deleteContainer(container.id);
	};

	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const handleContainerContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuState({ visible: true, x: e.clientX, y: e.clientY });
	};

	const handleItemContextMenu = (e: React.MouseEvent, itemId: string) => {
		e.preventDefault();
		e.stopPropagation();

		const activeItem = container.items.find((i) => i.id === itemId);
		if (activeItem) {
			const p = activeItem.path.replace(/\//g, "\\");
			window.dispatchEvent(
				new CustomEvent("show-item-context-menu", {
					detail: {
						paths: [p],
						x: e.clientX,
						y: e.clientY,
					},
				}),
			);
		}
	};

	// Styles
	const cornerRadius = container.style.cornerRadius ?? 10;
	const bgOpacity = container.style.backgroundOpacity ?? 0.3;
	const customBackground =
		container.style.backgroundColor === "theme" || !container.style.backgroundColor
			? `rgba(var(--color-container-bg-rgb), ${bgOpacity})`
			: container.style.backgroundColor.startsWith("#")
				? `rgba(${hexToRgb(container.style.backgroundColor)}, ${bgOpacity})`
				: container.style.backgroundColor;

	// CSS mask feathering
	const maskParts: string[] = [];
	const featherX = container.style.featherX ?? 0;
	const featherY = container.style.featherY ?? 0;
	if (featherX > 0) {
		maskParts.push(`linear-gradient(to right, transparent 0px, black ${featherX}px, black calc(100% - ${featherX}px), transparent 100%)`);
	}
	if (featherY > 0) {
		maskParts.push(`linear-gradient(to bottom, transparent 0px, black ${featherY}px, black calc(100% - ${featherY}px), transparent 100%)`);
	}
	const maskStyle = maskParts.length > 0 ? {
		WebkitMaskImage: maskParts.join(", "),
		maskImage: maskParts.join(", "),
		WebkitMaskComposite: maskParts.length > 1 ? "source-in" : undefined,
		maskComposite: maskParts.length > 1 ? "intersect" : undefined,
	} as React.CSSProperties : {};

	// Build context menu items（仅用于容器背景右键）
	const getContextMenuItems = (): MenuItem[] => {
		return [
			{
				label: "设置",
				icon: <Settings size={14} />,
				onClick: () => setIsSettingsOpen(true),
			},
		{
			label: "移除",
			icon: <Trash2 size={14} />,
			onClick: () => setShowDeleteConfirm(true),
		},
		];
	};

	const contextItems = getContextMenuItems();

	return (
		<>
			<motion.div
				ref={ref}
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: size.width,
					height: size.height,
					borderRadius: cornerRadius,
					zIndex: isDragging || isResizing ? 40 : 10,
					backgroundColor: settings.wallpaperCompatible && settings.globalBlur && wallpaper ? "transparent" : customBackground,
					backdropFilter: !settings.wallpaperCompatible && settings.globalBlur ? "var(--backdrop-blur)" : "none",
					WebkitBackdropFilter: !settings.wallpaperCompatible && settings.globalBlur ? "var(--backdrop-blur)" : "none",
					...maskStyle,
				}}
				initial={{ opacity: 0, scale: 0.95, x: pos.x, y: pos.y }}
				animate={{ opacity: isDragging ? 0.9 : 1, scale: 1, x: pos.x + resizePosOffset.x, y: pos.y + resizePosOffset.y }}
				transition={isDragging || isResizing ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
				className={cn(
					"flex flex-col overflow-hidden transition-colors border shadow-xl select-none touch-none relative",
					"border-[var(--color-border)]",
					isDragging && "shadow-2xl ring-1 ring-black/10 dark:ring-white/10",
				)}
				onContextMenu={handleContainerContextMenu}
				{...listeners}
			>
				{/* Fake Blur Layer */}
				{settings.wallpaperCompatible && settings.globalBlur && wallpaper && (
					<div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1, borderRadius: "inherit" }}>
						<div
							className="absolute inset-0"
							style={{
								backgroundImage: `url(${wallpaper})`,
								backgroundPosition: `calc(0px - ${pos.x + resizePosOffset.x}px) calc(0px - ${pos.y + resizePosOffset.y}px)`,
								backgroundSize: "100vw 100vh",
								filter: "blur(20px)",
							}}
						/>
						<div className="absolute inset-0" style={{ backgroundColor: customBackground }} />
					</div>
				)}

				{/* Body - Flex Grid with space-evenly auto layout */}
				<div className="relative flex-1 w-full h-full p-2 z-10 overflow-hidden" style={maskStyle}>
					<div
						className="w-full h-full flex flex-row flex-wrap justify-evenly items-center content-evenly overflow-hidden relative"
						style={{
							justifyContent: "unsafe space-evenly",
							alignContent: "unsafe space-evenly",
							alignItems: "unsafe center",
							gap: `${12 * (container.style.iconGapRatio ?? 1.0)}px`,
						}}
					>
						{container.items.map((item) => {
							const insideIconSize = container.style.iconSizeInside ?? 64;
							const wrapperHeight = insideIconSize + (container.style.showNamesInside ? 24 : 0);
							
							// 容器最大可用尺寸减去 padding
							const padding = 16;
							const maxWidth = Math.max(10, size.width - padding);
							const maxHeight = Math.max(10, size.height - padding);
							
							// 包裹层限制宽度和高度，绝不溢出可用区
							const itemWidth = Math.min(insideIconSize, maxWidth);
							const itemHeight = Math.min(wrapperHeight, maxHeight);
							
							return (
								<div
									key={item.id}
									style={{
										width: itemWidth,
										height: itemHeight,
										opacity: container.style.iconOpacityInside ?? 1.0,
									}}
									onContextMenu={(e) => handleItemContextMenu(e, item.id)}
									className="relative flex items-center justify-center shrink-0 cursor-default"
								>
									<FileItem
										item={item}
										isIconShow={true}
										hoverAnimation={container.style.hoverAnimation}
										containerStyle={{
											...container.style,
											gridWidth: insideIconSize,
											gridHeight: insideIconSize + (container.style.showNamesInside ? 20 : 0),
											hideAppNames: !container.style.showNamesInside,
										}}
										onContextMenu={(e) => handleItemContextMenu(e, item.id)}
									/>
								</div>
							);
						})}
						{container.items.length === 0 && (
							<div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-secondary)] opacity-50 pointer-events-none text-center px-4">
								拖拽图标至此
							</div>
						)}
					</div>
				</div>

				{/* Resize Handle (Bottom Left) */}
				<div className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 opacity-0 hover:opacity-100 transition-opacity" onPointerDown={(e) => handleResizePointerDown(e, "bl")}>
					<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)] transform -scale-x-100">
						<polyline points="22 12 22 22 12 22"></polyline>
						<line x1="22" y1="22" x2="12" y2="12"></line>
					</svg>
				</div>

				{/* Resize Handle (Bottom Right) */}
				<div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 opacity-0 hover:opacity-100 transition-opacity" onPointerDown={(e) => handleResizePointerDown(e, "br")}>
					<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
						<polyline points="22 12 22 22 12 22"></polyline>
						<line x1="22" y1="22" x2="12" y2="12"></line>
					</svg>
				</div>
			</motion.div>

			{menuState.visible && contextItems.length > 0 && (
				<ContextMenu
					x={menuState.x}
					y={menuState.y}
					items={contextItems}
					onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
				/>
			)}

			{isSettingsOpen &&
				createPortal(
					<div
						className="fixed inset-0 z-[99] settings-backdrop"
						onPointerDown={(e) => e.stopPropagation()}
						onClick={(e) => e.stopPropagation()}
					>
						<motion.div
							className="fixed z-[100] pointer-events-auto"
							style={{
								left: settingsPos.x,
								top: settingsPos.y,
								width: 288,
							}}
						>
							<IconShowSettings container={container} onClose={() => setIsSettingsOpen(false)} />
						</motion.div>
					</div>,
					document.body,
				)}
			<ConfirmDialog
				isOpen={showDeleteConfirm}
				title="移除图标展示容器"
				message={`确定要移除「${container.name}」吗？容器内的图标将回到桌面。`}
				confirmLabel="移除"
				onConfirm={async () => {
					setShowDeleteConfirm(false);
					await handleDelete();
				}}
				onCancel={() => setShowDeleteConfirm(false)}
			/>
		</>
	);
}

import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { motion } from "framer-motion";
import {
	File,
	Folder,
	Link,
	Monitor,
	Network,
	Settings,
	Trash2,
	User,
} from "lucide-react";
import { useDrag } from "@/hooks/useDrag";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ContainerStyle } from "@/types/container";
import type { Item } from "@/types/item";
import { cn } from "@/utils/cn";

interface FileItemProps {
	item: Item & { position?: { x: number; y: number } };
	className?: string;
	containerStyle?: ContainerStyle;
	onClick?: (e: React.MouseEvent) => void;
	onDoubleClick?: (e: React.MouseEvent) => void;
	onContextMenu?: (e: React.MouseEvent) => void;
}

export function FileItem({
	item,
	className,
	containerStyle,
	onClick,
	onDoubleClick,
	onContextMenu,
}: FileItemProps) {
	const {
		selectedIds,
		toggleSelection,
		setSelection,
		moveSelectedItems,
		wallpaper,
		dragOffset,
	} = useDesktopStore();
	const { settings } = useSettingsStore();

	// Get container specific settings if inside a container
	let cWidth = settings.gridWidth;
	let cHeight = settings.gridHeight;
	let cGapX = settings.gridGapX ?? 20;
	let cGapY = settings.gridGapY ?? 20;
	let isListView = false;
	let showDetails = false;
	let hideAppNames = false;

	if (item.isInContainer && containerStyle) {
		cWidth = containerStyle.gridWidth || settings.gridWidth;
		cHeight = containerStyle.gridHeight || settings.gridHeight;
		cGapX = containerStyle.gridGapX ?? settings.gridGapX ?? 20;
		cGapY = containerStyle.gridGapY ?? settings.gridGapY ?? 20;
		isListView = containerStyle.layout === "list";
		if (isListView) {
			cHeight = containerStyle.listHeight ?? 30;
		}
		showDetails = containerStyle.showDetails ?? false;
		hideAppNames = containerStyle.hideAppNames ?? false;
	}

	const isSelected = selectedIds.has(item.id);
	const initialPos = item.isInContainer
		? { x: 0, y: 0 }
		: item.position || { x: 0, y: 0 };

	let iconPath = item.iconPath || "";
	if (iconPath.startsWith("http")) {
		iconPath = "";
	}
	iconPath = iconPath.replace(/^file:\/\/\//, "");

	let currentSelectedIds = selectedIds;
	if (!isSelected) {
		currentSelectedIds = new Set([item.id]);
	}

	const paths = Array.from(currentSelectedIds)
		.map((id) => {
			const dItem = useDesktopStore.getState().items.find((i) => i.id === id);
			if (dItem) return dItem.path;
			// If not in desktop store, it might be in container store
			for (const c of useContainerStore.getState().containers) {
				const cItem = c.items.find((i) => i.id === id);
				if (cItem) return cItem.path;
			}
			return null;
		})
		.filter(Boolean) as string[];

	if (paths.length === 0) paths.push(item.path);

	const normalizedPaths = paths.map((p) => p.replace(/\//g, "\\"));
	const normalizedIcon = iconPath.replace(/\//g, "\\");

	const { ref, pos, isDragging, listeners } = useDrag(initialPos, {
		disabled: false,
		clampToBounds: !item.isInContainer,
		nativeDragItemPaths: normalizedPaths,
		nativeDragIconPath: normalizedIcon,
		onDragStart: () => {
			if (!isSelected) {
				setSelection([item.id]);
			}
		},
		onDrag: (dx, dy) => {
			if (useDesktopStore.getState().selectedIds.has(item.id)) {
				if (dx === 0 && dy === 0) {
					useDesktopStore.getState().setDragOffset(null);
				} else {
					useDesktopStore.getState().setDragOffset({ dx, dy });
				}
			}
		},
		onDragEnd: (newPos, clientX, clientY) => {
			useDesktopStore.getState().setDragOffset(null);
			// Use clientX/clientY for accurate absolute screen position hit testing
			if (!item.isInContainer) {
				// Desktop -> Container check
				const containers = useContainerStore.getState().containers;
				const targetContainer = containers.find(
					(c) =>
						clientX >= c.position.x &&
						clientX <= c.position.x + c.size.width &&
						clientY >= c.position.y &&
						clientY <= c.position.y + c.size.height,
				);

				if (targetContainer) {
					if (targetContainer.type === "folder") {
						const pathsToMove = Array.from(
							useDesktopStore.getState().selectedIds,
						)
							.map((id) => {
								const i = useDesktopStore
									.getState()
									.items.find((item) => item.id === id);
								return i ? i.path : null;
							})
							.filter(Boolean) as string[];

						if (!pathsToMove.includes(item.path)) {
							pathsToMove.push(item.path);
						}

						useDesktopStore.getState().setDropPrompt({
							sourcePaths: pathsToMove,
							targetDir: targetContainer.folderPath!,
							targetType: "folderContainer",
							x: clientX,
							y: clientY,
						});
						return;
					}
					if (targetContainer.type === "game") {
						if (item.type !== "url" && item.type !== "shortcut") {
							window.alert("只能放置快捷方式");
							return;
						}
						if (targetContainer.items.length > 0) {
							const existingItem = targetContainer.items[0];
							useContainerStore
								.getState()
								.removeItemFromContainer(targetContainer.id, existingItem.id);
							useDesktopStore
								.getState()
								.moveItemToDesktop(
									existingItem,
									targetContainer.position.x + targetContainer.size.width + 20,
									targetContainer.position.y,
								);
						}
						useContainerStore
							.getState()
							.addItemToContainer(targetContainer.id, {
								...item,
								isInContainer: true,
								containerId: targetContainer.id,
							});
						useDesktopStore.getState().removeItem(item.id);

						// Fetch cover
						invoke<string>("read_shortcut_url", { path: item.path })
							.then(async (targetUrl) => {
								let coverUrl = "";
								if (targetUrl.startsWith("steam://rungameid/")) {
									const appId = targetUrl
										.replace("steam://rungameid/", "")
										.trim();
									coverUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`;
								} else if (targetUrl.includes("epicgames.launcher")) {
									const gameName = item.name.replace(/\.(url|lnk)$/i, "");
									try {
										const res = await fetch(
											`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`,
											{ method: "GET" },
										);
										const data = await res.json();
										if (data.total > 0 && data.items && data.items.length > 0) {
											const appId = data.items[0].id;
											coverUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`;
										}
									} catch (e) {
										console.error(
											"Failed to search Steam for Epic game cover",
											e,
										);
									}
								}

								if (coverUrl) {
									useContainerStore
										.getState()
										.updateContainerStyle(targetContainer.id, {
											coverImage: coverUrl,
										});
								}
							})
							.catch((e) => console.error("Failed to read shortcut url", e));
					} else {
						const selectedItems = useDesktopStore
							.getState()
							.items.filter(
								(i) =>
									useDesktopStore.getState().selectedIds.has(i.id) &&
									!i.isInContainer,
							);

						if (!selectedItems.some((i) => i.id === item.id)) {
							selectedItems.push(item);
						}

						for (const sItem of selectedItems) {
							useContainerStore
								.getState()
								.addItemToContainer(targetContainer.id, {
									...sItem,
									isInContainer: true,
									containerId: targetContainer.id,
								});
							useDesktopStore.getState().removeItem(sItem.id);
						}
					}
				} else {
					// Check for desktop item swap
					const dItems = useDesktopStore
						.getState()
						.items.filter((i) => !i.isInContainer && i.id !== item.id);
					const dropTarget = dItems.find(
						(i) =>
							i.position &&
							clientX > i.position.x - 10 &&
							clientX < i.position.x + cWidth + 10 &&
							clientY > i.position.y - 10 &&
							clientY < i.position.y + cHeight + 10,
					);

					if (dropTarget && dropTarget.position) {
						useDesktopStore
							.getState()
							.swapItemsPosition(item.id, dropTarget.id);
					} else {
						moveSelectedItems(item.id, newPos.x, newPos.y);
					}
				}
			} else if (item.containerId) {
				// Dragging inside a container
				const container = useContainerStore
					.getState()
					.containers.find((c) => c.id === item.containerId);
				if (container) {
					// If dropped outside container bounds, release to desktop
					if (
						clientX < container.position.x - 50 ||
						clientX > container.position.x + container.size.width + 50 ||
						clientY < container.position.y - 50 ||
						clientY > container.position.y + container.size.height + 50
					) {
						// Check if dropped into another folder container first
						const containers = useContainerStore.getState().containers;
						const targetContainer = containers.find(
							(c) =>
								clientX >= c.position.x &&
								clientX <= c.position.x + c.size.width &&
								clientY >= c.position.y &&
								clientY <= c.position.y + c.size.height,
						);

						if (
							targetContainer &&
							targetContainer.type === "folder" &&
							targetContainer.id !== container.id
						) {
							useDesktopStore.getState().setDropPrompt({
								sourcePaths: [item.path],
								targetDir: targetContainer.folderPath!,
								targetType: "folderContainer",
								x: clientX,
								y: clientY,
							});
							return;
						}

						if (container.type === "folder") {
							import("@tauri-apps/api/core").then(({ invoke }) => {
								invoke<string>("get_desktop_dir").then((desktopDir) => {
									useDesktopStore.getState().setDropPrompt({
										sourcePaths: [item.path],
										targetDir: desktopDir,
										targetType: "desktop",
										x: clientX,
										y: clientY,
									});
								});
							});
							return;
						}
						let actualX = clientX;
						let actualY = clientY;
						if (ref.current) {
							const rect = ref.current.getBoundingClientRect();
							actualX = rect.left;
							actualY = rect.top;
						}
						useContainerStore
							.getState()
							.removeItemFromContainer(container.id, item.id);
						useDesktopStore
							.getState()
							.moveItemToDesktop(item, actualX, actualY);
						return;
					}

					let targetId: string | null = null;
					for (const i of container.items) {
						if (i.id === item.id) continue;
						const el = document.querySelector(`[data-item-id="${i.id}"]`);
						if (el) {
							const rect = el.getBoundingClientRect();
							if (
								clientX >= rect.left &&
								clientX <= rect.right &&
								clientY >= rect.top &&
								clientY <= rect.bottom
							) {
								targetId = i.id;
								break;
							}
						}
					}

					if (targetId) {
						const newItems = [...container.items];
						const idx1 = newItems.findIndex((i) => i.id === item.id);
						const idx2 = newItems.findIndex((i) => i.id === targetId);
						if (idx1 !== -1 && idx2 !== -1) {
							useContainerStore
								.getState()
								.reorderItemsInContainer(container.id, idx1, idx2);
						}
					}
				}
			}
		},
	});

	// In list view, use cHeight as the item height, icon scales accordingly
	const currentIconSize = isListView
		? Math.max(16, cHeight - 16)
		: Math.round(Math.min(cWidth, cHeight) * 0.6);

	const renderIcon = () => {
		if (item.iconPath && item.iconPath.startsWith("data:image/")) {
			return (
				<img
					src={item.iconPath}
					alt={item.name}
					style={{ width: currentIconSize, height: currentIconSize }}
					className="object-contain pointer-events-none drop-shadow-md"
				/>
			);
		}
		const iconProps = {
			style: { width: currentIconSize, height: currentIconSize },
			className: "text-white/80 pointer-events-none drop-shadow-md",
		};
		switch (item.type) {
			case "folder":
				return (
					<Folder
						{...iconProps}
						fill="currentColor"
						className={cn(iconProps.className, "text-yellow-400")}
					/>
				);
			case "shortcut":
				return <Link {...iconProps} />;
			case "url":
				return <Link {...iconProps} />;
			case "system":
				if (item.targetPath?.includes("20D04FE0-3AEA-1069-A2D8-08002B30309D"))
					return (
						<Monitor
							{...iconProps}
							className={cn(iconProps.className, "text-[var(--color-accent)]")}
						/>
					);
				if (item.targetPath?.includes("645FF040-5081-101B-9F08-00AA002F954E"))
					return (
						<Trash2
							{...iconProps}
							className={cn(iconProps.className, "text-gray-300")}
						/>
					);
				if (item.targetPath?.includes("F02C1A0D-BE21-4350-88B0-7367FC96EF3C"))
					return (
						<Network
							{...iconProps}
							className={cn(iconProps.className, "text-[var(--color-accent)]")}
						/>
					);
				if (item.targetPath?.includes("5399E694-6CE5-4D6C-8FCE-1D8870FDCBA0"))
					return (
						<Settings
							{...iconProps}
							className={cn(iconProps.className, "text-[var(--color-accent)]")}
						/>
					);
				if (item.targetPath?.includes("59031a47-3f72-44a7-89c5-5595fe6b30ee"))
					return (
						<User
							{...iconProps}
							className={cn(iconProps.className, "text-green-400")}
						/>
					);
				return (
					<Monitor
						{...iconProps}
						className={cn(iconProps.className, "text-[var(--color-accent)]")}
					/>
				);
			default:
				return <File {...iconProps} />;
		}
	};

	const layoutStyle = item.isInContainer
		? {
				width: isListView ? "100%" : cWidth,
				height: cHeight,
				flexDirection: isListView ? ("row" as const) : ("column" as const), // Forced column for grid!
				alignItems: "center",
				justifyContent: !isListView && hideAppNames ? "center" : undefined,
				gap: isListView ? "8px" : "0px",
			}
		: {
				position: "absolute" as const,
				zIndex: isDragging ? 50 : isSelected ? 20 : "auto",
				width: cWidth,
				height: cHeight,
				flexDirection: "column" as const,
			};

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClick) {
			onClick(e);
		} else {
			toggleSelection(item.id, e.ctrlKey || e.metaKey);
		}
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onDoubleClick) {
			onDoubleClick(e);
		} else {
			invoke("open_file", { path: item.path });
		}
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();

		if (!isSelected) {
			setSelection([item.id]);
		}

		if (onContextMenu) {
			onContextMenu(e);
		} else {
			const currentPaths = isSelected ? paths : [item.path];
			const currentNormalized = currentPaths.map((p) => p.replace(/\//g, "\\"));
			window.dispatchEvent(
				new CustomEvent("show-item-context-menu", {
					detail: { paths: currentNormalized, x: e.clientX, y: e.clientY },
				}),
			);
		}
	};

	const fontSize = settings.fontSize || 12;
	const textMaxHeight = cHeight + cGapY - currentIconSize - 16;
	const lines = Math.max(2, Math.floor(textMaxHeight / (fontSize * 1.2)));

	let displayName = item.name;
	if (item.type === "file" && settings.hideFileExtensions !== false) {
		const lastDot = displayName.lastIndexOf(".");
		if (lastDot > 0) {
			displayName = displayName.substring(0, lastDot);
		}
	}

	return (
		<motion.div
			ref={ref}
			data-item-id={item.id}
			style={layoutStyle}
			initial={
				item.isInContainer ? { x: 0, y: 0 } : { left: pos.x, top: pos.y }
			}
			layoutId={String(item.id)}
			animate={
				item.isInContainer
					? { x: isDragging ? pos.x : 0, y: isDragging ? pos.y : 0 }
					: isSelected && dragOffset
						? { left: initialPos.x + dragOffset.dx, top: initialPos.y + dragOffset.dy }
						: { left: pos.x, top: pos.y }
			}
			transition={
				isDragging || (isSelected && dragOffset)
					? { duration: 0 }
					: { type: "spring", stiffness: 400, damping: 30 }
			}
			{...listeners}
			whileHover={{ scale: 1.05 }}
			whileTap={{ scale: 0.95 }}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
			onContextMenu={handleContextMenu}
			className={cn(
				"flex p-2 rounded-md select-none touch-none relative overflow-visible",
				isListView ? "text-left justify-start" : "justify-start",
				isDragging && item.isInContainer
					? "z-50 shadow-2xl opacity-80 bg-[var(--item-hover-bg)]"
					: "",
				isDragging && !item.isInContainer
					? "opacity-50 cursor-grabbing"
					: "cursor-default hover:bg-[var(--item-hover-bg)]",
				isSelected &&
					"bg-[var(--item-selected-bg)] ring-1 ring-[var(--item-selected-ring)]",
				isSelected &&
					settings.selectedItemBlur &&
					!settings.wallpaperCompatible &&
					"selected-blur",
				className,
			)}
		>
			{isSelected &&
				settings.selectedItemBlur &&
				settings.wallpaperCompatible &&
				wallpaper && (
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							backgroundImage: `url(${wallpaper})`,
							backgroundAttachment: "fixed",
							backgroundPosition: "top left",
							backgroundSize: "100vw 100vh",
							filter: "blur(20px)",
							zIndex: -1,
							borderRadius: "inherit",
						}}
					/>
				)}
			<div
				style={{
					width: currentIconSize + 8,
					height: currentIconSize + 8,
					opacity: settings.iconOpacity ?? 1.0,
				}}
				className="flex items-center justify-center relative pointer-events-none shrink-0"
			>
				{settings.iconGlow && (
					<div
						className="absolute inset-0 flex items-center justify-center"
						style={{
							filter: `blur(${settings.iconGlowRadius ?? 12}px)`,
							opacity: settings.iconGlowIntensity ?? 0.6,
							transform: "scale(1.05)",
						}}
					>
						{renderIcon()}
					</div>
				)}
				<div className="relative z-10 flex items-center justify-center w-full h-full">
					{renderIcon()}
				</div>
				{item.type === "shortcut" && !settings.hideShortcutBadge && (
					<div className="absolute -bottom-1 -left-1 bg-white rounded-sm p-0.5 shadow-sm">
						<svg
							width="10"
							height="10"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="3"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-black"
						>
							<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
							<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
						</svg>
					</div>
				)}
			</div>
			<div
				className={cn(
					"flex flex-col flex-1 min-w-0 pointer-events-none",
					!isListView && "items-center mt-1 w-full",
					!isListView && hideAppNames && "hidden",
				)}
				style={{ opacity: settings.textOpacity ?? 1.0 }}
			>
				<span
					className={cn(
						"break-words drop-shadow-md text-white",
						!isListView && "text-center",
					)}
					style={
						isListView
							? {
									fontSize: fontSize,
									lineHeight: 1.2,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									textShadow: "0 1px 2px rgba(0,0,0,0.8)",
								}
							: {
									textShadow: "0 1px 2px rgba(0,0,0,0.8)",
									fontSize: fontSize,
									lineHeight: 1.2,
									width: cWidth + Math.max(0, cGapX - 8),
									marginLeft: -(Math.max(0, cGapX - 8) / 2),
									marginRight: -(Math.max(0, cGapX - 8) / 2),
									display: "-webkit-box",
									WebkitBoxOrient: "vertical",
									WebkitLineClamp: lines,
									overflow: "hidden",
								}
					}
				>
					{displayName}
				</span>
				{isListView && showDetails && (
					<span
						className="text-[10px] text-white/50 truncate mt-0.5"
						style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
					>
						{[
							item.modifiedAt &&
								(() => {
									const d = new Date(item.modifiedAt * 1000);
									return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
								})(),
							item.type === "folder"
								? "文件夹"
								: item.type === "shortcut"
									? "快捷方式"
									: item.type === "system"
										? "系统应用"
										: "文件",
							item.size && item.type !== "folder" && item.size > 0
								? item.size > 1048576
									? `${(item.size / 1048576).toFixed(1)} MB`
									: `${Math.round(item.size / 1024)} KB`
								: null,
						]
							.filter(Boolean)
							.join(" • ")}
					</span>
				)}
			</div>
		</motion.div>
	);
}

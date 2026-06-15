import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
	ArrowDownUp,
	Box,
	ClipboardPaste,
	Clock,
	Eye,
	EyeOff,
	FilePlus,
	FolderPlus,
	FolderSearch,
	Gamepad2,
	LayoutGrid,
	Plus,
	RefreshCw,
	Settings,
	Tag,
	Terminal,
	Type,
	Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Container } from "@/components/Container/Container";
import {
	ContextMenu,
	type MenuItem,
} from "@/components/ContextMenu/ContextMenu";
import { ItemContextMenu } from "@/components/ContextMenu/ItemContextMenu";
import { FileItem } from "@/components/Item/FileItem";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { DesktopGrid } from "./DesktopGrid";
import { useHistoryStore } from "@/stores/historyStore";

export default function DesktopLayer() {
	const containers = useContainerStore((state) => state.containers);
	const fetchContainers = useContainerStore((state) => state.fetchContainers);
	const createContainer = useContainerStore((state) => state.createContainer);
	const {
		items,
		isLoading,
		fetchDesktopItems,
		clearSelection,
		setSelection,
		realignToGrid,
		sortDesktopItems,
		setWallpaper,
		isIconsHidden,
		setIsIconsHidden,
		dropPrompt,
		setDropPrompt,
	} = useDesktopStore();
	const { settings } = useSettingsStore();
	const [menuState, setMenuState] = useState<{
		visible: boolean;
		x: number;
		y: number;
	}>({ visible: false, x: 0, y: 0 });
	const [itemMenuState, setItemMenuState] = useState<{
		visible: boolean;
		x: number;
		y: number;
		paths: string[];
		customHeaderItems?: any[];
	}>({ visible: false, x: 0, y: 0, paths: [] });
	const [canPaste, setCanPaste] = useState(false);
	const [createPrompt, setCreatePrompt] = useState<{
		visible: boolean;
		isFolder: boolean;
		defaultName: string;
		x: number;
		y: number;
	} | null>(null);
	const [renamePrompt, setRenamePrompt] = useState<{
		visible: boolean;
		targetPath: string;
		oldName: string;
		x: number;
		y: number;
	} | null>(null);

	const prevGridWidth = useRef(settings.gridWidth);
	const prevGridHeight = useRef(settings.gridHeight);
	const prevGridGapX = useRef(settings.gridGapX);
	const prevGridGapY = useRef(settings.gridGapY);

	// Marquee state
	const [marquee, setMarquee] = useState<{
		startX: number;
		startY: number;
		endX: number;
		endY: number;
	} | null>(null);

	useEffect(() => {
		if (
			settings.gridWidth !== prevGridWidth.current ||
			settings.gridHeight !== prevGridHeight.current ||
			settings.gridGapX !== prevGridGapX.current ||
			settings.gridGapY !== prevGridGapY.current
		) {
			if (!isLoading) {
				prevGridWidth.current = settings.gridWidth;
				prevGridHeight.current = settings.gridHeight;
				prevGridGapX.current = settings.gridGapX;
				prevGridGapY.current = settings.gridGapY;
				realignToGrid();
			}
		}
	}, [
		settings.gridWidth,
		settings.gridHeight,
		settings.gridGapX,
		settings.gridGapY,
		realignToGrid,
		isLoading,
	]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isCtrl = e.ctrlKey || e.metaKey;
			const activeEl = document.activeElement;
			if (
				activeEl &&
				(activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true")
			) {
				return;
			}

			if (isCtrl && e.key.toLowerCase() === "z") {
				e.preventDefault();
				useHistoryStore.getState().undo();
			} else if (
				isCtrl &&
				(e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
			) {
				e.preventDefault();
				useHistoryStore.getState().redo();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	useEffect(() => {
		const initData = async () => {
			await fetchContainers();
			await fetchDesktopItems();
		};
		initData();

		if (settings.wallpaperCompatible) {
			import("@tauri-apps/api/core").then(({ invoke }) => {
				invoke<string>("capture_desktop_background")
					.then((res) => setWallpaper(res))
					.catch((err) => console.error("Failed to capture desktop:", err));
			});
		} else {
			setWallpaper(null);
		}

		let isCancelled = false;
		const unlistenFns: (() => void)[] = [];

		const openSettingsWindow = () => {
			import("@tauri-apps/api/webviewWindow").then(
				async ({ WebviewWindow }) => {
					const existing = await WebviewWindow.getByLabel("settings");
					if (existing) {
						existing.setFocus().catch(() => {});
					} else {
						new WebviewWindow("settings", {
							url: "/settings",
							title: "DeskZero 设置",
							width: 800,
							height: 600,
							resizable: true,
						});
					}
				},
			);
		};

		import("@tauri-apps/api/event").then(({ listen }) => {
			listen("desktop-dir-changed", () => {
				fetchDesktopItems();
			}).then((u) => {
				if (isCancelled) u();
				else unlistenFns.push(u);
			});

			listen("refresh-desktop", () => {
				fetchDesktopItems();
			}).then((u) => {
				if (isCancelled) u();
				else unlistenFns.push(u);
			});

			listen("sync-desktop-layout", () => {
				fetchDesktopItems(true);
			}).then((u) => {
				if (isCancelled) u();
				else unlistenFns.push(u);
			});

			listen("open-settings", () => {
				openSettingsWindow();
			}).then((u) => {
				if (isCancelled) u();
				else unlistenFns.push(u);
			});
		});

		import("@tauri-apps/api/webview").then(({ getCurrentWebview }) => {
			getCurrentWebview()
				.onDragDropEvent(async (event) => {
					if (event.payload.type === "drop") {
						const { paths, position } = event.payload;
						if (paths.length > 0) {
							let handledInternal = false;
							// Check if internal drag
							const firstPath = paths[0];
							const draggedItem = useDesktopStore
								.getState()
								.items.find((i) => i.path === firstPath);
							if (draggedItem) {
								useDesktopStore
									.getState()
									.moveSelectedItems(draggedItem.id, position.x, position.y);
								handledInternal = true;
							}

							if (!handledInternal) {
								// It's an external drop! Copy files to desktop in background so we don't freeze the OS drag pointer
								setTimeout(async () => {
									try {
										const { invoke } = await import("@tauri-apps/api/core");
										const { desktopDir } = await import("@tauri-apps/api/path");
										const targetDir = await desktopDir();
										const newFiles = await invoke<string[]>(
											"paste_files_to_desktop",
											{ paths, targetDir },
										);
										placeNewFiles(newFiles, position.x, position.y);
										await useDesktopStore.getState().fetchDesktopItems();
									} catch (e) {
										console.error("External drop failed:", e);
									}
								}, 0);
							}
						}
					}
				})
				.then((u) => {
					if (isCancelled) u();
					else unlistenFns.push(u);
				});
		});

		const handleKeyDown = async (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === "c") {
				e.preventDefault();
				const selectedIds = useDesktopStore.getState().selectedIds;
				if (selectedIds.size > 0) {
					const paths = Array.from(selectedIds)
						.map(
							(id) =>
								useDesktopStore.getState().items.find((i) => i.id === id)?.path,
						)
						.filter(Boolean) as string[];

					if (paths.length > 0) {
						const { invoke } = await import("@tauri-apps/api/core");
						const normalizedPaths = paths.map((p) => p.replace(/\//g, "\\"));
						await invoke("copy_files_to_clipboard", { paths: normalizedPaths });
						useToastStore
							.getState()
							.addToast(`已复制 ${paths.length} 个文件`, "success");
					}
				}
			} else if (e.ctrlKey && e.key === "v") {
				e.preventDefault();
				handlePaste();
			} else if (e.key === "Delete") {
				e.preventDefault();
				const selectedIds = useDesktopStore.getState().selectedIds;
				if (selectedIds.size > 0) {
					const paths = Array.from(selectedIds)
						.map(
							(id) =>
								useDesktopStore.getState().items.find((i) => i.id === id)?.path,
						)
						.filter(Boolean) as string[];

					if (paths.length > 0) {
						const { invoke } = await import("@tauri-apps/api/core");
						try {
							if (e.shiftKey) {
								await Promise.all(
									paths.map((p) => invoke("delete_file", { path: p })),
								);
							} else {
								await Promise.all(
									paths.map((p) => invoke("trash_file", { path: p })),
								);
							}
							await useDesktopStore.getState().fetchDesktopItems();
							useToastStore
								.getState()
								.addToast(`已删除 ${paths.length} 个文件`, "success");
						} catch (err) {
							console.error("Delete failed:", err);
							useToastStore
								.getState()
								.addToast(`删除失败: ${String(err)}`, "error");
						}
					}
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		const handleShowItemMenu = (e: any) => {
			setItemMenuState({
				visible: true,
				x: e.detail.x,
				y: e.detail.y,
				paths: e.detail.paths,
				customHeaderItems: e.detail.customHeaderItems,
			});
		};
		window.addEventListener("show-item-context-menu", handleShowItemMenu);

		return () => {
			isCancelled = true;
			unlistenFns.forEach((fn) => fn());
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("show-item-context-menu", handleShowItemMenu);
		};
	}, [settings.wallpaperCompatible]);

	const placeNewFiles = async (
		newFileNames: string[],
		x?: number,
		y?: number,
	) => {
		if (newFileNames.length === 0) return;
		if (x === undefined || y === undefined) return; // Fallback to sequential empty slot
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			let savedLayout: Record<string, { x: number; y: number }> = {};
			try {
				const result = await invoke("get_desktop_layout");
				if (result && typeof result === "object") savedLayout = result as any;
			} catch (e) {
				const savedLayoutStr = localStorage.getItem("deskzero_layout");
				if (savedLayoutStr) {
					try {
						const parsed = JSON.parse(savedLayoutStr);
						if (parsed && typeof parsed === "object") savedLayout = parsed;
					} catch (err) {}
				}
			}
			savedLayout = savedLayout || {};

			for (const name of newFileNames) {
				savedLayout[name] = { x, y };
				x += 20;
				y += 20;
			}
			await invoke("save_desktop_layout", { layout: savedLayout });
			localStorage.setItem("deskzero_layout", JSON.stringify(savedLayout));
		} catch (e) {
			console.warn("Failed to place new files", e);
		}
	};

	const handleContextMenu = useCallback(async (e: React.MouseEvent) => {
		e.preventDefault();
		if ((e.target as HTMLElement).closest(".touch-none")) return; // Let FileItem handle it

		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const hasFiles = await invoke<boolean>("check_clipboard_has_files");
			setCanPaste(hasFiles);
		} catch (err) {
			setCanPaste(false);
		}

		setMenuState({ visible: true, x: e.clientX, y: e.clientY });
	}, []);

	const handlePaste = async (x?: number, y?: number) => {
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const targetDir = await invoke<string>("get_desktop_dir");
			const paths = await invoke<string[]>("get_files_from_clipboard");
			if (paths && paths.length > 0) {
				const newFiles = await invoke<string[]>("paste_files_to_desktop", {
					paths,
					targetDir,
				});
				placeNewFiles(newFiles, x, y);
				await useDesktopStore.getState().fetchDesktopItems();
				useToastStore
					.getState()
					.addToast(`已粘贴 ${newFiles.length} 个文件`, "success");
			}
		} catch (e) {
			console.error("Paste failed:", e);
			useToastStore.getState().addToast(`粘贴失败: ${String(e)}`, "error");
		}
	};

	const handleCreateFile = async (name: string, isFolder: boolean) => {
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const dir = await invoke<string>("get_desktop_dir");

			let finalName = name;
			const existingNames = useDesktopStore.getState().items.map((i) => i.name);

			if (existingNames.includes(finalName)) {
				let counter = 2;
				let nameWithoutExt = finalName;
				let ext = "";

				if (!isFolder && finalName.includes(".")) {
					const lastDot = finalName.lastIndexOf(".");
					nameWithoutExt = finalName.substring(0, lastDot);
					ext = finalName.substring(lastDot);
				}

				while (existingNames.includes(`${nameWithoutExt} (${counter})${ext}`)) {
					counter++;
				}
				finalName = `${nameWithoutExt} (${counter})${ext}`;
			}

			const path = dir.replace(/[\\/]$/, "") + "\\" + finalName;
			if (isFolder) {
				await invoke("create_folder", { path });
			} else {
				await invoke("create_empty_file", { path });
			}
			if (createPrompt) {
				let stem = finalName;
				const lastDot = finalName.lastIndexOf(".");
				if (lastDot > 0) {
					stem = finalName.substring(0, lastDot);
				}
				placeNewFiles([stem], createPrompt.x, createPrompt.y);
			}
			setTimeout(() => fetchDesktopItems(), 500);
			useToastStore
				.getState()
				.addToast(
					`已创建${isFolder ? "文件夹" : "文件"} ${finalName}`,
					"success",
				);
		} catch (e: any) {
			console.error(e);
			useToastStore
				.getState()
				.addToast(
					`创建${isFolder ? "文件夹" : "文件"}失败: ${String(e)}`,
					"error",
				);
		}
	};

	const desktopMenuItems: MenuItem[] = [
		{
			label: "刷新",
			icon: <RefreshCw size={14} />,
			onClick: () => fetchDesktopItems(),
		},
		{
			label: "查看",
			icon: <Eye size={14} />,
			onClick: () => {},
			subItems: [
				{
					label: isIconsHidden ? "显示桌面图标" : "隐藏桌面图标",
					icon: isIconsHidden ? <Eye size={14} /> : <EyeOff size={14} />,
					onClick: () => setIsIconsHidden(!isIconsHidden),
				},
			],
		},
		{
			label: "排序方式",
			icon: <ArrowDownUp size={14} />,
			onClick: () => {},
			subItems: [
				{
					label: "名称 A-Z",
					icon: <Type size={14} />,
					onClick: () => sortDesktopItems("name"),
				},
				{
					label: "大小",
					icon: <Box size={14} />,
					onClick: () => sortDesktopItems("size"),
				},
				{
					label: "项目类型",
					icon: <Tag size={14} />,
					onClick: () => sortDesktopItems("type"),
				},
				{
					label: "修改日期",
					icon: <Clock size={14} />,
					onClick: () => sortDesktopItems("date"),
				},
				{ divider: true },
				{
					label: "自动分类排序",
					icon: <Wand2 size={14} />,
					onClick: () => realignToGrid(),
				},
			],
		},
		{
			label: "打开方式",
			icon: <Terminal size={14} />,
			onClick: () => {},
			subItems: [
				{
					label: "在此处打开 powershell 窗口",
					icon: <Terminal size={14} />,
					onClick: async () => {
						const { invoke } = await import("@tauri-apps/api/core");
						const dir = await invoke<string>("get_desktop_dir");
						invoke("open_terminal", { shell: "powershell", path: dir });
					},
				},
				{
					label: "在此处打开 cmd 窗口",
					icon: <Terminal size={14} />,
					onClick: async () => {
						const { invoke } = await import("@tauri-apps/api/core");
						const dir = await invoke<string>("get_desktop_dir");
						invoke("open_terminal", { shell: "cmd", path: dir });
					},
				},
			],
		},
		{
			label: "新建",
			icon: <Plus size={14} />,
			onClick: () => {},
			subItems: [
				{
					label: "新建文件夹",
					icon: <FolderPlus size={14} />,
					onClick: (e) => {
						setCreatePrompt({
							visible: true,
							isFolder: true,
							defaultName: "新建文件夹",
							x: e?.clientX ?? menuState.x,
							y: e?.clientY ?? menuState.y,
						});
					},
				},
				{
					label: "新建文件",
					icon: <FilePlus size={14} />,
					onClick: (e) => {
						setCreatePrompt({
							visible: true,
							isFolder: false,
							defaultName: "新建文本文件.txt",
							x: e?.clientX ?? menuState.x,
							y: e?.clientY ?? menuState.y,
						});
					},
				},
				{
					label: "新建收纳盒容器",
					icon: <LayoutGrid size={14} />,
					onClick: async () => {
						try {
							await createContainer("新建收纳盒", "normal", {
								x: menuState.x,
								y: menuState.y,
							});
							fetchContainers();
							useToastStore.getState().addToast("已创建收纳盒", "success");
						} catch (e: any) {
							useToastStore
								.getState()
								.addToast("新建收纳盒失败: " + String(e), "error");
						}
					},
				},
				{
					label: "新建游戏容器",
					icon: <Gamepad2 size={14} />,
					onClick: async () => {
						try {
							await createContainer("新建游戏容器", "game", {
								x: menuState.x,
								y: menuState.y,
							});
							fetchContainers();
							useToastStore.getState().addToast("已创建游戏容器", "success");
						} catch (e: any) {
							useToastStore
								.getState()
								.addToast("新建游戏容器失败: " + String(e), "error");
						}
					},
				},
				{
					label: "新建图标展示容器",
					icon: <Wand2 size={14} />,
					onClick: async () => {
						try {
							await createContainer("新建图标展示容器", "iconShow", {
								x: menuState.x,
								y: menuState.y,
							});
							fetchContainers();
							useToastStore.getState().addToast("已创建图标展示容器", "success");
						} catch (e: any) {
							useToastStore
								.getState()
								.addToast("新建图标展示容器失败: " + String(e), "error");
						}
					},
				},
				{
					label: "新建目录索引容器",
					icon: <FolderSearch size={14} />,
					onClick: async () => {
						try {
							const { open } = await import("@tauri-apps/plugin-dialog");
							const selected = await open({
								directory: true,
								multiple: false,
								title: "选择要在桌面显示的目录",
							});
							if (selected) {
								const folderPath = Array.isArray(selected)
									? selected[0]
									: selected;
								// Get folder name
								const folderName =
									folderPath.substring(
										Math.max(
											folderPath.lastIndexOf("\\"),
											folderPath.lastIndexOf("/"),
										) + 1,
									) || "新目录";
								await createContainer(
									folderName,
									"folder",
									{
										x: menuState.x,
										y: menuState.y,
									},
									folderPath,
								);
								fetchContainers();
								useToastStore
									.getState()
									.addToast(`已创建目录索引: ${folderName}`, "success");
							}
						} catch (e: any) {
							useToastStore
								.getState()
								.addToast("新建目录索引容器失败: " + String(e), "error");
						}
					},
				},
			],
		},
		{ divider: true, onClick: () => {} },
		{
			label: "粘贴",
			icon: <ClipboardPaste size={14} />,
			disabled: !canPaste,
			onClick: () => handlePaste(menuState.x, menuState.y),
		},
		{ divider: true, onClick: () => {} },
		{
			label: "DeskZero 设置",
			icon: <Settings size={14} />,
			onClick: async () => {
				const existing = await WebviewWindow.getByLabel("settings");
				if (existing) {
					existing.setFocus().catch(() => {});
				} else {
					new WebviewWindow("settings", {
						url: "/settings",
						title: "DeskZero 设置",
						width: 800,
						height: 600,
						resizable: true,
					});
				}
			},
		},
	];

	const onPointerDown = (e: React.PointerEvent) => {
		if (createPrompt) setCreatePrompt(null);
		if (e.button !== 0) return; // Only left click
		if (
			(e.target as HTMLElement).closest(".touch-none") ||
			(e.target as HTMLElement).closest(".cursor-move")
		) {
			// Clicked on a draggable item or container
			return;
		}

		clearSelection();
		setMarquee({
			startX: e.clientX,
			startY: e.clientY,
			endX: e.clientX,
			endY: e.clientY,
		});
	};

	const onDoubleClick = (e: React.MouseEvent) => {
		if (settings.doubleClickHide !== false) {
			if (
				(e.target as HTMLElement).closest(".touch-none") ||
				(e.target as HTMLElement).closest(".cursor-move")
			) {
				return;
			}
			setIsIconsHidden(!isIconsHidden);
		}
	};

	const onPointerMove = (e: React.PointerEvent) => {
		if (!marquee) return;
		setMarquee((prev) =>
			prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null,
		);

		// Calculate selection
		const minX = Math.min(marquee.startX, e.clientX);
		const maxX = Math.max(marquee.startX, e.clientX);
		const minY = Math.min(marquee.startY, e.clientY);
		const maxY = Math.max(marquee.startY, e.clientY);

		const newSelectedIds: string[] = [];

		items.forEach((item) => {
			if (item.isInContainer || !item.position) return;
			// Item bounds approx (width: 80, height: 96)
			const itemMinX = item.position.x;
			const itemMaxX = item.position.x + 80;
			const itemMinY = item.position.y;
			const itemMaxY = item.position.y + 96;

			const overlap = !(
				minX > itemMaxX ||
				maxX < itemMinX ||
				minY > itemMaxY ||
				maxY < itemMinY
			);
			if (overlap) {
				newSelectedIds.push(item.id);
			}
		});

		setSelection(newSelectedIds);
	};

	const onPointerUp = () => {
		setMarquee(null);
	};

	const marqueeRect = marquee
		? {
				left: Math.min(marquee.startX, marquee.endX),
				top: Math.min(marquee.startY, marquee.endY),
				width: Math.abs(marquee.endX - marquee.startX),
				height: Math.abs(marquee.endY - marquee.startY),
			}
		: null;

	return (
		<div
			className="w-screen h-screen relative overflow-hidden select-none pointer-events-auto"
			style={{
				backgroundColor: "transparent",
			}}
			onContextMenu={handleContextMenu}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onDoubleClick={onDoubleClick}
		>
			{marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
				<div
					className="absolute bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/50 z-50 pointer-events-none"
					style={{
						left: marqueeRect.left,
						top: marqueeRect.top,
						width: marqueeRect.width,
						height: marqueeRect.height,
					}}
				/>
			)}

			{/* Create Prompt Popup */}
			{createPrompt && createPrompt.visible && (
				<div
					className="absolute z-50 bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl rounded-xl p-3 flex flex-col gap-2 min-w-[200px]"
					style={{ left: createPrompt.x, top: createPrompt.y }}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<div className="text-xs font-medium text-[var(--color-text)] mb-1">
						请输入{createPrompt.isFolder ? "文件夹" : "文件"}名称：
					</div>
					<input
						type="text"
						autoFocus
						defaultValue={createPrompt.defaultName}
						className="w-full bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded px-2 py-1 text-xs border border-transparent focus:border-[var(--color-accent)]/50 focus:bg-transparent outline-none transition-all"
						onKeyDown={async (e) => {
							if (e.key === "Enter") {
								const name = (e.target as HTMLInputElement).value;
								if (name) {
									await handleCreateFile(name, createPrompt.isFolder);
									setCreatePrompt(null);
								}
							} else if (e.key === "Escape") {
								setCreatePrompt(null);
							}
						}}
					/>
				</div>
			)}

			{/* Rename Prompt Popup */}
			{renamePrompt && renamePrompt.visible && (
				<div
					className="absolute z-50 bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl rounded-xl p-3 flex flex-col gap-2 min-w-[200px]"
					style={{ left: renamePrompt.x, top: renamePrompt.y }}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<div className="text-xs font-medium text-[var(--color-text)] mb-1">
						重命名：
					</div>
					<input
						type="text"
						autoFocus
						defaultValue={renamePrompt.oldName}
						className="w-full bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded px-2 py-1 text-xs border border-transparent focus:border-[var(--color-accent)]/50 focus:bg-transparent outline-none transition-all"
						onFocus={(e) => {
							// select text without extension by default
							const lastDot = e.target.value.lastIndexOf(".");
							if (lastDot > 0) {
								e.target.setSelectionRange(0, lastDot);
							} else {
								e.target.select();
							}
						}}
						onBlur={async (e) => {
							// If it's already hidden, do nothing
							if (!renamePrompt || !renamePrompt.visible) return;
							const newName = e.target.value;
							if (newName && newName !== renamePrompt.oldName) {
								try {
									const { invoke } = await import("@tauri-apps/api/core");
									const newPath = (await invoke("rename_file", {
										path: renamePrompt.targetPath,
										newName,
									})) as string;

									// Migrate layout position
									const oldItem = items.find(
										(i) => i.path === renamePrompt.targetPath,
									);
									if (oldItem && oldItem.position) {
										let savedLayout: Record<string, { x: number; y: number }> =
											{};
										try {
											const result = await invoke("get_desktop_layout");
											if (result && typeof result === "object")
												savedLayout = result as any;
										} catch (e) {
											const savedLayoutStr =
												localStorage.getItem("deskzero_layout");
											if (savedLayoutStr) {
												try {
													const parsed = JSON.parse(savedLayoutStr);
													if (parsed && typeof parsed === "object")
														savedLayout = parsed;
												} catch (err) {}
											}
										}
										savedLayout = savedLayout || {};

										const utf8Bytes = new TextEncoder().encode(newPath);
										const binaryStr = Array.from(utf8Bytes)
											.map((b) => String.fromCharCode(b))
											.join("");
										const base64Id = btoa(binaryStr);

										savedLayout[base64Id] =
											savedLayout[oldItem.id] || oldItem.position;
										await invoke("save_desktop_layout", {
											layout: savedLayout,
										});
										localStorage.setItem(
											"deskzero_layout",
											JSON.stringify(savedLayout),
										);
									}

									setTimeout(() => {
										fetchDesktopItems();
										fetchContainers();
									}, 500);
									useToastStore
										.getState()
										.addToast(`已重命名为 ${newName}`, "success");
								} catch (err) {
									useToastStore
										.getState()
										.addToast("重命名失败: " + String(err), "error");
								}
							}
							setRenamePrompt(null);
						}}
						onKeyDown={async (e) => {
							if (e.key === "Enter") {
								e.currentTarget.blur();
							} else if (e.key === "Escape") {
								e.currentTarget.value = renamePrompt.oldName;
								e.currentTarget.blur();
							}
						}}
					/>
				</div>
			)}

			{/* Drop Prompt Popup */}
			{dropPrompt && (
				<div
					className="absolute z-50 bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl rounded-xl p-2 flex flex-col min-w-[120px]"
					style={{ left: dropPrompt.x, top: dropPrompt.y }}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<button
						className="px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors whitespace-nowrap"
						onClick={async () => {
							const prompt = dropPrompt;
							setDropPrompt(null);
							try {
								const { invoke } = await import("@tauri-apps/api/core");
								await invoke("paste_files_to_desktop", {
									paths: prompt.sourcePaths,
									targetDir: prompt.targetDir,
								});
								if (prompt.targetType === "desktop") {
									fetchDesktopItems();
								} else {
									window.dispatchEvent(
										new CustomEvent("folder-container-refresh", {
											detail: { dir: prompt.targetDir },
										}),
									);
								}
								useToastStore
									.getState()
									.addToast("成功复制到当前位置", "success");
							} catch (e) {
								console.error(e);
								useToastStore
									.getState()
									.addToast("复制失败: " + String(e), "error");
							}
						}}
					>
						复制到当前位置
					</button>
					<button
						className="px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors whitespace-nowrap"
						onClick={async () => {
							const prompt = dropPrompt;
							setDropPrompt(null);
							try {
								const { invoke } = await import("@tauri-apps/api/core");
								await invoke("move_files_to_dir", {
									paths: prompt.sourcePaths,
									targetDir: prompt.targetDir,
								});
								// refresh both desktop and the target
								fetchDesktopItems();
								if (prompt.targetType === "folderContainer") {
									window.dispatchEvent(
										new CustomEvent("folder-container-refresh", {
											detail: { dir: prompt.targetDir },
										}),
									);
								}
								useToastStore
									.getState()
									.addToast("成功移动到当前位置", "success");
							} catch (e) {
								console.error(e);
								useToastStore
									.getState()
									.addToast("移动失败: " + String(e), "error");
							}
						}}
					>
						移动到当前位置
					</button>
					<div className="h-[1px] bg-black/10 dark:bg-white/10 my-1" />
					<button
						className="px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors whitespace-nowrap"
						onClick={() => setDropPrompt(null)}
					>
						取消
					</button>
				</div>
			)}

			<div
				className={`w-full h-full transition-opacity duration-300 ${isIconsHidden && settings.doubleClickHide !== false ? "opacity-0 pointer-events-none" : "opacity-100"}`}
				onClick={() => {
					if (dropPrompt) setDropPrompt(null);
				}}
			>
				<DesktopGrid>
					{/* Render Desktop Items */}
					{items
						.filter((i) => !i.isInContainer)
						.map((item) => (
							<FileItem key={item.id} item={item} />
						))}

					{/* Render Containers */}
					{containers.map((container) => (
						<Container key={container.id} container={container} />
					))}
				</DesktopGrid>
			</div>

			{menuState.visible && (
				<ContextMenu
					x={menuState.x}
					y={menuState.y}
					items={desktopMenuItems}
					onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
				/>
			)}

			{itemMenuState.visible && (
				<ItemContextMenu
					x={itemMenuState.x}
					y={itemMenuState.y}
					paths={itemMenuState.paths}
					customHeaderItems={itemMenuState.customHeaderItems}
					onClose={() =>
						setItemMenuState((prev) => ({ ...prev, visible: false }))
					}
					onRename={() => {
						if (itemMenuState.paths.length === 1) {
							const path = itemMenuState.paths[0];
							const oldName = path.substring(
								Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")) + 1,
							);
							setRenamePrompt({
								visible: true,
								targetPath: path,
								oldName,
								x: itemMenuState.x,
								y: itemMenuState.y,
							});
						}
					}}
				/>
			)}
		</div>
	);
}

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
	Puzzle,
	RefreshCw,
	Settings,
	Tag,
	Terminal,
	Type,
	Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useWidgetStore } from "@/stores/widgetStore";
import { DesktopGrid } from "./DesktopGrid";
import { GridOverlay } from "./GridOverlay";
import { useHistoryStore } from "@/stores/historyStore";
import { WidgetSelectorDialog } from "@/components/Widget/WidgetSelectorDialog";
import type { Position } from "@/types/container";

export default function DesktopLayer() {
	const { t } = useTranslation();
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
	const fetchCustomWidgets = useWidgetStore((s) => s.fetchCustomWidgets);
	useEffect(() => { fetchCustomWidgets(); }, []);
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
		customHeaderItems?: MenuItem[];
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
	const [widgetSelectorOpen, setWidgetSelectorOpen] = useState(false);
	const [widgetSelectorPos, setWidgetSelectorPos] = useState<Position>({ x: 0, y: 0 });

	const prevGridWidth = useRef(settings.gridWidth);
	const prevGridHeight = useRef(settings.gridHeight);
	const prevGridGapX = useRef(settings.gridGapX);
	const prevGridGapY = useRef(settings.gridGapY);
	const desktopRef = useRef<HTMLDivElement>(null);
	const currentXRef = useRef(0);
	const currentYRef = useRef(0);
	const marqueeRef = useRef<HTMLDivElement>(null);
	const marqueeStart = useRef<{ x: number; y: number } | null>(null);
	const marqueeRafId = useRef<number | null>(null);
	const latestPointerEvent = useRef<React.PointerEvent | null>(null);

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
			const target = e.target as HTMLElement;
			if (
				(activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true")) ||
				(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.getAttribute("contenteditable") === "true" || target.closest("input") || target.closest("textarea")))
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
							title: t("desktop.settingsTitle"),
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

			listen("sync-desktop-layout", async () => {
				try {
					await useSettingsStore.getState().loadSettings();
					await useContainerStore.getState().fetchContainers();
				} catch (err) {
					console.error("Failed to reload settings or containers:", err);
				}
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

			listen("re-capture-wallpaper", () => {
				import("@tauri-apps/api/core").then(({ invoke }) => {
					invoke<string>("capture_desktop_background")
						.then((res) => {
							setWallpaper(res);
							useToastStore.getState().addToast(t("desktop.blurRepairSuccess"), "success");
						})
						.catch((err) => {
							console.error("Failed to capture desktop:", err);
							useToastStore.getState().addToast(t("desktop.blurRepairFailed") + String(err), "error");
						});
				});
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
			const activeEl = document.activeElement;
			const target = e.target as HTMLElement;
			if (
				(activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true")) ||
				(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.getAttribute("contenteditable") === "true" || target.closest("input") || target.closest("textarea")))
			) {
				return;
			}
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
							.addToast(t("desktop.copiedFiles", { count: paths.length }), "success");
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
						let results: PromiseSettledResult<void>[];
						if (e.shiftKey) {
							results = await Promise.allSettled(
								paths.map((p) => invoke<void>("delete_file", { path: p })),
							);
						} else {
							results = await Promise.allSettled(
								paths.map((p) => invoke<void>("trash_file", { path: p })),
							);
						}
						const failed = results.filter((r) => r.status === "rejected");
						if (failed.length > 0) {
							useToastStore
								.getState()
								.addToast(
									t("desktop.failedCount", { count: failed.length }),
									"warning",
								);
						}
						await useDesktopStore.getState().fetchDesktopItems();
						const succeeded = results.filter((r) => r.status === "fulfilled").length;
						if (succeeded > 0) {
							useToastStore
								.getState()
								.addToast(t("desktop.deletedFiles", { count: succeeded }), "success");
						}
						} catch (err) {
							console.error("Delete failed:", err);
							useToastStore
								.getState()
								.addToast(t("desktop.deleteFailed", { error: String(err) }), "error");
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

	useEffect(() => {
		let targetX = 0;
		let targetY = 0;
		let rafId: number;
		const intensity = settings.parallaxIntensity ?? 2;

		const handlePointerMove = (e: PointerEvent) => {
			const { clientX, clientY } = e;
			const dx = clientX - window.innerWidth / 2;
			const dy = clientY - window.innerHeight / 2;
			targetX = dx * 0.012 * (intensity / 5);
			targetY = dy * 0.012 * (intensity / 5);
		};

		const handlePointerLeave = () => {
			targetX = 0;
			targetY = 0;
		};

		if (settings.parallaxEnabled) {
			window.addEventListener("pointermove", handlePointerMove);
			document.addEventListener("pointerleave", handlePointerLeave);
			document.addEventListener("mouseleave", handlePointerLeave);
		} else {
			targetX = 0;
			targetY = 0;
		}

		const updateParallax = () => {
			currentXRef.current += (targetX - currentXRef.current) * 0.04;
			currentYRef.current += (targetY - currentYRef.current) * 0.04;

			if (desktopRef.current) {
				if (!settings.parallaxEnabled && Math.abs(currentXRef.current) < 0.05 && Math.abs(currentYRef.current) < 0.05) {
					desktopRef.current.style.removeProperty("--container-parallax-x");
					desktopRef.current.style.removeProperty("--container-parallax-y");
					currentXRef.current = 0;
					currentYRef.current = 0;
					return; // Stop RAF loop
				}

				desktopRef.current.style.setProperty("--container-parallax-x", `${currentXRef.current}px`);
				desktopRef.current.style.setProperty("--container-parallax-y", `${currentYRef.current}px`);
			}

			rafId = requestAnimationFrame(updateParallax);
		};

		rafId = requestAnimationFrame(updateParallax);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerleave", handlePointerLeave);
			document.removeEventListener("mouseleave", handlePointerLeave);
			cancelAnimationFrame(rafId);
		};
	}, [settings.parallaxEnabled, settings.parallaxIntensity]);

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
		if ((e.target as HTMLElement).closest(".touch-none")) return;
		if ((e.target as HTMLElement).closest(".settings-backdrop")) return;
		e.preventDefault();

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
					.addToast(t("desktop.pastedFiles", { count: newFiles.length }), "success");
			}
		} catch (e) {
			console.error("Paste failed:", e);
			useToastStore.getState().addToast(t("desktop.pasteFailed", { error: String(e) }), "error");
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
					t("desktop.createdItem", { type: isFolder ? t("desktop.folder") : t("desktop.file"), name: finalName }),
					"success",
				);
		} catch (e: any) {
			console.error(e);
			useToastStore
				.getState()
				.addToast(
					t("desktop.createItemFailed", { type: isFolder ? t("desktop.folder") : t("desktop.file"), error: String(e) }),
					"error",
				);
		}
	};

	const desktopMenuItems: MenuItem[] = [
		{
			label: t("desktop.contextMenu.refresh"),
			icon: <RefreshCw size={14} />,
			onClick: () => fetchDesktopItems(),
		},
		{
			label: t("desktop.contextMenu.view"),
			icon: <Eye size={14} />,
			onClick: () => {},
			subItems: [
				{
					label: isIconsHidden ? t("desktop.contextMenu.showIcons") : t("desktop.contextMenu.hideIcons"),
					icon: isIconsHidden ? <Eye size={14} /> : <EyeOff size={14} />,
					onClick: () => setIsIconsHidden(!isIconsHidden),
				},
			],
		},
		{
			label: t("desktop.contextMenu.sortBy"),
			icon: <ArrowDownUp size={14} />,
			onClick: () => {},
			subItems: [
				{
					label: t("desktop.contextMenu.nameAZ"),
					icon: <Type size={14} />,
					onClick: () => sortDesktopItems("name"),
				},
				{
					label: t("desktop.contextMenu.size"),
					icon: <Box size={14} />,
					onClick: () => sortDesktopItems("size"),
				},
				{
					label: t("desktop.contextMenu.type"),
					icon: <Tag size={14} />,
					onClick: () => sortDesktopItems("type"),
				},
				{
					label: t("desktop.contextMenu.modified"),
					icon: <Clock size={14} />,
					onClick: () => sortDesktopItems("date"),
				},
				{ divider: true },
				{
					label: t("desktop.contextMenu.autoSort"),
					icon: <Wand2 size={14} />,
					onClick: () => realignToGrid(),
				},
			],
		},
		{
			label: t("desktop.contextMenu.openWith"),
			icon: <Terminal size={14} />,
			onClick: () => {},
			subItems: [
				{
					label: t("desktop.contextMenu.openPowerShell"),
					icon: <Terminal size={14} />,
					onClick: async () => {
						const { invoke } = await import("@tauri-apps/api/core");
						const dir = await invoke<string>("get_desktop_dir");
						invoke("open_terminal", { shell: "powershell", path: dir });
					},
				},
				{
					label: t("desktop.contextMenu.openCmd"),
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
			label: t("desktop.contextMenu.new"),
			icon: <Plus size={14} />,
			onClick: () => {},
			subItems: [
				{
					label: t("desktop.contextMenu.newFolder"),
					icon: <FolderPlus size={14} />,
					onClick: (e) => {
						setCreatePrompt({
							visible: true,
							isFolder: true,
							defaultName: t("desktop.contextMenu.newFolderName"),
							x: e?.clientX ?? menuState.x,
							y: e?.clientY ?? menuState.y,
						});
					},
				},
				{
					label: t("desktop.contextMenu.newFile"),
					icon: <FilePlus size={14} />,
					onClick: (e) => {
						setCreatePrompt({
							visible: true,
							isFolder: false,
							defaultName: t("desktop.contextMenu.newFileName"),
							x: e?.clientX ?? menuState.x,
							y: e?.clientY ?? menuState.y,
						});
					},
				},
				{
					label: t("desktop.contextMenu.newContainer"),
					icon: <LayoutGrid size={14} />,
					onClick: async () => {
						try {
							await createContainer(t("desktop.contextMenu.newContainerName"), "normal", {
								x: menuState.x,
								y: menuState.y,
							});
							fetchContainers();
							useToastStore.getState().addToast(t("desktop.contextMenu.containerCreated"), "success");
						} catch (e: any) {
							useToastStore
								.getState()
								.addToast(t("desktop.contextMenu.containerCreateFailed") + String(e), "error");
						}
					},
				},
				{
					label: t("desktop.contextMenu.newGameContainer"),
					icon: <Gamepad2 size={14} />,
					onClick: async () => {
						try {
							await createContainer(t("desktop.contextMenu.newGameContainerName"), "game", {
								x: menuState.x,
								y: menuState.y,
							});
							fetchContainers();
							useToastStore.getState().addToast(t("desktop.contextMenu.gameContainerCreated"), "success");
						} catch (e: any) {
							useToastStore
								.getState()
								.addToast(t("desktop.contextMenu.gameContainerCreateFailed") + String(e), "error");
						}
					},
				},
				{
					label: t("desktop.contextMenu.newIconShow"),
					icon: <Wand2 size={14} />,
					onClick: async () => {
						try {
							await createContainer(t("desktop.contextMenu.newIconShowName"), "iconShow", {
								x: menuState.x,
								y: menuState.y,
							});
							fetchContainers();
							useToastStore.getState().addToast(t("desktop.contextMenu.iconShowCreated"), "success");
						} catch (e: any) {
							useToastStore
								.getState()
								.addToast(t("desktop.contextMenu.iconShowCreateFailed") + String(e), "error");
						}
					},
				},
				{
					label: t("desktop.contextMenu.newFolderIndex"),
					icon: <FolderSearch size={14} />,
					onClick: async () => {
						try {
							const { open } = await import("@tauri-apps/plugin-dialog");
							const selected = await open({
								directory: true,
								multiple: false,
								title: t("desktop.contextMenu.selectDirectory"),
							});
							if (selected) {
								const folderPath = Array.isArray(selected)
									? selected[0]
									: selected;
								const folderName =
									folderPath.substring(
										Math.max(
											folderPath.lastIndexOf("\\"),
											folderPath.lastIndexOf("/"),
										) + 1,
									) || t("desktop.contextMenu.newDirectory");
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
									.addToast(t("desktop.contextMenu.folderIndexCreated", { name: folderName }), "success");
							}
						} catch (e: any) {
							useToastStore
								.getState()
								.addToast(t("desktop.contextMenu.folderIndexCreateFailed") + String(e), "error");
						}
					},
				},
				{
					divider: true,
					onClick: () => {},
				},
				{
					label: t("desktop.contextMenu.newWidget"),
					icon: <Puzzle size={14} />,
					onClick: () => {
						setWidgetSelectorPos({ x: menuState.x, y: menuState.y });
						setWidgetSelectorOpen(true);
					},
				},
			],
		},
		{ divider: true, onClick: () => {} },
		{
			label: t("desktop.contextMenu.paste"),
			icon: <ClipboardPaste size={14} />,
			disabled: !canPaste,
			onClick: () => handlePaste(menuState.x, menuState.y),
		},
		{ divider: true, onClick: () => {} },
		{
			label: t("desktop.settingsTitle"),
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
		if (renamePrompt) setRenamePrompt(null);
		if (e.button !== 0) return; // Only left click
		if (
			(e.target as HTMLElement).closest(".touch-none") ||
			(e.target as HTMLElement).closest(".cursor-move") ||
			(e.target as HTMLElement).closest(".settings-backdrop")
		) {
			return;
		}

		clearSelection();
		
		marqueeStart.current = {
			x: e.clientX,
			y: e.clientY,
		};

		if (marqueeRef.current) {
			marqueeRef.current.style.left = `${e.clientX}px`;
			marqueeRef.current.style.top = `${e.clientY}px`;
			marqueeRef.current.style.width = "0px";
			marqueeRef.current.style.height = "0px";
		}
	};

	const onDoubleClick = (e: React.MouseEvent) => {
		if (settings.doubleClickHide !== false) {
			if (
				(e.target as HTMLElement).closest(".touch-none") ||
				(e.target as HTMLElement).closest(".cursor-move") ||
				(e.target as HTMLElement).closest(".settings-backdrop")
			) {
				return;
			}
			setIsIconsHidden(!isIconsHidden);
		}
	};

	const onPointerMove = (e: React.PointerEvent) => {
		if (!marqueeStart.current) return;
		e.persist();
		latestPointerEvent.current = e;

		if (marqueeRafId.current === null) {
			marqueeRafId.current = requestAnimationFrame(() => {
				marqueeRafId.current = null;
				const ev = latestPointerEvent.current;
				if (!ev || !marqueeStart.current) return;

				const startX = marqueeStart.current.x;
				const startY = marqueeStart.current.y;
				const minX = Math.min(startX, ev.clientX);
				const maxX = Math.max(startX, ev.clientX);
				const minY = Math.min(startY, ev.clientY);
				const maxY = Math.max(startY, ev.clientY);

				const width = maxX - minX;
				const height = maxY - minY;

				if (marqueeRef.current) {
					if (width > 2 || height > 2) {
						marqueeRef.current.style.left = `${minX}px`;
						marqueeRef.current.style.top = `${minY}px`;
						marqueeRef.current.style.width = `${width}px`;
						marqueeRef.current.style.height = `${height}px`;
						marqueeRef.current.style.display = "block";
					}
				}

				// Calculate selection
				const newSelectedIds: string[] = [];
				items.forEach((item) => {
					if (item.isInContainer || !item.position) return;
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

				const currentSelected = useDesktopStore.getState().selectedIds;
				const isSame =
					newSelectedIds.length === currentSelected.size &&
					newSelectedIds.every((id) => currentSelected.has(id));
				if (!isSame) {
					setSelection(newSelectedIds);
				}
			});
		}
	};

	const onPointerUp = () => {
		marqueeStart.current = null;
		if (marqueeRafId.current !== null) {
			cancelAnimationFrame(marqueeRafId.current);
			marqueeRafId.current = null;
		}
		latestPointerEvent.current = null;

		if (marqueeRef.current) {
			marqueeRef.current.style.display = "none";
		}
	};

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
			<div
				ref={marqueeRef}
				className="absolute bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/50 z-50 pointer-events-none rounded"
				style={{ display: "none" }}
			/>

			{/* Create Prompt Popup */}
			{createPrompt && createPrompt.visible && (
				<div
					className="absolute z-50 bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl rounded-xl p-3 flex flex-col gap-2 min-w-[200px]"
					style={{ left: createPrompt.x, top: createPrompt.y }}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<div className="text-xs font-medium text-[var(--color-text)] mb-1">
						{t("desktop.inputName", { type: createPrompt.isFolder ? t("desktop.folder") : t("desktop.file") })}
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
						{t("desktop.renameLabel")}
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

									// 更新容器内重命名项的路径/ID/名称
									const utf8BytesForId = new TextEncoder().encode(newPath);
									const binaryStrForId = Array.from(utf8BytesForId)
										.map((b) => String.fromCharCode(b))
										.join("");
									const newBase64Id = btoa(binaryStrForId);
									const { updateItemPathInContainer } =
										useContainerStore.getState();
									updateItemPathInContainer(
										renamePrompt.targetPath,
										newBase64Id,
										newPath,
										newName,
									);

									setTimeout(() => {
										fetchDesktopItems();
										fetchContainers();
									}, 500);
									useToastStore
										.getState()
										.addToast(t("desktop.renamed", { name: newName }), "success");
								} catch (err) {
									useToastStore
										.getState()
										.addToast(t("desktop.renameFailed") + String(err), "error");
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
									.addToast(t("desktop.copyHereSuccess"), "success");
							} catch (e) {
								console.error(e);
								useToastStore
									.getState()
									.addToast(t("desktop.copyHereFailed") + String(e), "error");
							}
						}}
					>
						{t("desktop.copyHere")}
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
									.addToast(t("desktop.moveHereSuccess"), "success");
							} catch (e) {
								console.error(e);
								useToastStore
									.getState()
									.addToast(t("desktop.moveHereFailed") + String(e), "error");
							}
						}}
					>
						{t("desktop.moveHere")}
					</button>
					<div className="h-[1px] bg-black/10 dark:bg-white/10 my-1" />
					<button
						className="px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors whitespace-nowrap"
						onClick={() => setDropPrompt(null)}
					>
						{t("common.cancel")}
					</button>
				</div>
			)}

			<div
				ref={desktopRef}
				className={`w-full h-full transition-opacity duration-300 ${isIconsHidden && settings.doubleClickHide !== false ? "opacity-0 pointer-events-none" : "opacity-100"}`}
				onClick={() => {
					if (dropPrompt) setDropPrompt(null);
				}}
			>
				<DesktopGrid>
					<GridOverlay />
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

			<WidgetSelectorDialog
				isOpen={widgetSelectorOpen}
				onClose={() => setWidgetSelectorOpen(false)}
				position={widgetSelectorPos}
			/>
		</div>
	);
}

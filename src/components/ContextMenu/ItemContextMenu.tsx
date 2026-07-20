import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Copy, Scissors, Trash2, Type } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { cn } from "@/utils/cn";
import { SubMenu } from "./SubMenu";
import type { MenuItem } from "./ContextMenu";

export interface ItemContextMenuProps {
	x: number;
	y: number;
	paths: string[];
	onClose: () => void;
	onRename?: () => void;
	customHeaderItems?: MenuItem[];
}

export function ItemContextMenu({
	x,
	y,
	paths,
	onClose,
	onRename,
	customHeaderItems,
}: ItemContextMenuProps) {
	const { t } = useTranslation();
	const menuRef = useRef<HTMLDivElement>(null);
	const [activeSubMenu, setActiveSubMenu] = useState<number | null>(null);
	const { settings } = useSettingsStore();
	const { wallpaper, fetchDesktopItems } = useDesktopStore();
	const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

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

	useLayoutEffect(() => {
		if (menuRef.current) {
			const rect = menuRef.current.getBoundingClientRect();
			const padding = 10;
			let newX = x;
			let newY = y;
			if (x + rect.width > window.innerWidth) {
				newX = Math.max(padding, window.innerWidth - rect.width - padding);
			}
			if (y + rect.height > window.innerHeight) {
				newY = Math.max(padding, window.innerHeight - rect.height - padding);
			}
			setCoords({ x: newX, y: newY });
		}
	}, [x, y, paths]);

	const handleCopy = async () => {
		try {
			await invoke("copy_files_to_clipboard", { paths });
			useToastStore
				.getState()
				.addToast(t("desktop.copiedFiles", { count: paths.length }), "success");
			onClose();
		} catch (e) {
			console.error(e);
			useToastStore.getState().addToast(t("desktop.copyFailed", { error: String(e) }), "error");
		}
	};

	const handleCut = async () => {
		// Currently no cut_files_to_clipboard. Fallback to copy.
		try {
			await invoke("copy_files_to_clipboard", { paths });
			useToastStore
				.getState()
				.addToast(t("desktop.cutFiles", { count: paths.length }), "success");
			onClose();
		} catch (e) {
			console.error(e);
			useToastStore.getState().addToast(t("desktop.cutFailed", { error: String(e) }), "error");
		}
	};

	const handleDelete = async () => {
		try {
			const results = await Promise.allSettled(
				paths.map((p) => invoke("trash_file", { path: p })),
			);
			const failed = results.filter((r) => r.status === "rejected");
			const succeeded = results.filter((r) => r.status === "fulfilled");
			// 即使部分文件删除失败（如文件已不存在），也从桌面/容器中移除条目
			fetchDesktopItems();
			// 清理容器内的幽灵条目（文件已不存在的引用）
			// 使用 check_files_exist 验证哪些文件真正不存在，避免误删权限错误的文件
			const succeededPaths = results
				.map((r, i) => (r.status === "fulfilled" ? paths[i] : null))
				.filter(Boolean) as string[];
				
			const failedPaths = results
				.map((r, i) => (r.status === "rejected" ? paths[i] : null))
				.filter(Boolean) as string[];

			const pathsToRemove = new Set(succeededPaths);

			if (failedPaths.length > 0) {
				try {
					const missingPaths = await invoke<string[]>("check_files_exist", { paths: failedPaths });
					for (const p of missingPaths) {
						pathsToRemove.add(p);
					}
				} catch (e) {
					console.warn("[handleDelete] 清理幽灵条目失败:", e);
				}
			}
			
			if (pathsToRemove.size > 0) {
				const containers = useContainerStore.getState().containers;
				for (const p of pathsToRemove) {
					for (const c of containers) {
						const ghost = c.items.find((i) => i.path === p);
						if (ghost) {
							useContainerStore
								.getState()
								.removeItemFromContainer(c.id, ghost.id);
						}
					}
				}
			}
			if (failed.length === 0) {
				useToastStore
					.getState()
					.addToast(t("desktop.deletedFiles", { count: succeeded.length }), "success");
			} else {
				useToastStore
					.getState()
					.addToast(
						t("desktop.deletedPartial", { succeeded: succeeded.length, failed: failed.length }),
						"warning",
					);
			}
			onClose();
		} catch (e) {
			console.error(e);
			useToastStore.getState().addToast(t("desktop.deleteFailed", { error: String(e) }), "error");
		}
	};

	const handleRename = () => {
		if (onRename) {
			onRename();
		}
		onClose();
	};

	const menuItems = [
		{
			label: t("item.open"),
			icon: <Icon icon="iconamoon:enter" />,
			onClick: () => {
				paths.forEach((p) => invoke("open_file", { path: p }));
			},
		},
		{
			label: t("item.runAsAdmin"),
			icon: <Icon icon="iconamoon:shield-yes" />,
			onClick: () => {
				paths.forEach((p) => invoke("run_as_admin", { path: p }));
			},
		},
		{
			label: t("item.openWith"),
			icon: <Icon icon="iconamoon:terminal" />,
			subItems: [
				{
					label: t("item.openFileLocation"),
					icon: <Icon icon="iconamoon:folder" />,
					onClick: () => {
						paths.forEach((p) => invoke("open_file_location", { path: p }));
					},
				},
				{
					label: t("item.openWithNotepad"),
					icon: <Icon icon="iconamoon:file-document" />,
					onClick: () => {
						paths.forEach((p) => invoke("open_with_notepad", { path: p }));
					},
				},
				{
					label: t("item.openWithCmd"),
					icon: <Icon icon="iconamoon:terminal" />,
					onClick: () => {
						if (paths.length > 0) {
							const dir =
								paths[0].substring(0, paths[0].lastIndexOf("\\")) || paths[0];
							invoke("open_terminal", { shell: "cmd", path: dir });
						}
					},
				},
				{
					label: t("item.openWithPowerShell"),
					icon: <Icon icon="iconamoon:terminal" />,
					onClick: () => {
						if (paths.length > 0) {
							const dir =
								paths[0].substring(0, paths[0].lastIndexOf("\\")) || paths[0];
							invoke("open_terminal", { shell: "powershell", path: dir });
						}
					},
				},
				{
					label: t("item.otherOpenWith"),
					icon: <Icon icon="iconamoon:apps" />,
					onClick: () => {
						paths.forEach((p) => invoke("show_open_with_dialog", { path: p }));
					},
				},
			],
		},
		{
			label: t("item.pinToTaskbar"),
			icon: <Icon icon="iconamoon:bookmark" />,
			onClick: () => {
				paths.forEach((p) => invoke("pin_to_taskbar", { path: p }));
			},
		},
		{
			label: t("item.copyPath"),
			icon: <Icon icon="iconamoon:copy" />,
			subItems: [
				{
					label: t("item.copyFileName", { name: paths.map((p) => p.substring(p.lastIndexOf("\\") + 1)).join(", ") }),
					icon: <Icon icon="iconamoon:file" />,
					onClick: async () => {
						const names = paths.map((p) =>
							p.substring(p.lastIndexOf("\\") + 1),
						);
						await navigator.clipboard.writeText(names.join("\n"));
					},
				},
				{
					label: t("item.copyPathNoQuote", { path: `${paths[0] || ""}${paths.length > 1 ? "..." : ""}` }),
					icon: <Icon icon="iconamoon:link" />,
					onClick: async () => {
						await navigator.clipboard.writeText(paths.join("\n"));
					},
				},
				{
					label: t("item.copyPathQuoted", { path: `"${paths[0] || ""}"${paths.length > 1 ? "..." : ""}` }),
					icon: <Icon icon="iconamoon:link" />,
					onClick: async () => {
						const quoted = paths.map((p) => `"${p}"`);
						await navigator.clipboard.writeText(quoted.join("\n"));
					},
				},
			],
		},
		{
			label: t("item.createShortcut"),
			icon: <Icon icon="iconamoon:link-external" />,
			onClick: () => {
				paths.forEach((p) => invoke("create_shortcut_item", { path: p }));
				setTimeout(() => fetchDesktopItems(), 1000);
			},
		},
		{
			label: t("item.properties"),
			icon: <Icon icon="iconamoon:settings" />,
			onClick: () => {
				paths.forEach((p) => invoke("show_properties_dialog", { path: p }));
			},
		},
	];

	return (
		<AnimatePresence>
			<motion.div
				ref={menuRef}
				onContextMenu={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
				initial={{ opacity: 0, scale: 0.95 }}
				animate={coords ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
				exit={{ opacity: 0, scale: 0.95 }}
				transition={{ duration: 0.1 }}
				className={cn(
					"fixed z-50 min-w-[200px] py-1 border shadow-2xl rounded-lg",
					settings.globalBlur === false
						? "bg-white dark:bg-[#1a1a1a] border-black/5 dark:border-white/10"
						: settings.wallpaperCompatible && wallpaper
							? "border-white/20 dark:border-white/10"
							: "bg-white/60 dark:bg-[#1a1a1a]/70 backdrop-blur-3xl border-white/20 dark:border-white/10",
				)}
				style={{
					left: coords ? coords.x : x,
					top: coords ? coords.y : y,
					visibility: coords ? "visible" : "hidden",
				}}
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

				{/* Render Custom Header Items */}
				{customHeaderItems && customHeaderItems.length > 0 && (
					<>
						{customHeaderItems.map((item, index) => (
							<button
								key={`custom-header-${index}`}
								onClick={() => {
									if (item.onClick) item.onClick();
									onClose();
								}}
								className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200"
							>
								{item.icon && <span className="w-3.5 h-3.5 flex items-center justify-center">{item.icon}</span>}
								<span>{item.label}</span>
							</button>
						))}
						<div className="h-px bg-black/5 dark:bg-white/10 mx-2 my-1" />
					</>
				)}

				{/* Top 4 Icons */}
				<div className="flex items-center justify-around px-2 py-1 mb-1">
					<button
						onClick={handleCopy}
						className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
					title={t("common.copy")}
				>
					<Copy size={16} />
				</button>
				<button
					onClick={handleCut}
					className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
					title={t("common.cut")}
				>
					<Scissors size={16} />
				</button>
				<button
					onClick={handleDelete}
					className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
					title={t("common.delete")}
				>
					<Trash2 size={16} />
				</button>
				<button
					onClick={handleRename}
					className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
					title={t("common.rename")}
					>
						<Type size={16} />
					</button>
				</div>

				<div className="h-px bg-black/5 dark:bg-white/10 mx-2 mb-1" />

				{menuItems.map((item, index) => {
					const hasSub = item.subItems && item.subItems.length > 0;
					const isActive = activeSubMenu === index;
					const finalX = coords ? coords.x : x;
					const showOnLeft = finalX > window.innerWidth / 2;
					const key = item.label || `item-${index}`;

					return (
						<div
							key={key}
							className="relative"
							onPointerEnter={() => setActiveSubMenu(index)}
						>
							<button
								onClick={() => {
									if (!hasSub && item.onClick) {
										item.onClick();
										onClose();
									}
								}}
								className={cn(
									"w-full flex items-center justify-between px-3 py-1 text-xs text-left transition-colors",
									"hover:bg-black/5 dark:hover:bg-white/10",
									isActive && hasSub ? "bg-black/5 dark:bg-white/10" : "",
									"cursor-default text-gray-800 dark:text-gray-200",
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

							{hasSub && isActive && (
								<SubMenu
									items={item.subItems!}
									showOnLeft={showOnLeft}
									onClose={onClose}
									settings={settings}
									wallpaper={wallpaper}
									className="min-w-[180px]"
								/>
							)}
						</div>
					);
				})}
			</motion.div>
		</AnimatePresence>
	);
}

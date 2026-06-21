import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { Container, Position, Size } from "@/types/container";
import type { Item } from "@/types/item";
import { useHistoryStore } from "./historyStore";
import { useToastStore } from "./toastStore";

// 每个容器独立的防抖定时器，避免拖拽/调整大小时每帧都触发数据库写入
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const persistContainer = async (container: Container) => {
	// 清除该容器之前的定时器
	const existing = debounceTimers.get(container.id);
	if (existing) clearTimeout(existing);

	// 300ms 防抖：只有最后一次调用才真正写入数据库
	const timer = setTimeout(async () => {
		debounceTimers.delete(container.id);
		try {
			await invoke("update_container_full", { container });
		} catch (err) {
			console.error("Failed to persist container:", err);
		}
	}, 300);
	debounceTimers.set(container.id, timer);
};

interface ContainerState {
	containers: Container[];
	isLoading: boolean;
	error: string | null;

	// Actions
	fetchContainers: () => Promise<void>;
	createContainer: (
		name: string,
		type: Container["type"],
		position: Position,
		folderPath?: string,
	) => Promise<Container>;
	updateContainerPosition: (id: string, position: Position) => void;
	updateContainerSize: (id: string, size: Size) => void;
	updateContainerGeometry: (
		id: string,
		position: Position,
		size: Size,
	) => void;
	updateContainerStyle: (
		id: string,
		style: Partial<Container["style"]>,
	) => void;
	updateContainerName: (id: string, name: string) => void;
	deleteContainer: (id: string) => Promise<void>;
	addItemToContainer: (containerId: string, item: Item, silent?: boolean) => void;
	addItemsToContainer: (
		containerId: string,
		items: Item[],
		silent?: boolean,
	) => void;
	removeItemFromContainer: (containerId: string, itemId: string) => void;
	updateItemPositionInContainer: (
		containerId: string,
		itemId: string,
		position: { x: number; y: number },
	) => void;
	reorderItemsInContainer: (
		containerId: string,
		index1: number,
		index2: number,
	) => void;
	updateItemPathInContainer: (
		oldPath: string,
		newId: string,
		newPath: string,
		newName: string,
	) => void;
}

export const useContainerStore = create<ContainerState>((set, get) => ({
	containers: [],
	isLoading: false,
	error: null,

	fetchContainers: async () => {
		useHistoryStore.getState().clearHistory();
		set({ isLoading: true, error: null });
		try {
			const fetchPromise = invoke<Container[]>("get_all_containers");
			const timeoutPromise = new Promise<Container[]>((_, reject) =>
				setTimeout(() => reject(new Error("Timeout loading containers")), 5000),
			);
			let containers = await Promise.race([fetchPromise, timeoutPromise]);

			// 先设置容器数据，确保即使清理失败也能加载
			set({ containers });

			// 自动清理幽灵条目（文件已不存在的引用）
			// 排除系统图标（此电脑、回收站等），它们的 shell::: 伪路径不会通过文件系统检查
			const allPaths = containers.flatMap((c) => c.items.filter((i) => i.type !== "system").map((i) => i.path));
			if (allPaths.length > 0) {
				try {
					const missingPaths = await invoke<string[]>("check_files_exist", { paths: allPaths });
					if (missingPaths.length > 0) {
						const missingSet = new Set(missingPaths);
						const cleanedContainers = containers.map((c) => ({
							...c,
							items: c.items.filter((i) => !missingSet.has(i.path)),
						}));
						// 持久化被修改的容器
						for (const c of cleanedContainers) {
							const original = containers.find((oc) => oc.id === c.id);
							if (original && original.items.length !== c.items.length) {
								await invoke("update_container_full", { container: c });
							}
						}
						set({ containers: cleanedContainers });
					}
				} catch (e) {
					console.warn("[fetchContainers] 清理幽灵条目失败:", e);
				}
			}
		} catch (err: any) {
			console.error("fetchContainers error:", err);
			set({ error: err.toString() });
		} finally {
			set({ isLoading: false });
		}
	},

	createContainer: async (name, type, position, folderPath) => {
		useHistoryStore.getState().pushState();
		try {
			let finalName = name;
			const existingNames = get().containers.map((c) => c.name);
			if (existingNames.includes(finalName)) {
				let counter = 2;
				while (existingNames.includes(`${name} (${counter})`)) {
					counter++;
				}
				finalName = `${name} (${counter})`;
			}

			const newContainer = await invoke<Container>("create_container", {
				name: finalName,
				containerType: type,
				position,
			});
			if (folderPath) {
				newContainer.folderPath = folderPath;
				if (type === "folder") {
					newContainer.style = {
						...newContainer.style,
						layout: "list",
						sortBy: "name",
						sortDesc: false,
						showDetails: true,
					};
				}
				await invoke("update_container_full", { container: newContainer });
			}
			set((state) => ({ containers: [...state.containers, newContainer] }));
			const updated = get().containers.find((c) => c.id === newContainer.id);
			if (updated && !folderPath) persistContainer(updated); // folderPath case already persisted
			return updated ?? newContainer;
		} catch (err: any) {
			console.error(err);
			window.alert("创建收纳盒容器失败: " + String(err));
			throw err;
		}
	},

	updateContainerPosition: (id, position) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) =>
				c.id === id ? { ...c, position } : c,
			),
		}));
		const updated = get().containers.find((c) => c.id === id);
		if (updated) persistContainer(updated);
	},

	updateContainerSize: (id, size) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) =>
				c.id === id ? { ...c, size } : c,
			),
		}));
		const updated = get().containers.find((c) => c.id === id);
		if (updated) persistContainer(updated);
	},

	updateContainerGeometry: (id, position, size) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) =>
				c.id === id ? { ...c, position, size } : c,
			),
		}));
		const updated = get().containers.find((c) => c.id === id);
		if (updated) persistContainer(updated);
	},

	updateContainerStyle: (id, style) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) =>
				c.id === id ? { ...c, style: { ...c.style, ...style } } : c,
			),
		}));
		const updated = get().containers.find((c) => c.id === id);
		if (updated) persistContainer(updated);
	},

	updateContainerName: (id, name) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) =>
				c.id === id ? { ...c, name } : c,
			),
		}));
		const updated = get().containers.find((c) => c.id === id);
		if (updated) {
			persistContainer(updated);
			useToastStore.getState().addToast(`已重命名为 "${name}"`, "success");
		}
	},

	deleteContainer: async (id) => {
		useHistoryStore.getState().pushState();
		try {
			const container = get().containers.find((c) => c.id === id);
			const containerName = container ? container.name : "";
			const containerType = container ? container.type : "normal";

			await invoke("delete_container", { id });
			set((state) => ({
				containers: state.containers.filter((c) => c.id !== id),
			}));

			const typeText = containerType === "game" ? "游戏容器" : "收纳盒";
			useToastStore.getState().addToast(`已移除${typeText} ${containerName}`, "success");

			const { useDesktopStore } = await import("./desktopStore");
			await useDesktopStore.getState().fetchDesktopItems();
		} catch (err: any) {
			console.error(err);
		}
	},

	addItemToContainer: (containerId, item, silent = false) => {
		get().addItemsToContainer(containerId, [item], silent);
	},

	addItemsToContainer: (containerId, items, silent = false) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) => {
				if (c.id === containerId) {
					const newItems = items.map((item) => ({
						...item,
						isInContainer: true,
						containerId,
						position: undefined,
					}));
					return { ...c, items: [...c.items, ...newItems] };
				}
				return c;
			}),
		}));
		const updated = get().containers.find((c) => c.id === containerId);
		if (updated) {
			persistContainer(updated);
			if (!silent && items.length > 0) {
				const msg = items.length === 1 ? `已收纳至 "${updated.name}"` : `已收纳 ${items.length} 个项目至 "${updated.name}"`;
				useToastStore.getState().addToast(msg, "success");
			}
		}
	},

	removeItemFromContainer: (containerId, itemId) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) => {
				if (c.id === containerId) {
					return { ...c, items: c.items.filter((i) => i.id !== itemId) };
				}
				return c;
			}),
		}));
		const updated = get().containers.find((c) => c.id === containerId);
		if (updated) persistContainer(updated);
	},

	updateItemPositionInContainer: (containerId, itemId, position) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) => {
				if (c.id === containerId) {
					return {
						...c,
						items: c.items.map((i) =>
							i.id === itemId ? { ...i, position } : i,
						),
					};
				}
				return c;
			}),
		}));
		const updated = get().containers.find((c) => c.id === containerId);
		if (updated) persistContainer(updated);
	},

	reorderItemsInContainer: (containerId, index1, index2) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) => {
				if (c.id === containerId) {
					const newItems = [...c.items];
					const temp = newItems[index1];
					newItems[index1] = newItems[index2];
					newItems[index2] = temp;
					return { ...c, items: newItems };
				}
				return c;
			}),
		}));
		const updated = get().containers.find((c) => c.id === containerId);
		if (updated) persistContainer(updated);
	},

	updateItemPathInContainer: (oldPath, newId, newPath, newName) => {
		set((state) => ({
			containers: state.containers.map((c) => {
				const itemIndex = c.items.findIndex((i) => i.path === oldPath);
				if (itemIndex === -1) return c;
				const newItems = [...c.items];
				newItems[itemIndex] = {
					...newItems[itemIndex],
					id: newId,
					path: newPath,
					name: newName,
				};
				return { ...c, items: newItems };
			}),
		}));
		// 持久化所有被修改的容器
		const containers = get().containers;
		for (const c of containers) {
			if (c.items.some((i) => i.path === newPath)) {
				persistContainer(c);
			}
		}
	},
}));

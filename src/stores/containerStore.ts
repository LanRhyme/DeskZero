import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { Container, Position, Size } from "@/types/container";
import type { Item } from "@/types/item";
import { useHistoryStore } from "./historyStore";

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
	updateContainerStyle: (
		id: string,
		style: Partial<Container["style"]>,
	) => void;
	updateContainerName: (id: string, name: string) => void;
	deleteContainer: (id: string) => Promise<void>;
	addItemToContainer: (containerId: string, item: Item) => void;
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
			const containers = await Promise.race([fetchPromise, timeoutPromise]);
			set({ containers });
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
		if (updated) persistContainer(updated);
	},

	deleteContainer: async (id) => {
		useHistoryStore.getState().pushState();
		try {
			await invoke("delete_container", { id });
			set((state) => ({
				containers: state.containers.filter((c) => c.id !== id),
			}));
			// Release items back to desktop
			const { useDesktopStore } = await import("./desktopStore");
			useDesktopStore.getState().fetchDesktopItems();
		} catch (err: any) {
			console.error(err);
		}
	},

	addItemToContainer: (containerId, item) => {
		useHistoryStore.getState().pushState();
		set((state) => ({
			containers: state.containers.map((c) => {
				if (c.id === containerId) {
					const newItem = {
						...item,
						isInContainer: true,
						containerId,
						position: undefined,
					};
					return { ...c, items: [...c.items, newItem] };
				}
				return c;
			}),
		}));
		const updated = get().containers.find((c) => c.id === containerId);
		if (updated) persistContainer(updated);
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
}));

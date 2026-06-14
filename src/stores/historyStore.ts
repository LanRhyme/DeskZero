import { create } from "zustand";
import { useDesktopStore } from "./desktopStore";
import { useContainerStore } from "./containerStore";
import { invoke } from "@tauri-apps/api/core";
import type { DesktopItem } from "./desktopStore";
import type { Container } from "@/types/container";

export interface HistorySnapshot {
	desktopItems: DesktopItem[];
	containers: Container[];
}

interface HistoryState {
	undoStack: HistorySnapshot[];
	redoStack: HistorySnapshot[];
	pushState: () => void;
	undo: () => Promise<void>;
	redo: () => Promise<void>;
	clearHistory: () => void;
}

// 500ms 磁盘持久化防抖定时器，确保狂按 Ctrl + Z 时的零 I/O 阻塞
let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// 滚动时间戳，用于拦截高频拖拽/调整容器大小时的无节制快照生成
let lastPushTime = 0;

async function debouncedPersistState(desktopItems: DesktopItem[], containers: Container[]) {
	if (persistDebounceTimer) clearTimeout(persistDebounceTimer);

	persistDebounceTimer = setTimeout(async () => {
		persistDebounceTimer = null;

		// 1. 同步桌面图标坐标
		const layoutRecord: Record<string, { x: number; y: number }> = {};
		for (const item of desktopItems) {
			if (!item.isInContainer && item.position) {
				layoutRecord[item.id] = item.position;
			}
		}
		try {
			await invoke("save_desktop_layout", { layout: layoutRecord });
		} catch (e) {
			console.error("[DeskZero] Undo/Redo: Failed to save layout", e);
		}
		localStorage.setItem("deskzero_layout", JSON.stringify(layoutRecord));

		// 2. 同步容器的最新状态
		try {
			for (const c of containers) {
				await invoke("update_container_full", { container: c });
			}
		} catch (e) {
			console.error("[DeskZero] Undo/Redo: Failed to update container", e);
		}
	}, 500);
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
	undoStack: [],
	redoStack: [],

	pushState: () => {
		const now = Date.now();
		// 如果距离上一次 pushState 间隔小于 800ms，判定为连续的拖拽/拉伸中间过程，我们直接拦截。
		// 这样在一整段连续操作中，仅在第一帧（动作开始前）记录唯一的原始位置快照。
		if (now - lastPushTime < 800) {
			lastPushTime = now; // 维持连续滑动窗口的判断
			return;
		}
		lastPushTime = now;

		const desktopItems = useDesktopStore.getState().items;
		const containers = useContainerStore.getState().containers;

		// 深拷贝快照，避免 React 引用状态污染
		const snapshot: HistorySnapshot = JSON.parse(
			JSON.stringify({
				desktopItems,
				containers,
			})
		);

		const { undoStack } = get();
		const newUndoStack = [...undoStack, snapshot];
		
		// 限制容量在 50 步，保障内存健康
		if (newUndoStack.length > 50) {
			newUndoStack.shift();
		}

		set({
			undoStack: newUndoStack,
			redoStack: [], // 只要有新的非撤销修改发生，清空重做栈
		});
	},

	undo: async () => {
		const { undoStack, redoStack } = get();
		if (undoStack.length === 0) return;

		const currentSnapshot: HistorySnapshot = JSON.parse(
			JSON.stringify({
				desktopItems: useDesktopStore.getState().items,
				containers: useContainerStore.getState().containers,
			})
		);

		const prevSnapshot = undoStack[undoStack.length - 1];
		const newUndoStack = undoStack.slice(0, -1);

		// 瞬发重做/撤销后，重置滚动窗口时间限制，使用户接下来的第一步操作能立刻压栈
		lastPushTime = 0;

		// 1. 瞬发式回滚内存中的 UI 状态（性能最快，零延迟渲染）
		useDesktopStore.setState({ items: prevSnapshot.desktopItems });
		useContainerStore.setState({ containers: prevSnapshot.containers });

		// 2. 防抖异步写入磁盘
		debouncedPersistState(prevSnapshot.desktopItems, prevSnapshot.containers);

		set({
			undoStack: newUndoStack,
			redoStack: [...redoStack, currentSnapshot],
		});
	},

	redo: async () => {
		const { undoStack, redoStack } = get();
		if (redoStack.length === 0) return;

		const currentSnapshot: HistorySnapshot = JSON.parse(
			JSON.stringify({
				desktopItems: useDesktopStore.getState().items,
				containers: useContainerStore.getState().containers,
			})
		);

		const nextSnapshot = redoStack[redoStack.length - 1];
		const newRedoStack = redoStack.slice(0, -1);

		// 重置滚动窗口时间限制
		lastPushTime = 0;

		// 1. 瞬发式重做内存状态
		useDesktopStore.setState({ items: nextSnapshot.desktopItems });
		useContainerStore.setState({ containers: nextSnapshot.containers });

		// 2. 防抖异步写入磁盘
		debouncedPersistState(nextSnapshot.desktopItems, nextSnapshot.containers);

		set({
			undoStack: [...undoStack, currentSnapshot],
			redoStack: newRedoStack,
		});
	},

	clearHistory: () => {
		lastPushTime = 0;
		set({ undoStack: [], redoStack: [] });
	},
}));

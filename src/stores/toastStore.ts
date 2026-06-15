import { create } from "zustand";

export interface Toast {
	id: string;
	message: string;
	type?: "info" | "success" | "error" | "warning" | "loading";
	duration?: number;
}

interface ToastState {
	toasts: Toast[];
	addToast: (message: string, type?: Toast["type"], duration?: number) => string;
	removeToast: (id: string) => void;
	updateToast: (id: string, updates: Partial<Omit<Toast, "id">>) => void;
}

// 缓存所有 Toast 的自动关闭定时器，防范多次更新导致的定时器冲突
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],

	addToast: (message, type = "info", duration?: number) => {
		const id = Math.random().toString(36).substring(2, 9);
		
		const finalDuration = type === "loading" && duration === undefined ? 0 : (duration ?? 3000);

		set((state) => ({
			toasts: [...state.toasts, { id, message, type, duration: finalDuration }],
		}));

		if (finalDuration > 0) {
			const timer = setTimeout(() => {
				set((state) => ({
					toasts: state.toasts.filter((t) => t.id !== id),
				}));
				toastTimers.delete(id);
			}, finalDuration);
			toastTimers.set(id, timer);
		}

		return id;
	},

	removeToast: (id) => {
		const timer = toastTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			toastTimers.delete(id);
		}
		set((state) => ({
			toasts: state.toasts.filter((t) => t.id !== id),
		}));
	},

	updateToast: (id, updates) => {
		set((state) => {
			const index = state.toasts.findIndex((t) => t.id === id);
			if (index === -1) return {};

			const oldToast = state.toasts[index];
			const newToast = { ...oldToast, ...updates };

			const newToasts = [...state.toasts];
			newToasts[index] = newToast;

			// 如果更新了消息类型或持续时间，需重置并更新关闭定时器
			const hasTypeChanged = updates.type !== undefined;
			const hasDurationChanged = updates.duration !== undefined;

			if (hasTypeChanged || hasDurationChanged) {
				const existingTimer = toastTimers.get(id);
				if (existingTimer) {
					clearTimeout(existingTimer);
					toastTimers.delete(id);
				}

				const newDuration = updates.duration !== undefined ? updates.duration : oldToast.duration;
				if (newDuration && newDuration > 0) {
					const timer = setTimeout(() => {
						set((s) => ({
							toasts: s.toasts.filter((t) => t.id !== id),
						}));
						toastTimers.delete(id);
					}, newDuration);
					toastTimers.set(id, timer);
				}
			}

			return { toasts: newToasts };
		});
	},
}));

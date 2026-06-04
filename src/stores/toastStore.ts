import { create } from "zustand";

export interface Toast {
	id: string;
	message: string;
	type?: "info" | "success" | "error" | "warning";
	duration?: number;
}

interface ToastState {
	toasts: Toast[];
	addToast: (message: string, type?: Toast["type"], duration?: number) => void;
	removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	addToast: (message, type = "info", duration = 3000) => {
		const id = Math.random().toString(36).substring(2, 9);
		set((state) => ({
			toasts: [...state.toasts, { id, message, type, duration }],
		}));

		if (duration > 0) {
			setTimeout(() => {
				set((state) => ({
					toasts: state.toasts.filter((t) => t.id !== id),
				}));
			}, duration);
		}
	},
	removeToast: (id) =>
		set((state) => ({
			toasts: state.toasts.filter((t) => t.id !== id),
		})),
}));

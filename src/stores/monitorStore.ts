import { create } from "zustand";
import type { Monitor } from "@/types/monitor";
import { getMonitors, refreshMonitors } from "@/services/monitorService";

interface MonitorState {
	monitors: Monitor[];
	currentMonitorId: string | null;
	isLoading: boolean;
	error: string | null;

	// Actions
	fetchMonitors: () => Promise<void>;
	refreshMonitors: () => Promise<void>;
	setCurrentMonitor: (monitorId: string | null) => void;
	getMonitorById: (id: string) => Monitor | undefined;
	getPrimaryMonitor: () => Monitor | undefined;
	findMonitorForPoint: (x: number, y: number) => Monitor | undefined;
}

export const useMonitorStore = create<MonitorState>((set, get) => ({
	monitors: [],
	currentMonitorId: null,
	isLoading: false,
	error: null,

	fetchMonitors: async () => {
		set({ isLoading: true, error: null });
		try {
			const monitors = await getMonitors();
			set({ monitors, isLoading: false });
		} catch (err) {
			set({ error: String(err), isLoading: false });
		}
	},

	refreshMonitors: async () => {
		set({ isLoading: true, error: null });
		try {
			const monitors = await refreshMonitors();
			set({ monitors, isLoading: false });
		} catch (err) {
			set({ error: String(err), isLoading: false });
		}
	},

	setCurrentMonitor: (monitorId) => {
		set({ currentMonitorId: monitorId });
	},

	getMonitorById: (id) => {
		return get().monitors.find((m) => m.id === id);
	},

	getPrimaryMonitor: () => {
		return get().monitors.find((m) => m.isPrimary);
	},

	findMonitorForPoint: (x, y) => {
		const { monitors } = get();
		return monitors.find(
			(m) =>
				x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height,
		);
	},
}));

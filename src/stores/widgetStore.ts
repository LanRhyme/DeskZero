import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { WidgetMeta } from "@/types/widget";
import { useSettingsStore } from "./settingsStore";

export interface CustomWidgetEntry {
  htmlPath: string;
  name: string;
  meta?: WidgetMeta;
}

interface WidgetState {
  customWidgets: CustomWidgetEntry[];
  isLoading: boolean;

  fetchCustomWidgets: () => Promise<void>;
  addCustomWidget: (entry: CustomWidgetEntry) => void;
  removeCustomWidget: (htmlPath: string) => void;
  updateCustomWidgetMeta: (htmlPath: string, meta: WidgetMeta) => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const persistCustomWidgets = (widgets: CustomWidgetEntry[]) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      // 通过 settingsStore 同步更新，避免与 settingsStore 的写入竞态
      useSettingsStore.getState().saveSettings({ customWidgets: widgets });
    } catch (e) {
      console.error("持久化自定义小组件列表失败:", e);
    }
  }, 300);
};

export const useWidgetStore = create<WidgetState>((set) => ({
  customWidgets: [],
  isLoading: false,

  fetchCustomWidgets: async () => {
    set({ isLoading: true });
    try {
      const settings = await invoke<any>("get_settings");
      set({ customWidgets: settings.customWidgets || [] });
    } catch (e) {
      console.error("加载自定义小组件列表失败:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  addCustomWidget: (entry) => {
    set((state) => {
      const exists = state.customWidgets.some((w) => w.htmlPath === entry.htmlPath);
      if (exists) return state;
      const updated = [...state.customWidgets, entry];
      persistCustomWidgets(updated);
      return { customWidgets: updated };
    });
  },

  removeCustomWidget: (htmlPath) => {
    set((state) => {
      const updated = state.customWidgets.filter((w) => w.htmlPath !== htmlPath);
      persistCustomWidgets(updated);
      return { customWidgets: updated };
    });
  },

  updateCustomWidgetMeta: (htmlPath, meta) => {
    set((state) => {
      const updated = state.customWidgets.map((w) =>
        w.htmlPath === htmlPath ? { ...w, meta } : w,
      );
      persistCustomWidgets(updated);
      return { customWidgets: updated };
    });
  },
}));

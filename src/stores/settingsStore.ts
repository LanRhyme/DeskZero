import { create } from 'zustand'
import type { Settings } from '@/types/settings'
import { invoke } from '@tauri-apps/api/core'

interface SettingsState {
  settings: Settings
  loading: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<Settings>) => Promise<void>
}

const defaultSettings: Settings = {
  theme: 'system',
  accentColor: '#0078d4',
  gridEnabled: true,
  gridSize: 80,
  iconSize: 'medium',
  cornerRadius: 10,
  backgroundBlur: true,
  wallpaperCompatible: true,
  itemBackground: 'transparent',
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    try {
      const settings = await invoke<Settings>('get_settings')
      set({ settings, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  saveSettings: async (changes) => {
    const newSettings = { ...get().settings, ...changes }
    set({ settings: newSettings })
    try {
      await invoke('save_settings', { settings: newSettings })
    } catch (err) {
      console.error('保存设置失败:', err)
    }
  },
}))

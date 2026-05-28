import { create } from 'zustand'
import type { Settings, Theme } from '@/types/settings'
import { invoke } from '@tauri-apps/api/core'

interface SettingsState {
  settings: Settings
  loading: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<Settings>) => Promise<void>
  applyTheme: (theme: Theme) => void
  initThemeListener: () => () => void
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
  selectedItemBackground: 'white',
  selectedItemBlur: false,
  globalBlur: true,
}

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.setAttribute('data-theme', systemTheme)
  } else {
    root.setAttribute('data-theme', theme)
  }
}

const applySelectedBackground = (background: 'white' | 'black') => {
  document.documentElement.setAttribute('data-selected-bg', background)
}

const applyGlobalBlur = (enabled: boolean) => {
  document.documentElement.setAttribute('data-global-blur', String(enabled))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    try {
      const settings = await invoke<Settings>('get_settings')
      set({ settings, loading: false })
      applyTheme(settings.theme)
      applySelectedBackground(settings.selectedItemBackground)
      applyGlobalBlur(settings.globalBlur)
    } catch {
      set({ loading: false })
    }
  },

  saveSettings: async (changes) => {
    const newSettings = { ...get().settings, ...changes }
    set({ settings: newSettings })
    try {
      await invoke('save_settings', { settings: newSettings })
      
      if (changes.theme) {
        applyTheme(newSettings.theme)
      }
      if (changes.selectedItemBackground) {
        applySelectedBackground(newSettings.selectedItemBackground)
      }
      if (changes.globalBlur !== undefined) {
        applyGlobalBlur(newSettings.globalBlur)
      }
    } catch (err) {
      console.error('保存设置失败:', err)
    }
  },

  applyTheme: (theme: Theme) => {
    applyTheme(theme)
  },

  initThemeListener: () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      const settings = get().settings
      if (settings.theme === 'system') {
        applyTheme('system')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }
}))

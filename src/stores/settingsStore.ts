import { create } from 'zustand'
import type { Settings, Theme } from '@/types/settings'
import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'

interface SettingsState {
  settings: Settings
  loading: boolean
  error: string | null
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<Settings>) => Promise<void>
  applyTheme: (theme: Theme) => void
  initThemeListener: () => () => void
}

const defaultSettings: Settings = {
  theme: 'system',
  accentColor: '#0078d4',
  gridEnabled: true,
  gridWidth: 80,
  gridHeight: 104,
  gridGapX: 20,
  gridGapY: 20,
  iconSize: 'medium',
  cornerRadius: 10,
  backgroundBlur: true,
  wallpaperCompatible: false,
  itemBackground: 'transparent',
  selectedItemBackground: 'white',
  selectedItemBlur: false,
  globalBlur: true,
  fontSize: 12,
  iconGlow: false,
  iconGlowRadius: 12,
  iconGlowIntensity: 0.6,
  doubleClickHide: true,
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
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null })
    try {
      const settings = await invoke<Settings>('get_settings')
      set({ settings, loading: false })
      applyTheme(settings.theme)
      applySelectedBackground(settings.selectedItemBackground)
      applyGlobalBlur(settings.globalBlur)
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载设置失败'
      set({ loading: false, error: message })
      console.error('加载设置失败:', err)
    }
  },

  saveSettings: async (changes) => {
    const newSettings = { ...get().settings, ...changes }
    set({ settings: newSettings, error: null })
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
      
      // 发送设置更新事件，通知其他窗口
      await emit('settings-updated', newSettings)
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存设置失败'
      set({ error: message })
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
    
    // 监听设置更新事件
    const unlisten = listen<Settings>('settings-updated', (event) => {
      const newSettings = event.payload
      set({ settings: newSettings })
      applyTheme(newSettings.theme)
      applySelectedBackground(newSettings.selectedItemBackground)
      applyGlobalBlur(newSettings.globalBlur)
    })
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      unlisten.then(fn => fn())
    }
  }
}))

import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

export function useTheme() {
  const { settings } = useSettingsStore()

  useEffect(() => {
    const applyTheme = () => {
      let theme = settings.theme
      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      }
      document.documentElement.setAttribute('data-theme', theme)
    }

    applyTheme()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (settings.theme === 'system') {
        applyTheme()
      }
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [settings.theme])
}

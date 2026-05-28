import { useEffect } from 'react'
import DesktopLayer from '@/components/Desktop/DesktopLayer'
import { SettingsPage } from '@/components/Settings/SettingsPage'
import { useSettingsStore } from '@/stores/settingsStore'

function App() {
  const isSettings = window.location.pathname === '/settings'
  const { loadSettings, initThemeListener } = useSettingsStore()

  useEffect(() => {
    loadSettings()
    const cleanup = initThemeListener()
    return cleanup
  }, [loadSettings, initThemeListener])

  if (isSettings) {
    return <SettingsPage />
  }

  return <DesktopLayer />
}

export default App

import DesktopLayer from '@/components/Desktop/DesktopLayer'
import { SettingsPage } from '@/components/Settings/SettingsPage'

function App() {
  const isSettings = window.location.pathname === '/settings'

  if (isSettings) {
    return <SettingsPage />
  }

  return <DesktopLayer />
}

export default App

import { useEffect } from 'react'
import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import Container from '@/components/Container/Container'

export default function DesktopLayer() {
  const { containers, loadContainers, moveContainer } = useContainerStore()
  const { loadSettings } = useSettingsStore()

  useEffect(() => {
    loadContainers()
    loadSettings()
  }, [])

  return (
    <div
      className="w-screen h-screen relative select-none"
      style={{ background: 'transparent' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {containers.map((container) => (
        <Container
          key={container.id}
          container={container}
          onMove={(pos) => moveContainer(container.id, pos)}
        />
      ))}
    </div>
  )
}

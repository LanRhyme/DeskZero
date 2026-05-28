import { useEffect, useState, useCallback } from 'react'
import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTheme } from '@/hooks/useTheme'
import Container from '@/components/Container/Container'
import ContextMenu from '@/components/ContextMenu/ContextMenu'
import SettingsPanel from '@/components/Settings/SettingsPanel'
import { scanDesktopIcons } from '@/services/desktopService'
import type { Item } from '@/types/item'
import FileItem from '@/components/Item/FileItem'
import FolderItem from '@/components/Item/FolderItem'
import ShortcutItem from '@/components/Item/ShortcutItem'

interface MenuState {
  visible: boolean
  x: number
  y: number
}

function renderDesktopItem(item: Item) {
  switch (item.type) {
    case 'folder':
      return <FolderItem key={item.id} item={item} />
    case 'shortcut':
      return <ShortcutItem key={item.id} item={item} />
    default:
      return <FileItem key={item.id} item={item} />
  }
}

export default function DesktopLayer() {
  const { containers, loadContainers, moveContainer, createContainer } = useContainerStore()
  const { loadSettings } = useSettingsStore()
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0 })
  const [showSettings, setShowSettings] = useState(false)
  const [desktopIcons, setDesktopIcons] = useState<Item[]>([])

  useTheme()

  useEffect(() => {
    loadContainers()
    loadSettings()
    loadDesktopIcons()
  }, [])

  const loadDesktopIcons = async () => {
    try {
      const icons = await scanDesktopIcons()
      setDesktopIcons(icons)
    } catch (err) {
      console.error('扫描桌面图标失败:', err)
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ visible: true, x: e.clientX, y: e.clientY })
  }, [])

  const closeMenu = useCallback(() => {
    setMenu((prev) => ({ ...prev, visible: false }))
  }, [])

  const desktopMenuItems = [
    {
      label: '新建普通容器',
      onClick: () => createContainer('新容器', 'normal', { x: menu.x, y: menu.y }),
    },
    {
      label: '新建映射容器',
      onClick: () => createContainer('映射容器', 'mapping', { x: menu.x, y: menu.y }),
    },
    {
      label: '新建文件夹容器',
      onClick: () => createContainer('文件夹容器', 'folder', { x: menu.x, y: menu.y }),
    },
    {
      label: '刷新桌面图标',
      onClick: loadDesktopIcons,
    },
    {
      label: '设置',
      onClick: () => setShowSettings(true),
    },
  ]

  return (
    <div
      className="w-screen h-screen relative select-none"
      style={{ background: 'transparent' }}
      onContextMenu={handleContextMenu}
      onClick={closeMenu}
    >
      {/* 桌面图标层 - 散布在桌面上 */}
      <div className="flex flex-wrap gap-4 p-6">
        {desktopIcons.map(renderDesktopItem)}
      </div>

      {/* 容器层 */}
      {containers.map((container) => (
        <Container
          key={container.id}
          container={container}
          onMove={(pos) => moveContainer(container.id, pos)}
        />
      ))}

      {menu.visible && (
        <ContextMenu
          items={desktopMenuItems}
          position={{ x: menu.x, y: menu.y }}
          onClose={closeMenu}
        />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

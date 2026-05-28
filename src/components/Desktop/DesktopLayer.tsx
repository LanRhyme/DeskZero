import { useState, useCallback, useEffect } from 'react'
import { useContainerStore } from '@/stores/containerStore'
import { useDesktopStore } from '@/stores/desktopStore'
import { Container } from '@/components/Container/Container'
import { FileItem } from '@/components/Item/FileItem'
import { DesktopGrid } from './DesktopGrid'
import { ContextMenu, type MenuItem } from '@/components/ContextMenu/ContextMenu'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

export default function DesktopLayer() {
  const { containers, fetchContainers, createContainer } = useContainerStore()
  const { items, fetchDesktopItems } = useDesktopStore()
  const [menuState, setMenuState] = useState<{visible: boolean, x: number, y: number}>({ visible: false, x: 0, y: 0 })
  
  useEffect(() => {
    fetchContainers()
    fetchDesktopItems()
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuState({ visible: true, x: e.clientX, y: e.clientY })
  }, [])

  const desktopMenuItems: MenuItem[] = [
    { label: '刷新桌面', onClick: () => fetchDesktopItems() },
    { divider: true, onClick: () => {} },
    { label: '新建收纳盒', onClick: () => createContainer('新收纳盒', 'normal', { x: menuState.x, y: menuState.y }) },
    { label: '新建文件夹收纳盒', onClick: () => createContainer('新文件夹', 'folder', { x: menuState.x, y: menuState.y }) },
    { divider: true, onClick: () => {} },
    { label: '系统设置', onClick: () => {
        // Open Settings Window
        new WebviewWindow('settings', {
          url: '/settings',
          title: 'DeskZero Settings',
          width: 800,
          height: 600,
          resizable: true,
          decorations: false,
          transparent: true
        })
      } 
    },
  ]

  return (
      <div 
        className="w-screen h-screen relative overflow-hidden select-none pointer-events-auto"
        style={{ backgroundColor: 'rgba(0,0,0,0.01)' }}
        onContextMenu={handleContextMenu}
      >
        <DesktopGrid>
          {/* Render Desktop Items */}
          {items.filter(i => !i.isInContainer).map(item => (
            <FileItem key={item.id} item={item} />
          ))}
          
          {/* Render Containers */}
          {containers.map(container => (
            <Container key={container.id} container={container} />
          ))}
        </DesktopGrid>

        {menuState.visible && (
          <ContextMenu 
            x={menuState.x} 
            y={menuState.y} 
            items={desktopMenuItems} 
            onClose={() => setMenuState(prev => ({...prev, visible: false}))} 
          />
        )}
      </div>
  )
}

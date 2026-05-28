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
  const { items, fetchDesktopItems, clearSelection, setSelection } = useDesktopStore()
  const [menuState, setMenuState] = useState<{visible: boolean, x: number, y: number}>({ visible: false, x: 0, y: 0 })
  
  // Marquee state
  const [marquee, setMarquee] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null)
  
  useEffect(() => {
    fetchContainers()
    fetchDesktopItems()
    
    let unlistenDirChanged: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;
    
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('desktop-dir-changed', () => {
        fetchDesktopItems()
      }).then(u => unlistenDirChanged = u)
    })
    
    import('@tauri-apps/api/webview').then(({ getCurrentWebview }) => {
      getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type === 'drop') {
          const { paths, position } = event.payload
          if (paths.length > 0) {
            let handledInternal = false;
            // Check if internal drag
            const firstPath = paths[0]
            const draggedItem = useDesktopStore.getState().items.find(i => i.path === firstPath)
            if (draggedItem) {
              useDesktopStore.getState().moveSelectedItems(draggedItem.id, position.x, position.y)
              handledInternal = true;
            }
            
            if (!handledInternal) {
              // It's an external drop! Copy files to desktop in background so we don't freeze the OS drag pointer
              setTimeout(async () => {
                try {
                  const { invoke } = await import('@tauri-apps/api/core');
                  const { desktopDir } = await import('@tauri-apps/api/path');
                  const targetDir = await desktopDir();
                  const newFiles = await invoke<string[]>('paste_files_to_desktop', { paths, targetDir });
                  placeNewFiles(newFiles, position.x, position.y);
                  await useDesktopStore.getState().fetchDesktopItems();
                } catch (e) {
                  console.error("External drop failed:", e);
                }
              }, 0);
            }
          }
        }
      }).then(u => unlistenDrop = u)
    })

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault()
        const selectedIds = useDesktopStore.getState().selectedIds;
        if (selectedIds.size > 0) {
          const paths = Array.from(selectedIds)
            .map(id => useDesktopStore.getState().items.find(i => i.id === id)?.path)
            .filter(Boolean) as string[];
          
          if (paths.length > 0) {
            const { invoke } = await import('@tauri-apps/api/core');
            const normalizedPaths = paths.map(p => p.replace(/\//g, '\\'));
            await invoke('copy_files_to_clipboard', { paths: normalizedPaths });
          }
        }
      } else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault()
        handlePaste();
      } else if (e.key === 'Delete') {
        e.preventDefault()
        const selectedIds = useDesktopStore.getState().selectedIds;
        if (selectedIds.size > 0) {
          const paths = Array.from(selectedIds)
            .map(id => useDesktopStore.getState().items.find(i => i.id === id)?.path)
            .filter(Boolean) as string[];
          
          if (paths.length > 0) {
            const { invoke } = await import('@tauri-apps/api/core');
            try {
              if (e.shiftKey) {
                await Promise.all(paths.map(p => invoke('delete_file', { path: p })));
              } else {
                await Promise.all(paths.map(p => invoke('trash_file', { path: p })));
              }
              await useDesktopStore.getState().fetchDesktopItems();
            } catch (err) {
              console.error("Delete failed:", err);
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (unlistenDirChanged) unlistenDirChanged()
      if (unlistenDrop) unlistenDrop()
      window.removeEventListener('keydown', handleKeyDown);
    }
  }, [])

  const placeNewFiles = (newFileNames: string[], x?: number, y?: number) => {
    if (newFileNames.length === 0) return;
    if (x === undefined || y === undefined) return; // Fallback to sequential empty slot
    try {
      const savedLayoutStr = localStorage.getItem('deskzero_layout')
      const savedLayout: Record<string, {x: number, y: number}> = savedLayoutStr ? JSON.parse(savedLayoutStr) : {}
      
      for (const name of newFileNames) {
        savedLayout[name] = { x, y };
        x += 20;
        y += 20;
      }
      localStorage.setItem('deskzero_layout', JSON.stringify(savedLayout))
    } catch (e) {
      console.warn("Failed to place new files", e)
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if ((e.target as HTMLElement).closest('.touch-none')) return // Let FileItem handle it
    setMenuState({ visible: true, x: e.clientX, y: e.clientY })
  }, [])

  const handlePaste = async (x?: number, y?: number) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { desktopDir } = await import('@tauri-apps/api/path');
      const paths = await invoke<string[]>('get_files_from_clipboard');
      const targetDir = await desktopDir();
      if (paths && paths.length > 0) {
        console.log("Files to paste:", paths);
        const newFiles = await invoke<string[]>('paste_files_to_desktop', { paths, targetDir });
        placeNewFiles(newFiles, x, y);
        await useDesktopStore.getState().fetchDesktopItems();
      }
    } catch (e) {
      console.error("Paste failed:", e);
    }
  }

  const desktopMenuItems: MenuItem[] = [
    { label: '刷新桌面', onClick: () => fetchDesktopItems() },
    { label: '粘贴', onClick: () => handlePaste(menuState.x, menuState.y) },
    { divider: true, onClick: () => {} },
    { label: '新建收纳盒', onClick: () => createContainer('新收纳盒', 'normal', { x: menuState.x, y: menuState.y }) },
    { label: '新建文件夹收纳盒', onClick: () => createContainer('新文件夹', 'folder', { x: menuState.x, y: menuState.y }) },
    { divider: true, onClick: () => {} },
    { label: '系统设置', onClick: () => {
        new WebviewWindow('settings', {
          url: '/settings',
          title: 'DeskZero 设置',
          width: 800,
          height: 600,
          resizable: true
        })
      } 
    },
  ]

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return // Only left click
    if ((e.target as HTMLElement).closest('.touch-none') || (e.target as HTMLElement).closest('.cursor-move')) {
      // Clicked on a draggable item or container
      return
    }
    
    clearSelection()
    setMarquee({ startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY })
  }
  
  const onPointerMove = (e: React.PointerEvent) => {
    if (!marquee) return
    setMarquee(prev => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null)
    
    // Calculate selection
    const minX = Math.min(marquee.startX, e.clientX)
    const maxX = Math.max(marquee.startX, e.clientX)
    const minY = Math.min(marquee.startY, e.clientY)
    const maxY = Math.max(marquee.startY, e.clientY)
    
    const newSelectedIds: string[] = []
    
    items.forEach(item => {
      if (item.isInContainer || !item.position) return
      // Item bounds approx (width: 80, height: 96)
      const itemMinX = item.position.x
      const itemMaxX = item.position.x + 80
      const itemMinY = item.position.y
      const itemMaxY = item.position.y + 96
      
      const overlap = !(minX > itemMaxX || maxX < itemMinX || minY > itemMaxY || maxY < itemMinY)
      if (overlap) {
        newSelectedIds.push(item.id)
      }
    })
    
    setSelection(newSelectedIds)
  }
  
  const onPointerUp = () => {
    setMarquee(null)
  }

  const marqueeRect = marquee ? {
    left: Math.min(marquee.startX, marquee.endX),
    top: Math.min(marquee.startY, marquee.endY),
    width: Math.abs(marquee.endX - marquee.startX),
    height: Math.abs(marquee.endY - marquee.startY)
  } : null

  return (
      <div 
        className="w-screen h-screen relative overflow-hidden select-none pointer-events-auto"
        style={{ backgroundColor: 'rgba(0,0,0,0.01)' }}
        onContextMenu={handleContextMenu}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
          <div 
            className="absolute bg-blue-500/20 border border-blue-500/50 z-50 pointer-events-none"
            style={{
              left: marqueeRect.left,
              top: marqueeRect.top,
              width: marqueeRect.width,
              height: marqueeRect.height
            }}
          />
        )}
        
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

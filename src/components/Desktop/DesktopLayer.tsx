import { useState, useCallback, useEffect, useRef } from 'react'
import { useContainerStore } from '@/stores/containerStore'
import { useDesktopStore } from '@/stores/desktopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Container } from '@/components/Container/Container'
import { FileItem } from '@/components/Item/FileItem'
import { DesktopGrid } from './DesktopGrid'
import { ContextMenu, type MenuItem } from '@/components/ContextMenu/ContextMenu'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { Icon } from '@iconify/react'

export default function DesktopLayer() {
  const containers = useContainerStore(state => state.containers)
  const fetchContainers = useContainerStore(state => state.fetchContainers)
  const createContainer = useContainerStore(state => state.createContainer)
  const { items, fetchDesktopItems, clearSelection, setSelection, realignToGrid, sortDesktopItems, setWallpaper } = useDesktopStore()
  const { settings } = useSettingsStore()
  const [menuState, setMenuState] = useState<{visible: boolean, x: number, y: number}>({ visible: false, x: 0, y: 0 })
  const [canPaste, setCanPaste] = useState(false)
  const [createPrompt, setCreatePrompt] = useState<{visible: boolean, isFolder: boolean, defaultName: string, x: number, y: number} | null>(null)
  
  const prevGridWidth = useRef(settings.gridWidth)
  const prevGridHeight = useRef(settings.gridHeight)
  const prevGridGapX = useRef(settings.gridGapX)
  const prevGridGapY = useRef(settings.gridGapY)
  
  // Marquee state
  const [marquee, setMarquee] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null)
  
  useEffect(() => {
    if (
      settings.gridWidth !== prevGridWidth.current || 
      settings.gridHeight !== prevGridHeight.current ||
      settings.gridGapX !== prevGridGapX.current ||
      settings.gridGapY !== prevGridGapY.current
    ) {
      prevGridWidth.current = settings.gridWidth
      prevGridHeight.current = settings.gridHeight
      prevGridGapX.current = settings.gridGapX
      prevGridGapY.current = settings.gridGapY
      realignToGrid()
    }
  }, [settings.gridWidth, settings.gridHeight, settings.gridGapX, settings.gridGapY, realignToGrid])

  useEffect(() => {
    const initData = async () => {
      await fetchContainers()
      await fetchDesktopItems()
    }
    initData()
    
    if (settings.wallpaperCompatible) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<string>('capture_desktop_background')
          .then(res => setWallpaper(res))
          .catch(err => console.error('Failed to capture desktop:', err))
      })
    } else {
      setWallpaper(null)
    }
    
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
        handlePaste(20, 20);
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
  }, [settings.wallpaperCompatible])

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

  const handleContextMenu = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    if ((e.target as HTMLElement).closest('.touch-none')) return // Let FileItem handle it
    
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const hasFiles = await invoke<boolean>('check_clipboard_has_files')
      setCanPaste(hasFiles)
    } catch (err) {
      setCanPaste(false)
    }
    
    setMenuState({ visible: true, x: e.clientX, y: e.clientY })
  }, [])

  const handlePaste = async (x: number, y: number) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const targetDir = await invoke<string>('get_desktop_dir')
      const paths = await invoke<string[]>('get_files_from_clipboard')
      if (paths && paths.length > 0) {
        const newFiles = await invoke<string[]>('paste_files_to_desktop', { paths, targetDir });
        placeNewFiles(newFiles, x, y);
        await useDesktopStore.getState().fetchDesktopItems();
      }
    } catch (e) {
      console.error("Paste failed:", e);
    }
  }

  const handleCreateFile = async (name: string, isFolder: boolean) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const dir = await invoke<string>('get_desktop_dir')
      
      let finalName = name
      const existingNames = useDesktopStore.getState().items.map(i => i.name)
      
      if (existingNames.includes(finalName)) {
        let counter = 2
        let nameWithoutExt = finalName
        let ext = ''
        
        if (!isFolder && finalName.includes('.')) {
          const lastDot = finalName.lastIndexOf('.')
          nameWithoutExt = finalName.substring(0, lastDot)
          ext = finalName.substring(lastDot)
        }
        
        while (existingNames.includes(`${nameWithoutExt} (${counter})${ext}`)) {
          counter++
        }
        finalName = `${nameWithoutExt} (${counter})${ext}`
      }

      const path = dir.replace(/[\\/]$/, '') + '\\' + finalName
      if (isFolder) {
        await invoke('create_folder', { path })
      } else {
        await invoke('create_empty_file', { path })
      }
      if (createPrompt) {
        let stem = finalName
        const lastDot = finalName.lastIndexOf('.')
        if (lastDot > 0) {
          stem = finalName.substring(0, lastDot)
        }
        placeNewFiles([stem], createPrompt.x, createPrompt.y)
      }
      setTimeout(() => fetchDesktopItems(), 500)
    } catch (e: any) {
      console.error(e)
      window.alert('创建文件失败: ' + String(e))
    }
  }

  const desktopMenuItems: MenuItem[] = [
    { label: '刷新', icon: <Icon icon="iconamoon:refresh" />, onClick: () => fetchDesktopItems() },
    { label: '排序方式', icon: <Icon icon="iconamoon:sorting-left" />, onClick: () => {}, subItems: [
      { label: '名称 A-Z', icon: <Icon icon="iconamoon:text-align-left" />, onClick: () => sortDesktopItems('name') },
      { label: '大小', icon: <Icon icon="iconamoon:box" />, onClick: () => sortDesktopItems('size') },
      { label: '项目类型', icon: <Icon icon="iconamoon:category" />, onClick: () => sortDesktopItems('type') },
      { label: '修改日期', icon: <Icon icon="iconamoon:clock" />, onClick: () => sortDesktopItems('date') },
      { divider: true },
      { label: '自动分类排序', icon: <Icon icon="iconamoon:wand" />, onClick: () => realignToGrid() }
    ]},
    { label: '打开方式', icon: <Icon icon="iconamoon:terminal" />, onClick: () => {}, subItems: [
      { label: '在此处打开 powershell 窗口', icon: <Icon icon="iconamoon:terminal" />, onClick: async () => {
        const { invoke } = await import('@tauri-apps/api/core')
        const dir = await invoke<string>('get_desktop_dir')
        invoke('open_terminal', { shell: 'powershell', path: dir })
      }},
      { label: '在此处打开 cmd 窗口', icon: <Icon icon="iconamoon:terminal" />, onClick: async () => {
        const { invoke } = await import('@tauri-apps/api/core')
        const dir = await invoke<string>('get_desktop_dir')
        invoke('open_terminal', { shell: 'cmd', path: dir })
      }}
    ]},
    { label: '新建', icon: <Icon icon="iconamoon:file-add" />, onClick: () => {}, subItems: [
      { label: '新建文件夹', icon: <Icon icon="iconamoon:folder-add" />, onClick: (e) => {
        setCreatePrompt({ visible: true, isFolder: true, defaultName: '新建文件夹', x: e?.clientX ?? menuState.x, y: e?.clientY ?? menuState.y })
      }},
      { label: '新建文件', icon: <Icon icon="iconamoon:file-add" />, onClick: (e) => {
        setCreatePrompt({ visible: true, isFolder: false, defaultName: '新建文本文件.txt', x: e?.clientX ?? menuState.x, y: e?.clientY ?? menuState.y })
      }},
      { label: '新建收纳盒容器', icon: <Icon icon="iconamoon:grid-view" />, onClick: async () => {
        try {
          await createContainer('新建收纳盒', 'normal', { 
            x: menuState.x, 
            y: menuState.y 
          })
          fetchContainers()
        } catch(e: any) {
          window.alert('新建收纳盒失败: ' + String(e));
        }
      }},
      { label: '新建游戏容器', icon: <Icon icon="iconamoon:gamepad" />, onClick: async () => {
        try {
          await createContainer('新建游戏容器', 'game', { 
            x: menuState.x, 
            y: menuState.y 
          })
          fetchContainers()
        } catch(e: any) {
          window.alert('新建游戏容器失败: ' + String(e));
        }
      }}
    ]},
    { divider: true, onClick: () => {} },
    { label: '粘贴', icon: <Icon icon="iconamoon:copy" />, disabled: !canPaste, onClick: () => handlePaste(menuState.x, menuState.y) },
    { divider: true, onClick: () => {} },
    { label: 'DeskZero 设置', icon: <Icon icon="iconamoon:settings" />, onClick: () => {
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
    if (createPrompt) setCreatePrompt(null)
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
        style={{ 
          backgroundColor: 'transparent',
        }}
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

        {/* Create Prompt Popup */}
        {createPrompt && createPrompt.visible && (
          <div 
            className="absolute z-50 bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl rounded-xl p-3 flex flex-col gap-2 min-w-[200px]"
            style={{ left: createPrompt.x, top: createPrompt.y }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-medium text-[var(--color-text)] mb-1">
              请输入{createPrompt.isFolder ? '文件夹' : '文件'}名称：
            </div>
            <input 
              type="text" 
              autoFocus
              defaultValue={createPrompt.defaultName}
              className="w-full bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded px-2 py-1 text-xs border border-transparent focus:border-blue-500/50 focus:bg-transparent outline-none transition-all"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const name = (e.target as HTMLInputElement).value
                  if (name) {
                    await handleCreateFile(name, createPrompt.isFolder)
                    setCreatePrompt(null)
                  }
                } else if (e.key === 'Escape') {
                  setCreatePrompt(null)
                }
              }}
            />
          </div>
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

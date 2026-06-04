import { useRef, useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { Container as ContainerType } from '@/types/container'
import type { Item, ItemType } from '@/types/item'
import { FileItem } from '../Item/FileItem'
import { useDrag } from '@/hooks/useDrag'
import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDesktopStore } from '@/stores/desktopStore'
import { ContainerSettings } from './ContainerSettings'
import { ContextMenu, type MenuItem } from '@/components/ContextMenu/ContextMenu'
import { invoke } from '@tauri-apps/api/core'
import { RefreshCw, ArrowDownUp, Type, Box, Tag, Clock, Eye, LayoutGrid, List, Edit2, Settings, Trash2, Folder } from 'lucide-react'

interface ContainerProps {
  container: ContainerType
}

export function FolderContainer({ container }: ContainerProps) {
  const { updateContainerPosition, updateContainerSize, updateContainerStyle, updateContainerName } = useContainerStore()
  const { settings } = useSettingsStore()
  const { wallpaper } = useDesktopStore()
  const dragHandleRef = useRef<HTMLDivElement>(null)
  
  const [resizePosOffset, setResizePosOffset] = useState({ x: 0, y: 0 })
  const resizeOffsetRef = useRef({ x: 0, y: 0 })
  const [menuState, setMenuState] = useState<{visible: boolean, x: number, y: number}>({ visible: false, x: 0, y: 0 })
  const [settingsPos, setSettingsPos] = useState({ x: 0, y: 0 })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  const [folderItems, setFolderItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleScroll = () => {
    setIsScrolling(true)
    
    if (scrollContainerRef.current && thumbRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
      if (scrollHeight > clientHeight) {
        const scrollRatio = scrollTop / (scrollHeight - clientHeight)
        const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 20)
        const maxThumbTop = clientHeight - thumbHeight
        thumbRef.current.style.height = `${thumbHeight}px`
        thumbRef.current.style.transform = `translateY(${scrollRatio * maxThumbTop}px)`
      }
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 1000)
  }

  const fetchFolderItems = async () => {
    if (!container.folderPath) return
    setIsLoading(true)
    try {
      const result = await invoke<Item[]>('scan_directory_icons', { path: container.folderPath })
      setFolderItems(result)
    } catch (e) {
      console.error('Failed to fetch folder items:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFolderItems()
  }, [container.folderPath])

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.dir === container.folderPath) {
        fetchFolderItems()
      }
    }
    window.addEventListener('folder-container-refresh', handler)
    return () => window.removeEventListener('folder-container-refresh', handler)
  }, [container.folderPath])

  const { ref, pos, isDragging, listeners } = useDrag(container.position, {
    dragHandleRef,
    onDragEnd: (newPos) => {
      const safeX = Math.max(0, newPos.x)
      const safeY = Math.max(0, newPos.y)
      updateContainerPosition(container.id, { x: safeX, y: safeY })
    }
  })

  // Resize logic
  const [isResizing, setIsResizing] = useState(false)
  const [size, setSize] = useState(container.size)

  useEffect(() => {
    setSize(container.size)
  }, [container.size.width, container.size.height])

  useEffect(() => {
    const popupWidth = 288;
    const popupHeight = 500;
    let x = pos.x + size.width + 10;
    if (x + popupWidth > window.innerWidth) {
      x = pos.x - popupWidth - 10;
      if (x < 0) x = 10;
    }
    let y = pos.y;
    if (y + popupHeight > window.innerHeight) {
      y = window.innerHeight - popupHeight - 10;
      if (y < 0) y = 10;
    }
    setSettingsPos({ x, y })
  }, [pos.x, pos.y, size.width])

  const sizeRef = useRef(size)
  sizeRef.current = size
  const commitResize = () => {
    updateContainerSize(container.id, { width: sizeRef.current.width, height: sizeRef.current.height })
  }

  const handleResizePointerDown = (e: React.PointerEvent, direction: 'br' | 'bl' | 'tl' | 'tr' | 't' | 'b' | 'l' | 'r') => {
    e.stopPropagation()
    setIsResizing(true)
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = sizeRef.current.width
    const startHeight = sizeRef.current.height

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      let newWidth = startWidth
      let newHeight = startHeight
      let offsetX = 0
      let offsetY = 0

      if (direction.includes('r')) newWidth = Math.max(120, startWidth + deltaX)
      if (direction.includes('l')) {
        newWidth = Math.max(120, startWidth - deltaX)
        offsetX = startWidth - deltaX >= 120 ? deltaX : startWidth - 120
      }
      
      if (direction.includes('b')) newHeight = Math.max(120, startHeight + deltaY)
      if (direction.includes('t')) {
        newHeight = Math.max(120, startHeight - deltaY)
        offsetY = startHeight - deltaY >= 120 ? deltaY : startHeight - 120
      }

      setSize({ width: newWidth, height: newHeight })
      setResizePosOffset({ x: offsetX, y: offsetY })
      resizeOffsetRef.current = { x: offsetX, y: offsetY }
    }

    const handlePointerUp = () => {
      setIsResizing(false)
      commitResize()
      
      const finalOffsetX = resizeOffsetRef.current.x
      const finalOffsetY = resizeOffsetRef.current.y
      setResizePosOffset({ x: 0, y: 0 })
      resizeOffsetRef.current = { x: 0, y: 0 }
      
      if (finalOffsetX !== 0 || finalOffsetY !== 0) {
        let safeX = pos.x
        let safeY = pos.y
        
        if (finalOffsetX !== 0) {
          safeX = Math.max(0, pos.x + finalOffsetX)
        }
        if (finalOffsetY !== 0) {
          safeY = Math.max(0, pos.y + finalOffsetY)
        }
        
        updateContainerPosition(container.id, { x: safeX, y: safeY })
      }

      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const bgOpacity = container.style.backgroundOpacity ?? 0.3
  const cornerRadius = container.style.cornerRadius ?? 16
  const isListView = container.style.layout === 'list'
  const bgColor = container.style.backgroundColor || 'theme'
  
  const sortBy = container.style.sortBy || 'name'
  const sortDesc = container.style.sortDesc || false

  const sortedItems = useMemo(() => {
    return [...folderItems].sort((a, b) => {
      let result = 0
      switch (sortBy) {
        case 'name':
          result = a.name.localeCompare(b.name, 'zh-CN')
          break
        case 'date':
          result = (a.modifiedAt || 0) - (b.modifiedAt || 0)
          break
        case 'size':
          result = (a.size || 0) - (b.size || 0)
          break
        case 'type':
          const typeA = (a.type || (a as any).item_type)?.toLowerCase() || ''
          const typeB = (b.type || (b as any).item_type)?.toLowerCase() || ''
          result = typeA.localeCompare(typeB) || a.name.localeCompare(b.name, 'zh-CN')
          break
      }
      return sortDesc ? -result : result
    }).map(i => ({
      ...i, 
      type: ((i.type || (i as any).item_type)?.toLowerCase() || 'file') as ItemType,
      isInContainer: true,
      containerId: container.id
    }))
  }, [folderItems, sortBy, sortDesc, container.id])

  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState(container.name)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuState({ visible: true, x: e.clientX, y: e.clientY })
  }

  const contextMenuItems: MenuItem[] = [
    { label: '刷新', icon: <RefreshCw size={14} />, onClick: () => fetchFolderItems() },
    { divider: true, onClick: () => {} },
    { label: '排列方式', icon: <ArrowDownUp size={14} />, onClick: () => {}, subItems: [
      { label: `名称 ${sortBy === 'name' ? (sortDesc ? '↓' : '↑') : ''}`, icon: <Type size={14} />, onClick: () => {
          if (sortBy === 'name') updateContainerStyle(container.id, { sortDesc: !sortDesc })
          else updateContainerStyle(container.id, { sortBy: 'name', sortDesc: false })
      }},
      { label: `大小 ${sortBy === 'size' ? (sortDesc ? '↓' : '↑') : ''}`, icon: <Box size={14} />, onClick: () => {
          if (sortBy === 'size') updateContainerStyle(container.id, { sortDesc: !sortDesc })
          else updateContainerStyle(container.id, { sortBy: 'size', sortDesc: true })
      }},
      { label: `类型 ${sortBy === 'type' ? (sortDesc ? '↓' : '↑') : ''}`, icon: <Tag size={14} />, onClick: () => {
          if (sortBy === 'type') updateContainerStyle(container.id, { sortDesc: !sortDesc })
          else updateContainerStyle(container.id, { sortBy: 'type', sortDesc: false })
      }},
      { label: `修改日期 ${sortBy === 'date' ? (sortDesc ? '↓' : '↑') : ''}`, icon: <Clock size={14} />, onClick: () => {
          if (sortBy === 'date') updateContainerStyle(container.id, { sortDesc: !sortDesc })
          else updateContainerStyle(container.id, { sortBy: 'date', sortDesc: true })
      }},
    ]},
    { label: '视图', icon: <Eye size={14} />, onClick: () => {}, subItems: [
      { label: '大图标', icon: <LayoutGrid size={14} />, onClick: () => updateContainerStyle(container.id, { layout: 'grid' }) },
      { label: '列表', icon: <List size={14} />, onClick: () => updateContainerStyle(container.id, { layout: 'list' }) },
    ]},
    { divider: true, onClick: () => {} },
    { label: '重命名', icon: <Edit2 size={14} />, onClick: () => setIsEditingName(true) },
    { label: '设置', icon: <Settings size={14} />, onClick: () => setIsSettingsOpen(true) },
    { label: '移除', icon: <Trash2 size={14} />, onClick: () => {
        useContainerStore.getState().deleteContainer(container.id)
    }}
  ]

  const customBackground = bgColor === 'theme'
    ? `rgba(var(--color-container-bg-rgb), ${bgOpacity})`
    : bgColor.startsWith('#') || bgColor.startsWith('rgb') 
      ? `rgba(${hexToRgb(bgColor)}, ${bgOpacity})` 
      : bgColor

  return (
    <>
      <motion.div
        ref={ref}
        {...listeners}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          x: pos.x + resizePosOffset.x,
          y: pos.y + resizePosOffset.y,
          width: size.width,
          height: size.height,
          borderRadius: cornerRadius,
          zIndex: isDragging || isResizing ? 40 : 10,
          backgroundColor: (settings.wallpaperCompatible && settings.globalBlur && wallpaper) ? 'transparent' : customBackground,
          backdropFilter: (!settings.wallpaperCompatible && settings.globalBlur) ? 'var(--backdrop-blur)' : 'none',
          WebkitBackdropFilter: (!settings.wallpaperCompatible && settings.globalBlur) ? 'var(--backdrop-blur)' : 'none',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "flex flex-col overflow-hidden transition-colors border shadow-xl select-none",
          "border-[var(--color-border)]",
          isDragging && "shadow-2xl ring-2 ring-[var(--color-accent)]/50"
        )}
        onContextMenu={handleContextMenu}
      >
        {/* Fake Blur Layer for Dynamic Wallpaper Mode */}
        {settings.wallpaperCompatible && settings.globalBlur && wallpaper && (
          <div 
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: -1, borderRadius: 'inherit' }}
          >
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${wallpaper})`,
                backgroundAttachment: 'fixed',
                backgroundPosition: 'top left',
                backgroundSize: '100vw 100vh',
                filter: 'blur(20px)',
              }}
            />
            <div 
              className="absolute inset-0"
              style={{ backgroundColor: customBackground }}
            />
          </div>
        )}

        {/* Header (Drag handle) */}
        <div 
          ref={dragHandleRef}
          className="relative z-10 px-2 py-1 shrink-0 cursor-grab active:cursor-grabbing border-b border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 min-h-[24px]"
          style={{ backgroundColor: 'transparent' }}
        >
          <Folder size={14} className="text-[var(--color-accent)] shrink-0" style={{ opacity: settings.iconOpacity ?? 1.0 }} />
          {isEditingName ? (
            <input
              autoFocus
              className="bg-white/50 dark:bg-black/50 text-[var(--color-text)] px-1 outline-none rounded text-xs font-medium w-full"
              value={editNameValue}
              onChange={e => setEditNameValue(e.target.value)}
              onBlur={() => {
                setIsEditingName(false)
                if (editNameValue.trim()) updateContainerName(container.id, editNameValue.trim())
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setIsEditingName(false)
                  if (editNameValue.trim()) updateContainerName(container.id, editNameValue.trim())
                } else if (e.key === 'Escape') {
                  setIsEditingName(false)
                  setEditNameValue(container.name)
                }
              }}
              onPointerDown={e => e.stopPropagation()}
            />
          ) : (
            <div className="flex-1 min-w-0" onDoubleClick={() => setIsEditingName(true)}>
              <h3 className="font-medium text-xs text-[var(--color-text)] truncate" style={{ opacity: settings.textOpacity ?? 1.0 }}>{container.name}</h3>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="relative flex-1 z-10 overflow-hidden">
          <motion.div 
            layoutScroll
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto overflow-x-hidden p-2 hidden-native-scrollbar"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">加载中...</div>
            ) : sortedItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">文件夹为空</div>
            ) : (
              <div className={cn(
                isListView ? "flex flex-col gap-1" : "flex flex-wrap gap-2 content-start"
              )}>
                {sortedItems.map(item => (
                  <FileItem 
                    key={item.id} 
                    item={item} 
                    containerStyle={{ ...container.style, showDetails: container.style.showDetails ?? true }}
                  />
                ))}
              </div>
            )}
          </motion.div>
          {/* Custom Animated Scrollbar Thumb */}
          <div 
            ref={thumbRef}
            className={cn(
              "absolute top-0 right-1 w-1.5 bg-black/20 dark:bg-white/20 rounded-full pointer-events-none",
              "transition-opacity duration-300 ease-in-out",
              isScrolling ? "opacity-100" : "opacity-0"
            )}
          />
        </div>

        {/* Resize Handles */}
        <div className="absolute top-0 left-0 w-full h-1 cursor-ns-resize z-50 opacity-0" onPointerDown={(e) => handleResizePointerDown(e, 't')} />
        <div className="absolute bottom-0 left-0 w-full h-1 cursor-ns-resize z-50 opacity-0" onPointerDown={(e) => handleResizePointerDown(e, 'b')} />
        <div className="absolute top-0 left-0 w-1 h-full cursor-ew-resize z-50 opacity-0" onPointerDown={(e) => handleResizePointerDown(e, 'l')} />
        <div className="absolute top-0 right-0 w-1 h-full cursor-ew-resize z-50 opacity-0" onPointerDown={(e) => handleResizePointerDown(e, 'r')} />
        <div className="absolute top-0 left-0 w-2 h-2 cursor-nwse-resize z-50 opacity-0" onPointerDown={(e) => handleResizePointerDown(e, 'tl')} />
        <div className="absolute top-0 right-0 w-2 h-2 cursor-nesw-resize z-50 opacity-0" onPointerDown={(e) => handleResizePointerDown(e, 'tr')} />
        <div className="absolute bottom-0 left-0 w-2 h-2 cursor-nesw-resize z-50 opacity-0" onPointerDown={(e) => handleResizePointerDown(e, 'bl')} />
        <div className="absolute bottom-0 right-0 w-2 h-2 cursor-nwse-resize z-50 opacity-0" onPointerDown={(e) => handleResizePointerDown(e, 'br')} />
      </motion.div>
      
      {isSettingsOpen && createPortal(
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="fixed z-[100] pointer-events-auto"
           style={{ 
             left: settingsPos.x,
             top: settingsPos.y,
             width: 288,
           }}
           onPointerDown={e => e.stopPropagation()}
         >
             <ContainerSettings container={container} onClose={() => setIsSettingsOpen(false)} />
         </motion.div>,
         document.body
      )}

      {menuState.visible && (
        <ContextMenu 
          x={menuState.x} 
          y={menuState.y} 
          items={contextMenuItems} 
          onClose={() => setMenuState(prev => ({...prev, visible: false}))} 
        />
      )}
    </>
  )
}

// Helper
function hexToRgb(hex: string) {
  let c = hex.substring(1).split('');
  if(c.length === 3){
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  const cNum = Number('0x' + c.join(''));
  return [(cNum >> 16) & 255, (cNum >> 8) & 255, cNum & 255].join(',');
}

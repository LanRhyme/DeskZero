import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { Item } from '@/types/item'
import { File, Folder, Link } from 'lucide-react'
import { useDesktopStore } from '@/stores/desktopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { invoke } from '@tauri-apps/api/core'
import { useDrag } from '@/hooks/useDrag'

interface FileItemProps {
  item: Item & { position?: { x: number, y: number } }
  className?: string
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export function FileItem({ item, className, onClick, onDoubleClick, onContextMenu }: FileItemProps) {
  const { selectedIds, toggleSelection, setSelection, moveSelectedItems } = useDesktopStore()
  const { settings } = useSettingsStore()
  const isSelected = selectedIds.has(item.id)
  
  const initialPos = item.position || { x: 0, y: 0 }

  let iconPath = item.iconPath || ''
  if (iconPath.startsWith('http')) {
    iconPath = ''
  }
  iconPath = iconPath.replace(/^file:\/\/\//, '')
  
  let currentSelectedIds = selectedIds
  if (!isSelected) {
    currentSelectedIds = new Set([item.id])
  }
  
  const paths = Array.from(currentSelectedIds)
    .map(id => useDesktopStore.getState().items.find(i => i.id === id)?.path)
    .filter(Boolean) as string[]
    
  if (paths.length === 0) paths.push(item.path)

  const normalizedPaths = paths.map(p => p.replace(/\//g, '\\'))
  const normalizedIcon = iconPath.replace(/\//g, '\\')

  const { ref, pos, isDragging, listeners } = useDrag(initialPos, {
    disabled: item.isInContainer,
    nativeDragItemPaths: normalizedPaths,
    nativeDragIconPath: normalizedIcon,
    onDragStart: () => {
      if (!isSelected) {
        setSelection([item.id])
      }
    },
    onDragEnd: (newPos) => {
      if (!item.isInContainer) {
        moveSelectedItems(item.id, newPos.x, newPos.y)
      }
    }
  })

  const renderIcon = () => {
    if (item.iconPath && item.iconPath.startsWith('data:image/')) {
      return <img src={item.iconPath} alt={item.name} className="w-10 h-10 object-contain pointer-events-none drop-shadow-md" />
    }
    const iconProps = { className: "w-10 h-10 text-white/80 pointer-events-none drop-shadow-md" }
    switch (item.type) {
      case 'folder': return <Folder {...iconProps} fill="currentColor" className="w-10 h-10 text-yellow-400 pointer-events-none drop-shadow-md" />
      case 'shortcut': return <Link {...iconProps} />
      case 'url': return <Link {...iconProps} />
      default: return <File {...iconProps} />
    }
  }

  const layoutStyle = item.isInContainer ? {} : {
    position: 'absolute' as const,
    zIndex: isDragging ? 50 : (isSelected ? 20 : 'auto'),
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick(e)
    } else {
      toggleSelection(item.id, e.ctrlKey || e.metaKey)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDoubleClick) {
      onDoubleClick(e)
    } else {
      invoke('open_file', { path: item.path })
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    // Select the item if it's not already selected
    if (!isSelected) {
      setSelection([item.id])
    }
    
    if (onContextMenu) {
      onContextMenu(e)
    } else {
      // Get all selected item paths
      const currentPaths = isSelected ? paths : [item.path]
      const currentNormalized = currentPaths.map(p => p.replace(/\//g, '\\'))
      invoke('show_context_menu', { paths: currentNormalized, x: e.screenX, y: e.screenY })
    }
  }

  return (
    <motion.div
      ref={ref}
      style={layoutStyle}
      animate={item.isInContainer ? {} : { left: pos.x, top: pos.y }}
      transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
      {...listeners}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "flex flex-col items-center justify-start p-2 rounded-md w-20 h-24 select-none touch-none",
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-default hover:bg-white/10",
        isSelected && "bg-[var(--item-selected-bg)] ring-1 ring-[var(--item-selected-ring)]",
        isSelected && settings.selectedItemBlur && "selected-blur",
        className
      )}
    >
      <div className="w-12 h-12 flex items-center justify-center mb-1 relative pointer-events-none">
        {renderIcon()}
        {item.type === 'shortcut' && (
          <div className="absolute -bottom-1 -left-1 bg-white rounded-sm p-0.5 shadow-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-black">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
        )}
      </div>
      <span 
        className={cn(
          "text-xs text-center break-words w-full line-clamp-2 drop-shadow-md pointer-events-none text-white",
          isSelected && ""
        )}
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {item.name}
      </span>
    </motion.div>
  )
}

import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { Item } from '@/types/item'
import { File, Folder, Link } from 'lucide-react'
import { useDrag } from '@/hooks/useDrag'
import { useDesktopStore } from '@/stores/desktopStore'

interface FileItemProps {
  item: Item & { position?: { x: number, y: number } }
  className?: string
  onClick?: () => void
  onDoubleClick?: () => void
}

export function FileItem({ item, className, onClick, onDoubleClick }: FileItemProps) {
  const { updateItemPosition } = useDesktopStore()
  
  // If item is not in container, it has a position, otherwise default to 0,0 for flow layout inside container
  const initialPos = item.position || { x: 0, y: 0 }
  
  const { ref, pos, isDragging, listeners } = useDrag(initialPos, {
    disabled: item.isInContainer,
    onDragEnd: (newPos) => {
      if (!item.isInContainer) {
        // Let store handle strict grid snapping and collision
        updateItemPosition(item.id, newPos.x, newPos.y)
      }
    }
  })

  // Provide a fallback icon if iconPath is empty
  const renderIcon = () => {
    // If backend provides a base64 or custom protocol path
    if (item.iconPath) {
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

  // If inside container, position is relative flow (CSS layout)
  // If on desktop, position is absolute
  const layoutStyle = item.isInContainer ? {} : {
    position: 'absolute' as const,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <motion.div
      ref={ref}
      style={layoutStyle}
      animate={item.isInContainer ? {} : { left: pos.x, top: pos.y }}
      transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
      {...listeners}
      whileHover={{ scale: 1.05, backgroundColor: 'var(--item-bg-hover)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "flex flex-col items-center justify-start p-2 rounded-md w-20 h-24 select-none touch-none",
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-default",
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
        className="text-xs text-white text-center break-words w-full line-clamp-2 drop-shadow-md pointer-events-none"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {item.name}
      </span>
    </motion.div>
  )
}

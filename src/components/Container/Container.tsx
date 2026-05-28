import { useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { Container as ContainerType } from '@/types/container'
import { FileItem } from '../Item/FileItem'
import { Settings } from 'lucide-react'
import { useDrag } from '@/hooks/useDrag'
import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'

interface ContainerProps {
  container: ContainerType
}

export function Container({ container }: ContainerProps) {
  const { updateContainerPosition } = useContainerStore()
  const { settings } = useSettingsStore()
  const dragHandleRef = useRef<HTMLDivElement>(null)

  const { ref, pos, isDragging, listeners } = useDrag(container.position, {
    dragHandleRef,
    onDragEnd: (newPos) => {
      // Optional snap to grid for containers
      const snapX = Math.round(newPos.x / 40) * 40
      const snapY = Math.round(newPos.y / 40) * 40
      updateContainerPosition(container.id, { x: snapX, y: snapY })
    }
  })

  return (
    <motion.div
      ref={ref}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: container.size.width,
        height: container.size.height,
        borderRadius: container.style.cornerRadius || 10,
        zIndex: isDragging ? 40 : 10,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex flex-col overflow-hidden transition-colors border shadow-xl select-none",
        "bg-[var(--color-bg)] border-[var(--color-border)]",
        settings.globalBlur ? "backdrop-blur-2xl" : "backdrop-blur-none",
        isDragging && "shadow-2xl opacity-90 ring-1 ring-black/10 dark:ring-white/10"
      )}
    >
      {/* Header (Draggable Area) */}
      <div 
        ref={dragHandleRef}
        {...listeners}
        className="flex items-center justify-between px-3 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-move touch-none"
      >
        <span className="text-sm font-medium text-[var(--color-text)] pointer-events-none">
          {container.name}
        </span>
        <div className="flex gap-2">
          <button 
            onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking settings
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-2 flex flex-wrap content-start gap-1 overflow-y-auto">
        {container.items.map(item => (
          <FileItem key={item.id} item={item} />
        ))}
        {container.items.length === 0 && (
          <div className="w-full h-full flex items-center justify-center text-sm text-[var(--color-text-secondary)] opacity-50 pointer-events-none">
            Drag items here
          </div>
        )}
      </div>
    </motion.div>
  )
}

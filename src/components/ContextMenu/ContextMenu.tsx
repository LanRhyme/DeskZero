import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'

export interface MenuItem {
  label?: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  divider?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Simple boundary collision detection
  let adjustedX = x
  let adjustedY = y
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect()
    if (x + rect.width > window.innerWidth) adjustedX = window.innerWidth - rect.width
    if (y + rect.height > window.innerHeight) adjustedY = window.innerHeight - rect.height
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-50 min-w-[200px] py-1 bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-2xl rounded-lg"
        style={{ left: adjustedX, top: adjustedY }}
      >
        {items.map((item, index) => {
          if (item.divider) {
            return <div key={index} className="h-px bg-black/10 dark:bg-white/10 my-1 mx-2" />
          }

          return (
            <button
              key={index}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick()
                  onClose()
                }
              }}
              disabled={item.disabled}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors",
                "hover:bg-black/5 dark:hover:bg-white/10",
                item.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer text-gray-900 dark:text-gray-100"
              )}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              {item.label}
            </button>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}

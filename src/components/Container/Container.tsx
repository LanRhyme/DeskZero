import { useRef, useState, useEffect, Fragment } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { Container as ContainerType } from '@/types/container'
import { FileItem } from '../Item/FileItem'
import { Settings } from 'lucide-react'
import { Popover, Transition } from '@headlessui/react'
import { useDrag } from '@/hooks/useDrag'
import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDesktopStore } from '@/stores/desktopStore'
import { ContainerSettings } from './ContainerSettings'

import { GameContainer } from './GameContainer'

interface ContainerProps {
  container: ContainerType
}

export function Container({ container }: ContainerProps) {
  if (container.type === 'game') {
    return <GameContainer container={container} />
  }
  const { updateContainerPosition, updateContainerSize } = useContainerStore()
  const { settings } = useSettingsStore()
  const { wallpaper } = useDesktopStore()
  const dragHandleRef = useRef<HTMLDivElement>(null)
  
  const [resizePosOffset, setResizePosOffset] = useState({ x: 0, y: 0 })

  const { ref, pos, isDragging, listeners } = useDrag(container.position, {
    dragHandleRef,
    onDragEnd: (newPos) => {
      const gw = settings.gridWidth || 80
      const gh = settings.gridHeight || 104
      const gx = settings.gridGapX ?? 20
      const gy = settings.gridGapY ?? 20
      const stepX = gw + gx
      const stepY = gh + gy

      const snapX = Math.round(Math.max(0, newPos.x - 20) / stepX) * stepX + 20
      const snapY = Math.round(Math.max(0, newPos.y - 20) / stepY) * stepY + 20
      updateContainerPosition(container.id, { x: snapX, y: snapY })
    }
  })

  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

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

  // Resize logic
  const [isResizing, setIsResizing] = useState(false)
  const [size, setSize] = useState(container.size)

  useEffect(() => {
    setSize(container.size)
  }, [container.size.width, container.size.height])

  const sizeRef = useRef(size)
  sizeRef.current = size
  const commitResize = () => {
    const gw = settings.gridWidth || 80
    const gh = settings.gridHeight || 104
    const gx = settings.gridGapX ?? 20
    const gy = settings.gridGapY ?? 20
    const stepX = gw + gx
    const stepY = gh + gy

    const snapW = Math.max(1, Math.round((sizeRef.current.width + gx) / stepX)) * stepX - gx
    const snapH = Math.max(1, Math.round((sizeRef.current.height + gy) / stepY)) * stepY - gy

    updateContainerSize(container.id, { width: snapW, height: snapH })
  }

  const handleResizePointerDown = (e: React.PointerEvent, direction: 'br' | 'bl') => {
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
      let offsetX = 0

      if (direction === 'br') {
        newWidth = Math.max(150, startWidth + deltaX)
      } else if (direction === 'bl') {
        newWidth = Math.max(150, startWidth - deltaX)
        if (startWidth - deltaX >= 150) {
          offsetX = deltaX
        } else {
          offsetX = startWidth - 150
        }
      }

      const newHeight = Math.max(100, startHeight + deltaY)
      setSize({ width: newWidth, height: newHeight })
      
      if (direction === 'bl') {
        setResizePosOffset({ x: offsetX, y: 0 })
      }
    }

    const handlePointerUp = () => {
      setIsResizing(false)
      commitResize()
      
      let finalOffsetX = 0
      setResizePosOffset(prev => {
        finalOffsetX = prev.x
        return { x: 0, y: 0 }
      })
      
      if (finalOffsetX !== 0) {
        const gw = settings.gridWidth || 80
        const gx = settings.gridGapX ?? 20
        const stepX = gw + gx
        const snapX = Math.round(Math.max(0, (pos.x + finalOffsetX) - 20) / stepX) * stepX + 20
        updateContainerPosition(container.id, { x: snapX, y: pos.y })
      }

      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const bgOpacity = container.style.backgroundOpacity ?? 0.3
  const bgColor = container.style.backgroundColor || '#000000'
  const layoutStyle = container.style.layout === 'list' ? 'flex-col' : 'flex-wrap content-start'
  
  // Custom background generation
  const customBackground = bgColor.startsWith('#') || bgColor.startsWith('rgb') 
    ? `rgba(${hexToRgb(bgColor)}, ${bgOpacity})` 
    : bgColor

  return (
    <>
      <motion.div
        ref={ref}
        style={{
          position: 'absolute',
          left: pos.x + resizePosOffset.x,
          top: pos.y + resizePosOffset.y,
          width: size.width,
          height: size.height,
          borderRadius: container.style.cornerRadius ?? 10,
          zIndex: isDragging || isResizing ? 40 : 10,
          backgroundColor: (settings.wallpaperCompatible && settings.globalBlur && wallpaper) ? 'transparent' : customBackground,
          backdropFilter: (!settings.wallpaperCompatible && settings.globalBlur) ? 'var(--backdrop-blur)' : 'none',
          WebkitBackdropFilter: (!settings.wallpaperCompatible && settings.globalBlur) ? 'var(--backdrop-blur)' : 'none',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: isDragging ? 0.9 : 1, scale: 1 }}
        className={cn(
          "flex flex-col transition-colors border shadow-xl select-none relative",
          "border-[var(--color-border)]",
          isDragging && "shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
        )}
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

        {/* Header (Draggable Area) - optimized height and colors */}
        {container.style.showHeader !== false && (
          <div 
            ref={dragHandleRef}
            {...listeners}
            className="flex items-center justify-between px-2 py-1 transition-colors cursor-move touch-none"
            style={{ backgroundColor: 'transparent' }} // Inherits inner color
          >
            <span className="text-xs font-medium text-[var(--color-text)] opacity-80 pointer-events-none">
              {container.name}
            </span>
            <div className="flex gap-1 relative">
              <Popover>
                {({ close }) => (
                  <>
                    <Popover.Button 
                      as="button"
                      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()} 
                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--color-text-secondary)] transition-colors cursor-pointer focus:outline-none"
                    >
                      <Settings size={12} />
                    </Popover.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="opacity-0 translate-y-1"
                      enterTo="opacity-100 translate-y-0"
                      leave="transition ease-in duration-150"
                      leaveFrom="opacity-100 translate-y-0"
                      leaveTo="opacity-0 translate-y-1"
                    >
                      <Popover.Panel 
                        className="absolute z-50 mt-2 top-full right-0 w-72"
                        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                      >
                        <ContainerSettings container={container} onClose={close} />
                      </Popover.Panel>
                    </Transition>
                  </>
                )}
              </Popover>
            </div>
          </div>
        )}

        {/* Body - Relative for free layout */}
        <div className="relative flex-1 overflow-hidden">
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={cn(
              "w-full h-full p-2 flex gap-1 overflow-y-auto relative hidden-native-scrollbar",
              layoutStyle
            )}
          >
            {container.items.map(item => (
              <FileItem key={item.id} item={item} containerStyle={container.style} />
            ))}
            {container.items.length === 0 && (
              <div className="w-full h-full flex items-center justify-center text-sm text-[var(--color-text-secondary)] opacity-50 pointer-events-none">
                Drag items here
              </div>
            )}
          </div>
          
          {/* Custom Animated Scrollbar Thumb */}
          <div 
            ref={thumbRef}
            className={cn(
              "absolute top-0 right-1 w-1.5 bg-black/40 dark:bg-white/40 rounded-full pointer-events-none",
              "transition-opacity duration-300 ease-in-out",
              isScrolling ? "opacity-100" : "opacity-0"
            )}
          />
        </div>

        {/* Resize Handle (Bottom Left) */}
        <div 
          className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 opacity-0 hover:opacity-100 transition-opacity"
          onPointerDown={(e) => handleResizePointerDown(e, 'bl')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)] transform -scale-x-100">
            <polyline points="22 12 22 22 12 22"></polyline>
            <line x1="22" y1="22" x2="12" y2="12"></line>
          </svg>
        </div>

        {/* Resize Handle (Bottom Right) */}
        <div 
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 opacity-0 hover:opacity-100 transition-opacity"
          onPointerDown={(e) => handleResizePointerDown(e, 'br')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
            <polyline points="22 12 22 22 12 22"></polyline>
            <line x1="22" y1="22" x2="12" y2="12"></line>
          </svg>
        </div>
      </motion.div>
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

import { useState, useRef, useEffect, RefObject } from 'react'

interface Position {
  x: number
  y: number
}

interface DragOptions {
  onDragEnd?: (pos: Position) => void
  onDragStart?: () => void
  disabled?: boolean
  dragHandleRef?: RefObject<HTMLElement | null>
}

export function useDrag(initialPos: Position, options?: DragOptions) {
  const [pos, setPos] = useState<Position>(initialPos)
  const [isDragging, setIsDragging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  
  // Use a ref for current position so onPointerUp always has latest value
  const currentPos = useRef<Position>(initialPos)

  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    elemStartX: 0,
    elemStartY: 0,
    dragging: false,
    hasMoved: false
  })

  // Synchronize initialPos if it changes from parent (e.g. after grid snap)
  useEffect(() => {
    if (!dragInfo.current.dragging) {
      setPos(initialPos)
      currentPos.current = initialPos
    }
  }, [initialPos.x, initialPos.y, isDragging])

  const onPointerDown = (e: React.PointerEvent) => {
    if (options?.disabled) return
    if (e.button !== 0) return // Only left click

    // If dragHandleRef is provided, only allow dragging from that handle
    if (options?.dragHandleRef?.current) {
      if (!options.dragHandleRef.current.contains(e.target as Node)) {
        return
      }
    }

    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: currentPos.current.x,
      elemStartY: currentPos.current.y,
      dragging: true,
      hasMoved: false
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.current.dragging) return

    const dx = e.clientX - dragInfo.current.startX
    const dy = e.clientY - dragInfo.current.startY

    // Only set isDragging true if moved more than a few pixels to distinguish from click
    if (!dragInfo.current.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      dragInfo.current.hasMoved = true
      setIsDragging(true)
      options?.onDragStart?.()
    }

    if (dragInfo.current.hasMoved) {
      const newPos = {
        x: dragInfo.current.elemStartX + dx,
        y: dragInfo.current.elemStartY + dy,
      }
      setPos(newPos)
      currentPos.current = newPos
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragInfo.current.dragging) return
    
    const target = e.currentTarget as HTMLElement
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId)
    }

    dragInfo.current.dragging = false
    setIsDragging(false)
    
    if (dragInfo.current.hasMoved) {
      // Use ref for latest position, not stale React state
      options?.onDragEnd?.(currentPos.current)
    }
  }

  return {
    ref,
    pos,
    isDragging,
    listeners: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    }
  }
}

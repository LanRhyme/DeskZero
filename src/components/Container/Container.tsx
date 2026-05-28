import { useState, useRef, useCallback } from 'react'
import type { Container as ContainerType, Position } from '@/types/container'
import ContainerHeader from './ContainerHeader'
import ContainerBody from './ContainerBody'

interface Props {
  container: ContainerType
  onMove: (position: Position) => void
}

export default function Container({ container, onMove }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragOffset.current = {
      x: e.clientX - container.position.x,
      y: e.clientY - container.position.y,
    }
  }, [container.position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    onMove({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    })
  }, [isDragging, onMove])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  return (
    <div
      className="absolute flex flex-col"
      style={{
        left: container.position.x,
        top: container.position.y,
        width: container.size.width,
        height: container.size.height,
        borderRadius: container.style.cornerRadius,
        background: 'var(--color-bg)',
        backdropFilter: 'var(--container-blur)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--color-border)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {container.style.showHeader && (
        <ContainerHeader
          name={container.name}
          onMouseDown={handleMouseDown}
        />
      )}
      <ContainerBody items={container.items} />
    </div>
  )
}

interface MenuItemDef {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface Props {
  items: MenuItemDef[]
  position: { x: number; y: number }
  onClose: () => void
}

export default function ContextMenu({ items, position, onClose }: Props) {
  return (
    <div
      className="fixed z-50 min-w-48 py-1 rounded-lg shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        backdropFilter: 'var(--container-blur)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="w-full text-left px-3 py-2 text-sm transition-colors"
          style={{ color: 'var(--color-text)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          disabled={item.disabled}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

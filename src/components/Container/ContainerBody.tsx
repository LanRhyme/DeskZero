import type { Item } from '@/types/item'

interface Props {
  items: Item[]
}

export default function ContainerBody({ items }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-2">
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          拖放文件到此处
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center p-2 rounded-md cursor-pointer"
              style={{ background: 'var(--item-bg)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--item-bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--item-bg)'
              }}
            >
              <div className="w-10 h-10 flex items-center justify-center text-2xl">
                {item.type === 'folder' ? '📁' : item.type === 'shortcut' ? '🔗' : '📄'}
              </div>
              <span className="text-xs mt-1 text-center truncate w-full" style={{ color: 'var(--color-text)' }}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

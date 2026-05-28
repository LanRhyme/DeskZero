import type { Item } from '@/types/item'
import { openFile } from '@/services/fileService'

interface Props {
  item: Item
}

export default function FileItem({ item }: Props) {
  return (
    <div
      className="flex flex-col items-center p-2 rounded-md cursor-pointer"
      style={{ background: 'var(--item-bg)' }}
      onDoubleClick={() => openFile(item.path)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--item-bg-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--item-bg)'
      }}
    >
      <div className="w-10 h-10 flex items-center justify-center text-2xl">📄</div>
      <span className="text-xs mt-1 text-center truncate w-full" style={{ color: 'var(--color-text)' }}>
        {item.name}
      </span>
    </div>
  )
}

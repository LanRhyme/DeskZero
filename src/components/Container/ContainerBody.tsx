import type { Item } from '@/types/item'
import FileItem from '@/components/Item/FileItem'
import FolderItem from '@/components/Item/FolderItem'
import ShortcutItem from '@/components/Item/ShortcutItem'

interface Props {
  items: Item[]
}

function renderItem(item: Item) {
  switch (item.type) {
    case 'folder':
      return <FolderItem key={item.id} item={item} />
    case 'shortcut':
      return <ShortcutItem key={item.id} item={item} />
    default:
      return <FileItem key={item.id} item={item} />
  }
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
          {items.map(renderItem)}
        </div>
      )}
    </div>
  )
}

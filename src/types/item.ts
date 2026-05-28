export type ItemType = 'file' | 'folder' | 'shortcut' | 'url'

export interface Item {
  id: string
  name: string
  path: string
  iconPath: string
  type: ItemType
  targetPath?: string
  isInContainer: boolean
  containerId?: string
}

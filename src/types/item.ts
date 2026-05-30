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
  position?: { x: number; y: number }
  size?: number
  modifiedAt?: number
}

import type { Item } from './item'

export type ContainerType = 'normal' | 'mapping' | 'folder'

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface ContainerStyle {
  backgroundOpacity: number
  cornerRadius: number
  showHeader: boolean
}

export interface Container {
  id: string
  name: string
  type: ContainerType
  position: Position
  size: Size
  items: Item[]
  style: ContainerStyle
  folderPath?: string
  createdAt: number
  updatedAt: number
}

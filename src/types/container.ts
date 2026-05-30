import type { Item } from './item'

export type ContainerType = 'normal' | 'mapping' | 'folder' | 'game'

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
  backgroundColor?: string
  cornerRadius: number
  showHeader: boolean
  layout?: 'grid' | 'list'
  gridEnabled?: boolean
  gridWidth?: number
  gridHeight?: number
  gridGapX?: number
  gridGapY?: number
  iconSize?: string
  showDetails?: boolean
  hideAppNames?: boolean
  coverImage?: string
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

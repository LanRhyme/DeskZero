export type Theme = 'light' | 'dark' | 'system'
export type IconSize = 'small' | 'medium' | 'large'
export type ItemBackground = 'transparent' | 'subtle' | 'visible'
export type SelectedItemBackground = 'white' | 'black'

export interface Settings {
  theme: Theme
  accentColor: string
  gridEnabled: boolean
  gridSize: number
  iconSize: IconSize
  cornerRadius: number
  backgroundBlur: boolean
  wallpaperCompatible: boolean
  itemBackground: ItemBackground
  selectedItemBackground: SelectedItemBackground
  selectedItemBlur: boolean
  globalBlur: boolean
}

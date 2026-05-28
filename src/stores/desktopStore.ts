import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { Item } from '@/types/item'

interface DesktopItem extends Item {
  position?: { x: number, y: number }
}

interface DesktopState {
  items: DesktopItem[]
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchDesktopItems: () => Promise<void>
  moveItemToDesktop: (item: Item, x: number, y: number) => void
  removeItem: (id: string) => void
  updateItemPosition: (id: string, x: number, y: number) => void
}

const GRID_W = 85
const GRID_H = 110

// Find nearest empty slot using a spiral search
function findEmptySlot(x: number, y: number, items: DesktopItem[]): { x: number, y: number } {
  const maxLoops = 50
  
  // Snap to grid first (with 20px padding from top/left)
  let targetX = Math.round(Math.max(0, x - 20) / GRID_W) * GRID_W + 20
  let targetY = Math.round(Math.max(0, y - 20) / GRID_H) * GRID_H + 20

  let layer = 0
  let currentX = targetX
  let currentY = targetY

  while (layer < maxLoops) {
    if (layer === 0) {
      if (!items.some(i => !i.isInContainer && i.position?.x === currentX && i.position?.y === currentY)) {
        return { x: currentX, y: currentY }
      }
      layer++
      continue
    }

    // Check layer in a spiral
    for (let dx = -layer; dx <= layer; dx++) {
      for (let dy = -layer; dy <= layer; dy++) {
        if (Math.abs(dx) === layer || Math.abs(dy) === layer) {
          const checkX = targetX + dx * GRID_W
          const checkY = targetY + dy * GRID_H
          if (checkX >= 0 && checkY >= 0) {
            if (!items.some(i => !i.isInContainer && i.position?.x === checkX && i.position?.y === checkY)) {
              return { x: checkX, y: checkY }
            }
          }
        }
      }
    }
    layer++
  }

  return { x: targetX, y: targetY } // fallback
}

export const useDesktopStore = create<DesktopState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchDesktopItems: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await invoke<any[]>('scan_desktop_icons')
      
      let currentX = 20
      let currentY = 20
      const screenH = window.innerHeight

      const normalizedItems: DesktopItem[] = []
      
      for (const item of items) {
        // Find empty slot for initialization starting at column top
        const slot = findEmptySlot(currentX, currentY, normalizedItems)
        
        normalizedItems.push({
          id: item.id,
          name: item.name,
          path: item.path,
          iconPath: item.icon_path || '',
          type: item.item_type?.toLowerCase() || 'file',
          targetPath: item.target_path,
          isInContainer: false,
          position: slot
        })

        currentY += GRID_H
        if (currentY + GRID_H > screenH) {
          currentY = 20
          currentX += GRID_W
        }
      }

      set({ items: normalizedItems, isLoading: false })
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false })
    }
  },

  moveItemToDesktop: (item, x, y) => {
    set((state) => {
      const slot = findEmptySlot(x, y, state.items)
      return {
        items: [...state.items, { ...item, isInContainer: false, containerId: undefined, position: slot }]
      }
    })
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter(item => item.id !== id)
    }))
  },

  updateItemPosition: (id, x, y) => {
    set((state) => {
      // Find item
      const item = state.items.find(i => i.id === id)
      if (!item) return state

      // Only check collision with OTHER items
      const otherItems = state.items.filter(i => i.id !== id)
      const slot = findEmptySlot(x, y, otherItems)

      return {
        items: state.items.map(item => 
          item.id === id ? { ...item, position: slot } : item
        )
      }
    })
  }
}))

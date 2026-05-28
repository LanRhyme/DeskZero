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
  
  selectedIds: Set<string>
  
  // Actions
  fetchDesktopItems: () => Promise<void>
  moveItemToDesktop: (item: Item, x: number, y: number) => void
  removeItem: (id: string) => void
  updateItemPosition: (id: string, x: number, y: number) => void
  moveSelectedItems: (draggedId: string, newX: number, newY: number) => void
  
  toggleSelection: (id: string, ctrlKey: boolean) => void
  clearSelection: () => void
  setSelection: (ids: string[]) => void
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

export const useDesktopStore = create<DesktopState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,
  selectedIds: new Set(),

  fetchDesktopItems: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await invoke<any[]>('scan_desktop_icons')
      
      let currentX = 20
      let currentY = 20
      const screenH = window.innerHeight

      const normalizedItems: DesktopItem[] = []
      
      const savedLayoutStr = localStorage.getItem('deskzero_layout')
      const savedLayout: Record<string, {x: number, y: number}> = savedLayoutStr ? JSON.parse(savedLayoutStr) : {}
      
      for (const item of items) {
        let slot: {x: number, y: number}
        if (savedLayout[item.id]) {
          slot = savedLayout[item.id]
        } else {
          slot = findEmptySlot(currentX, currentY, normalizedItems)
          currentY += GRID_H
          if (currentY + GRID_H > screenH) {
            currentY = 20
            currentX += GRID_W
          }
        }
        
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
      }

      // Save the updated layout to persist newly added items
      const newLayout = normalizedItems.reduce((acc, i) => {
        if (!i.isInContainer && i.position) {
          acc[i.id] = i.position
        }
        return acc
      }, {} as Record<string, {x: number, y: number}>)
      localStorage.setItem('deskzero_layout', JSON.stringify(newLayout))

      // Clean up selectedIds to remove deleted items
      const newSelectedIds = new Set(Array.from(get().selectedIds).filter(id => normalizedItems.some(i => i.id === id)))

      set({ items: normalizedItems, selectedIds: newSelectedIds, isLoading: false })
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false })
    }
  },

  moveItemToDesktop: (item, x, y) => {
    set((state) => {
      const slot = findEmptySlot(x, y, state.items)
      const newItems = [...state.items, { ...item, isInContainer: false, containerId: undefined, position: slot }]
      
      const newLayout = newItems.reduce((acc, i) => {
        if (!i.isInContainer && i.position) acc[i.id] = i.position;
        return acc;
      }, {} as Record<string, {x: number, y: number}>)
      localStorage.setItem('deskzero_layout', JSON.stringify(newLayout))
      
      return { items: newItems }
    })
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter(item => item.id !== id),
      selectedIds: new Set(Array.from(state.selectedIds).filter(sid => sid !== id))
    }))
  },

  updateItemPosition: (id, x, y) => {
    set((state) => {
      const item = state.items.find(i => i.id === id)
      if (!item) return state

      const otherItems = state.items.filter(i => i.id !== id)
      const slot = findEmptySlot(x, y, otherItems)

      const newItems = state.items.map(item => 
        item.id === id ? { ...item, position: slot } : item
      )
      
      const newLayout = newItems.reduce((acc, i) => {
        if (!i.isInContainer && i.position) acc[i.id] = i.position;
        return acc;
      }, {} as Record<string, {x: number, y: number}>)
      localStorage.setItem('deskzero_layout', JSON.stringify(newLayout))

      return { items: newItems }
    })
  },

  moveSelectedItems: (draggedId, newX, newY) => {
    set((state) => {
      const draggedItem = state.items.find(i => i.id === draggedId)
      if (!draggedItem || !draggedItem.position) return state

      let selection = state.selectedIds
      if (!selection.has(draggedId)) {
        selection = new Set([draggedId])
      }

      const draggedOldX = draggedItem.position.x
      const draggedOldY = draggedItem.position.y
      
      const unselectedItems = state.items.filter(i => !selection.has(i.id))
      const selectedItems = state.items.filter(i => selection.has(i.id))
      
      let placedItems = [...unselectedItems]
      const newItems = [...state.items]
      
      // Process draggedId first
      const draggedTarget = findEmptySlot(newX, newY, placedItems)
      const dx = draggedTarget.x - draggedOldX
      const dy = draggedTarget.y - draggedOldY
      
      for (const item of selectedItems) {
        if (!item.position) continue;
        const idx = newItems.findIndex(i => i.id === item.id)
        if (item.id === draggedId) {
          newItems[idx] = { ...item, position: draggedTarget }
          placedItems.push(newItems[idx])
        } else {
          const targetX = item.position.x + dx
          const targetY = item.position.y + dy
          const slot = findEmptySlot(targetX, targetY, placedItems)
          newItems[idx] = { ...item, position: slot }
          placedItems.push(newItems[idx])
        }
      }

      const newLayout = newItems.reduce((acc, i) => {
        if (!i.isInContainer && i.position) acc[i.id] = i.position;
        return acc;
      }, {} as Record<string, {x: number, y: number}>)
      localStorage.setItem('deskzero_layout', JSON.stringify(newLayout))

      return { items: newItems, selectedIds: selection }
    })
  },
  
  toggleSelection: (id, ctrlKey) => {
    set((state) => {
      const newSet = new Set(ctrlKey ? state.selectedIds : [])
      if (ctrlKey && newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return { selectedIds: newSet }
    })
  },
  
  clearSelection: () => {
    set({ selectedIds: new Set() })
  },
  
  setSelection: (ids) => {
    set({ selectedIds: new Set(ids) })
  }
}))

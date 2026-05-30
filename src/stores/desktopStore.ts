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
  moveSelectedItems: (draggedItemId: string, targetX: number, targetY: number) => void
  swapItemsPosition: (id1: string, id2: string) => void
  realignToGrid: () => void
  sortDesktopItems: (by: 'name' | 'type' | 'date' | 'size') => void
  
  toggleSelection: (id: string, ctrlKey: boolean) => void
  clearSelection: () => void
  setSelection: (ids: string[]) => void
  wallpaper: string | null
  setWallpaper: (wallpaper: string | null) => void
  
  isIconsHidden: boolean
  setIsIconsHidden: (hidden: boolean) => void
}

import { useSettingsStore } from './settingsStore'
import { useContainerStore } from './containerStore'

async function saveLayout(layout: Record<string, {x: number, y: number}>) {
  try {
    await invoke('save_desktop_layout', { layout })
  } catch (e) {
    console.error('Failed to save layout', e)
  }
  localStorage.setItem('deskzero_layout', JSON.stringify(layout))
}

function getGridSize() {
  const settings = useSettingsStore.getState().settings
  return { 
    w: settings.gridWidth || 80, 
    h: settings.gridHeight || 104,
    gapX: settings.gridGapX ?? 20,
    gapY: settings.gridGapY ?? 20
  }
}

// Find nearest empty slot using a spiral search
function findEmptySlot(x: number, y: number, items: DesktopItem[]): { x: number, y: number } {
  const settings = useSettingsStore.getState().settings
  if (!settings.gridEnabled) {
    return { x, y }
  }

  const maxLoops = 50
  const grid = getGridSize()
  const stepX = grid.w + grid.gapX
  const stepY = grid.h + grid.gapY
  const screenW = window?.screen?.width ?? window?.innerWidth ?? 1920
  const screenH = window?.screen?.height ?? window?.innerHeight ?? 1080
  
  // Snap to grid first (with 10px padding from top/left)
  let targetX = Math.round(Math.max(0, x - 10) / stepX) * stepX + 10
  let targetY = Math.round(Math.max(0, y - 10) / stepY) * stepY + 10

  // Constrain target to screen (ensure at least grid.w/h is visible)
  targetX = Math.min(targetX, screenW - grid.w)
  targetY = Math.min(targetY, screenH - grid.h)

  const containers = useContainerStore.getState().containers

  const isOccupied = (checkX: number, checkY: number) => {
    // Check intersection with other items (bounding box overlap)
    const hitItem = items.some(i => {
      if (i.isInContainer || !i.position) return false
      return checkX < i.position.x + grid.w && checkX + grid.w > i.position.x &&
             checkY < i.position.y + grid.h && checkY + grid.h > i.position.y
    })
    if (hitItem) return true

    // Check intersection with containers
    const hitContainer = containers.some(c => {
      return checkX < c.position.x + c.size.width && checkX + grid.w > c.position.x &&
             checkY < c.position.y + c.size.height && checkY + grid.h > c.position.y
    })
    return hitContainer
  }

  let layer = 0
  let currentX = targetX
  let currentY = targetY

  while (layer < maxLoops) {
    if (layer === 0) {
      if (!isOccupied(currentX, currentY)) {
        return { x: currentX, y: currentY }
      }
      layer++
      continue
    }

    // Check layer in a spiral
    for (let dx = -layer; dx <= layer; dx++) {
      for (let dy = -layer; dy <= layer; dy++) {
        if (Math.abs(dx) === layer || Math.abs(dy) === layer) {
          const checkX = targetX + dx * stepX
          const checkY = targetY + dy * stepY
          if (checkX >= 0 && checkY >= 0 && checkX <= screenW - grid.w && checkY <= screenH - grid.h) {
            if (!isOccupied(checkX, checkY)) {
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
  isLoading: true,
  error: null,
  selectedIds: new Set(),
  wallpaper: null,
  isIconsHidden: localStorage.getItem('deskzero_icons_hidden') === 'true',
  
  setWallpaper: (wallpaper) => set({ wallpaper }),
  setIsIconsHidden: (hidden) => {
    localStorage.setItem('deskzero_icons_hidden', hidden ? 'true' : 'false')
    set({ isIconsHidden: hidden })
  },

  fetchDesktopItems: async () => {
    set({ isLoading: true, error: null })
    try {
      const fetchPromise = async () => {
        const items = await invoke<any[]>('scan_desktop_icons')
        
        let currentX = 10
        let currentY = 10
        const screenH = window?.screen?.height ?? window?.innerHeight ?? 1080
        const grid = getGridSize()

        const normalizedItems: DesktopItem[] = []
        
        let savedLayout: Record<string, {x: number, y: number}> = {}
        try {
          const result = await invoke('get_desktop_layout')
          if (result && typeof result === 'object') savedLayout = result as any
        } catch (e) {
          console.warn('Failed to get layout from backend, fallback to local', e)
          const savedLayoutStr = localStorage.getItem('deskzero_layout')
          if (savedLayoutStr) {
            try {
              const parsed = JSON.parse(savedLayoutStr)
              if (parsed && typeof parsed === 'object') savedLayout = parsed
            } catch(err) {}
          }
        }
        savedLayout = savedLayout || {}
        
        const containers = useContainerStore.getState().containers
        const containerItemIds = new Set<string>()
        containers.forEach(c => c.items.forEach(i => containerItemIds.add(i.id)))
        
        // Sort items alphabetically (A-Z) for consistent initial layout
        items.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase()
          const nameB = (b.name || '').toLowerCase()
          // Put System items (like This PC / Recycle Bin) first
          const isSystemA = a.type === 'system' || a.item_type === 'System'
          const isSystemB = b.type === 'system' || b.item_type === 'System'
          if (isSystemA && !isSystemB) return -1
          if (!isSystemA && isSystemB) return 1
          return nameA.localeCompare(nameB)
        })
        
        for (const item of items) {
          if (containerItemIds.has(item.id)) {
            // Skip calculating layout for items in container, they won't be rendered here anyway
            normalizedItems.push({
              id: item.id,
              name: item.name,
              path: item.path,
              iconPath: item.iconPath || item.icon_path || '',
              type: (item.type || item.item_type)?.toLowerCase() || 'file',
              targetPath: item.targetPath || item.target_path,
              isInContainer: true,
              position: undefined,
              size: item.size,
              modifiedAt: item.modifiedAt || item.modified_at
            })
            continue
          }

          let slot: {x: number, y: number}
          if (savedLayout[item.id]) {
            slot = savedLayout[item.id]
          } else if (savedLayout[item.name]) {
            slot = savedLayout[item.name]
          } else {
            slot = findEmptySlot(currentX, currentY, normalizedItems)
            currentY += stepY
            if (currentY + grid.h > screenH) {
              currentY = 10
              currentX += stepX
            }
          }
          
          normalizedItems.push({
            id: item.id,
            name: item.name,
            path: item.path,
            iconPath: item.iconPath || item.icon_path || '',
            type: (item.type || item.item_type)?.toLowerCase() || 'file',
            targetPath: item.targetPath || item.target_path,
            isInContainer: false,
            position: slot,
            size: item.size,
            modifiedAt: item.modifiedAt || item.modified_at
          })
        }

        // Save the updated layout to persist newly added items
        const newLayout = normalizedItems.reduce((acc, i) => {
          if (!i.isInContainer && i.position) {
            acc[i.id] = i.position
          }
          return acc
        }, {} as Record<string, {x: number, y: number}>)
        saveLayout(newLayout)

        // Clean up selectedIds to remove deleted items
        const newSelectedIds = new Set(Array.from(get().selectedIds).filter(id => normalizedItems.some(i => i.id === id)))
        
        return { normalizedItems, newSelectedIds }
      }

      const timeoutPromise = new Promise<{normalizedItems: DesktopItem[], newSelectedIds: Set<string>}>((_, reject) => 
        setTimeout(() => reject(new Error("Timeout scanning desktop icons")), 10000)
      )

      const { normalizedItems, newSelectedIds } = await Promise.race([fetchPromise(), timeoutPromise])

      set({ items: normalizedItems, selectedIds: newSelectedIds })
    } catch (err: any) {
      console.error("fetchDesktopItems error:", err)
      set({ error: err.toString() })
    } finally {
      set({ isLoading: false })
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
      saveLayout(newLayout)
      
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
      saveLayout(newLayout)

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
      saveLayout(newLayout)

      return { items: newItems, selectedIds: selection }
    })
  },
  
  swapItemsPosition: (id1: string, id2: string) => {
    set((state) => {
      const idx1 = state.items.findIndex(i => i.id === id1)
      const idx2 = state.items.findIndex(i => i.id === id2)
      if (idx1 !== -1 && idx2 !== -1) {
        const newItems = [...state.items]
        const tempPos = newItems[idx1].position
        newItems[idx1].position = newItems[idx2].position
        newItems[idx2].position = tempPos
        
        const newLayout = newItems.reduce((acc, i) => {
          if (!i.isInContainer && i.position) acc[i.id] = i.position;
          return acc;
        }, {} as Record<string, {x: number, y: number}>)
        saveLayout(newLayout)
        
        return { items: newItems }
      }
      return state
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
  },
  
  realignToGrid: () => {
    set((state) => {
      const newItems = state.items.map(item => ({ ...item }));
      const placedItems: DesktopItem[] = [];
      
      for (const item of newItems) {
        if (!item.isInContainer && item.position) {
          const slot = findEmptySlot(item.position.x, item.position.y, placedItems);
          item.position = slot;
          placedItems.push({ ...item });
        }
      }
      
      const newLayout = newItems.reduce((acc, i) => {
        if (!i.isInContainer && i.position) acc[i.id] = i.position;
        return acc;
      }, {} as Record<string, {x: number, y: number}>);
      saveLayout(newLayout);
      
      return { items: newItems };
    })
  },
  
  sortDesktopItems: (by) => {
    set((state) => {
      const itemsToMap = state.items.filter(i => !i.isInContainer)
      const inContainerItems = state.items.filter(i => i.isInContainer)
      
      itemsToMap.sort((a, b) => {
        switch (by) {
          case 'name':
            return a.name.localeCompare(b.name, 'zh-CN')
          case 'type':
            return a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'zh-CN')
          case 'date':
            return (b.modifiedAt || 0) - (a.modifiedAt || 0)
          case 'size':
            return (b.size || 0) - (a.size || 0)
          default:
            return 0
        }
      })
      
      const grid = getGridSize()
      const screenH = window?.screen?.height ?? window?.innerHeight ?? 1080
      const stepX = grid.w + grid.gapX
      const stepY = grid.h + grid.gapY
      
      let currentX = 10
      let currentY = 10
      const newLayout: Record<string, {x: number, y: number}> = {}
      const placedItems: DesktopItem[] = []
      
      itemsToMap.forEach(item => {
        const slot = findEmptySlot(currentX, currentY, placedItems)
        item.position = slot
        newLayout[item.id] = slot
        placedItems.push(item)
        
        currentY = slot.y + stepY
        if (currentY + grid.h > screenH) {
          currentY = 10
          currentX = slot.x + stepX
        }
      })
      
      saveLayout(newLayout)
      
      return { items: [...inContainerItems, ...itemsToMap] }
    })
  }
}))

import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { Container, Position, Size } from '@/types/container'
import type { Item } from '@/types/item'

const persistContainer = async (container: Container) => {
  try {
    await invoke('update_container_full', { container })
  } catch (err) {
    console.error('Failed to persist container:', err)
  }
}

interface ContainerState {
  containers: Container[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchContainers: () => Promise<void>
  createContainer: (name: string, type: Container['type'], position: Position) => Promise<Container>
  updateContainerPosition: (id: string, position: Position) => void
  updateContainerSize: (id: string, size: Size) => void
  updateContainerStyle: (id: string, style: Partial<Container['style']>) => void
  updateContainerName: (id: string, name: string) => void
  deleteContainer: (id: string) => Promise<void>
  addItemToContainer: (containerId: string, item: Item) => void
  removeItemFromContainer: (containerId: string, itemId: string) => void
  updateItemPositionInContainer: (containerId: string, itemId: string, position: { x: number, y: number }) => void
  reorderItemsInContainer: (containerId: string, index1: number, index2: number) => void
}

export const useContainerStore = create<ContainerState>((set, get) => ({
  containers: [],
  isLoading: false,
  error: null,

  fetchContainers: async () => {
    set({ isLoading: true, error: null })
    try {
      const fetchPromise = invoke<Container[]>('get_all_containers')
      const timeoutPromise = new Promise<Container[]>((_, reject) => 
        setTimeout(() => reject(new Error("Timeout loading containers")), 5000)
      )
      const containers = await Promise.race([fetchPromise, timeoutPromise])
      set({ containers })
    } catch (err: any) {
      console.error("fetchContainers error:", err)
      set({ error: err.toString() })
    } finally {
      set({ isLoading: false })
    }
  },

  createContainer: async (name, type, position) => {
    try {
      let finalName = name;
      const existingNames = get().containers.map(c => c.name);
      if (existingNames.includes(finalName)) {
        let counter = 2;
        while (existingNames.includes(`${name} (${counter})`)) {
          counter++;
        }
        finalName = `${name} (${counter})`;
      }
      
      const newContainer = await invoke<Container>('create_container', { name: finalName, containerType: type, position })
      set((state) => ({ containers: [...state.containers, newContainer] }))
      const updated = get().containers.find(c => c.id === newContainer.id)
      if (updated) persistContainer(updated)
      return updated!
    } catch (err: any) {
      console.error(err)
      window.alert('创建收纳盒容器失败: ' + String(err))
      throw err;
    }
  },

  updateContainerPosition: (id, position) => {
    set((state) => ({
      containers: state.containers.map(c => 
        c.id === id ? { ...c, position } : c
      )
    }))
    const updated = get().containers.find(c => c.id === id)
    if (updated) persistContainer(updated)
  },

  updateContainerSize: (id, size) => {
    set((state) => ({
      containers: state.containers.map(c => 
        c.id === id ? { ...c, size } : c
      )
    }))
    const updated = get().containers.find(c => c.id === id)
    if (updated) persistContainer(updated)
  },

  updateContainerStyle: (id, style) => {
    set((state) => ({
      containers: state.containers.map(c => 
        c.id === id ? { ...c, style: { ...c.style, ...style } } : c
      )
    }))
    const updated = get().containers.find(c => c.id === id)
    if (updated) persistContainer(updated)
  },

  updateContainerName: (id, name) => {
    set((state) => ({
      containers: state.containers.map(c => 
        c.id === id ? { ...c, name } : c
      )
    }))
    const updated = get().containers.find(c => c.id === id)
    if (updated) persistContainer(updated)
  },

  deleteContainer: async (id) => {
    try {
      await invoke('delete_container', { id })
      set((state) => ({
        containers: state.containers.filter(c => c.id !== id)
      }))
      // Release items back to desktop
      const { useDesktopStore } = await import('./desktopStore')
      useDesktopStore.getState().fetchDesktopItems()
    } catch (err: any) {
      console.error(err)
    }
  },

  addItemToContainer: (containerId, item) => {
    set((state) => ({
      containers: state.containers.map(c => {
        if (c.id === containerId) {
          const newItem = { ...item, isInContainer: true, containerId, position: undefined }
          return { ...c, items: [...c.items, newItem] }
        }
        return c
      })
    }))
    const updated = get().containers.find(c => c.id === containerId)
    if (updated) persistContainer(updated)
  },

  removeItemFromContainer: (containerId, itemId) => {
    set((state) => ({
      containers: state.containers.map(c => {
        if (c.id === containerId) {
          return { ...c, items: c.items.filter(i => i.id !== itemId) }
        }
        return c
      })
    }))
    const updated = get().containers.find(c => c.id === containerId)
    if (updated) persistContainer(updated)
  },

  updateItemPositionInContainer: (containerId, itemId, position) => {
    set((state) => ({
      containers: state.containers.map(c => {
        if (c.id === containerId) {
          return {
            ...c,
            items: c.items.map(i => i.id === itemId ? { ...i, position } : i)
          }
        }
        return c
      })
    }))
    const updated = get().containers.find(c => c.id === containerId)
    if (updated) persistContainer(updated)
  },

  reorderItemsInContainer: (containerId, index1, index2) => {
    set((state) => ({
      containers: state.containers.map(c => {
        if (c.id === containerId) {
          const newItems = [...c.items]
          const temp = newItems[index1]
          newItems[index1] = newItems[index2]
          newItems[index2] = temp
          return { ...c, items: newItems }
        }
        return c
      })
    }))
    const updated = get().containers.find(c => c.id === containerId)
    if (updated) persistContainer(updated)
  }
}))

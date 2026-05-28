import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { Container, Position, Size } from '@/types/container'
import type { Item } from '@/types/item'

interface ContainerState {
  containers: Container[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchContainers: () => Promise<void>
  createContainer: (name: string, type: Container['type'], position: Position) => Promise<void>
  updateContainerPosition: (id: string, position: Position) => void
  updateContainerSize: (id: string, size: Size) => void
  deleteContainer: (id: string) => Promise<void>
  addItemToContainer: (containerId: string, item: Item) => void
  removeItemFromContainer: (containerId: string, itemId: string) => void
}

export const useContainerStore = create<ContainerState>((set) => ({
  containers: [],
  isLoading: false,
  error: null,

  fetchContainers: async () => {
    set({ isLoading: true, error: null })
    try {
      const containers = await invoke<Container[]>('get_all_containers')
      set({ containers, isLoading: false })
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false })
    }
  },

  createContainer: async (name, type, position) => {
    try {
      const newContainer = await invoke<Container>('create_container', { name, type, position })
      set((state) => ({ containers: [...state.containers, newContainer] }))
    } catch (err: any) {
      console.error(err)
    }
  },

  updateContainerPosition: (id, position) => {
    set((state) => ({
      containers: state.containers.map(c => 
        c.id === id ? { ...c, position } : c
      )
    }))
    // Optional: invoke('update_container', ...)
  },

  updateContainerSize: (id, size) => {
    set((state) => ({
      containers: state.containers.map(c => 
        c.id === id ? { ...c, size } : c
      )
    }))
  },

  deleteContainer: async (id) => {
    try {
      await invoke('delete_container', { id })
      set((state) => ({
        containers: state.containers.filter(c => c.id !== id)
      }))
    } catch (err: any) {
      console.error(err)
    }
  },

  addItemToContainer: (containerId, item) => {
    set((state) => ({
      containers: state.containers.map(c => {
        if (c.id === containerId) {
          const newItem = { ...item, isInContainer: true, containerId }
          return { ...c, items: [...c.items, newItem] }
        }
        return c
      })
    }))
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
  }
}))

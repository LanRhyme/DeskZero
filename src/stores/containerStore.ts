import { create } from 'zustand'
import type { Container, Position, Size } from '@/types/container'
import * as containerService from '@/services/containerService'

interface ContainerState {
  containers: Container[]
  loading: boolean
  error: string | null
  loadContainers: () => Promise<void>
  createContainer: (name: string, type: Container['type'], position: Position) => Promise<void>
  updateContainer: (id: string, changes: { name?: string; position?: Position; size?: Size }) => Promise<void>
  deleteContainer: (id: string) => Promise<void>
  moveContainer: (id: string, position: Position) => Promise<void>
}

export const useContainerStore = create<ContainerState>((set, get) => ({
  containers: [],
  loading: false,
  error: null,

  loadContainers: async () => {
    set({ loading: true, error: null })
    try {
      const containers = await containerService.getAllContainers()
      set({ containers, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  createContainer: async (name, type, position) => {
    try {
      const container = await containerService.createContainer(name, type, position)
      set((state) => ({ containers: [...state.containers, container] }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  updateContainer: async (id, changes) => {
    try {
      const updated = await containerService.updateContainer(id, changes)
      set((state) => ({
        containers: state.containers.map((c) => (c.id === id ? updated : c)),
      }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  deleteContainer: async (id) => {
    try {
      await containerService.deleteContainer(id)
      set((state) => ({
        containers: state.containers.filter((c) => c.id !== id),
      }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  moveContainer: async (id, position) => {
    set((state) => ({
      containers: state.containers.map((c) =>
        c.id === id ? { ...c, position } : c
      ),
    }))
    try {
      await containerService.updateContainer(id, { position })
    } catch (err) {
      set({ error: String(err) })
      get().loadContainers()
    }
  },
}))

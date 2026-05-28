import { invoke } from '@tauri-apps/api/core'
import type { Container, ContainerType, Position, Size } from '@/types/container'

export async function getAllContainers(): Promise<Container[]> {
  return invoke('get_all_containers')
}

export async function createContainer(
  name: string,
  type: ContainerType,
  position: Position
): Promise<Container> {
  return invoke('create_container', { name, containerType: type, position })
}

export async function updateContainer(
  id: string,
  changes: { name?: string; position?: Position; size?: Size }
): Promise<Container> {
  return invoke('update_container', { id, ...changes })
}

export async function deleteContainer(id: string): Promise<void> {
  return invoke('delete_container', { id })
}

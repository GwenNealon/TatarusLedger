import type { NormalizedItem } from '../../data/types.ts'

interface ItemsArtifactPayload {
  version: string
  items: NormalizedItem[]
}

function isNormalizedItem(value: unknown): value is NormalizedItem {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'number' &&
    typeof item.name === 'string' &&
    typeof item.iconId === 'number' &&
    typeof item.levelItem === 'number' &&
    typeof item.rarity === 'number' &&
    typeof item.uiCategory === 'number'
  )
}

function isItemsArtifactPayload(value: unknown): value is ItemsArtifactPayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Record<string, unknown>
  return (
    typeof payload.version === 'string' &&
    Array.isArray(payload.items) &&
    payload.items.every((entry) => isNormalizedItem(entry))
  )
}

const APP_BASE_PATH =
  import.meta.env.BASE_URL === '/'
    ? '/TatarusLedger/'
    : import.meta.env.BASE_URL

export async function loadItemsIndex(): Promise<NormalizedItem[]> {
  const itemsUrl = `${APP_BASE_PATH}data/items.json`
  const response = await fetch(itemsUrl)
  if (!response.ok) {
    throw new Error(`Failed to load item index (${response.status.toString()})`)
  }

  const payload: unknown = await response.json()
  if (!isItemsArtifactPayload(payload)) {
    throw new Error('Invalid item index payload')
  }

  return payload.items
}

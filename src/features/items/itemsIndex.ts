import type { NormalizedItem } from '../../data/types.ts'

const APP_BASE_PATH =
  import.meta.env.BASE_URL === '/'
    ? '/TatarusLedger/'
    : import.meta.env.BASE_URL
const XIVAPI_BASE = 'https://v2.xivapi.com/api'
const PAGE_SIZE = 1_000

interface ItemsArtifactPayload {
  version: string
  items: NormalizedItem[]
}

interface XivApiItemEntry {
  row_id: number
  fields: Record<string, unknown>
}

interface XivApiItemsPage {
  rows: XivApiItemEntry[]
}

interface XivApiGamePatchEntry {
  fields: Record<string, unknown>
}

interface XivApiGamePatchPage {
  rows: XivApiGamePatchEntry[]
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

function isXivApiItemEntry(value: unknown): value is XivApiItemEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry = value as Record<string, unknown>
  return (
    typeof entry.row_id === 'number' &&
    typeof entry.fields === 'object' &&
    entry.fields !== null
  )
}

function isXivApiItemsPage(value: unknown): value is XivApiItemsPage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Record<string, unknown>
  return (
    Array.isArray(payload.rows) &&
    payload.rows.every((row) => isXivApiItemEntry(row))
  )
}

function isXivApiGamePatchPage(value: unknown): value is XivApiGamePatchPage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Record<string, unknown>
  if (!Array.isArray(payload.rows)) {
    return false
  }

  return payload.rows.every((row) => {
    if (typeof row !== 'object' || row === null) {
      return false
    }
    const entry = row as Record<string, unknown>
    return typeof entry.fields === 'object' && entry.fields !== null
  })
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

export async function loadCachedItemsIndex(): Promise<NormalizedItem[]> {
  const itemsUrl = `${APP_BASE_PATH}data/items.json`
  const response = await fetch(itemsUrl)
  if (!response.ok) {
    return []
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return []
  }

  const payload: unknown = await response.json()
  if (!isItemsArtifactPayload(payload)) {
    return []
  }

  return payload.items
}

export async function loadItemsIndex(): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = []
  let after: number | undefined

  for (;;) {
    const url = new URL(`${XIVAPI_BASE}/sheet/Item`)
    url.searchParams.set('language', 'en')
    url.searchParams.set('limit', PAGE_SIZE.toString())
    url.searchParams.set(
      'fields',
      'Name,Icon@as(raw),LevelItem@as(raw),Rarity,ItemUICategory@as(raw),IsUntradable',
    )
    if (after !== undefined) {
      url.searchParams.set('after', after.toString())
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `Failed to load item index (${response.status.toString()})`,
      )
    }

    const payload: unknown = await response.json()
    if (!isXivApiItemsPage(payload)) {
      throw new Error('Invalid item index payload')
    }

    const pageEntries = payload.rows
    if (pageEntries.length === 0) {
      break
    }

    for (const entry of pageEntries) {
      const name = entry.fields.Name
      if (typeof name !== 'string' || name === '' || entry.row_id === 0) {
        continue
      }
      if (entry.fields.IsUntradable === true) {
        continue
      }

      const rarityValue = Number(entry.fields.Rarity)
      const item: NormalizedItem = {
        id: entry.row_id,
        name,
        iconId: Number(entry.fields['Icon@as(raw)']) || 0,
        levelItem: Number(entry.fields['LevelItem@as(raw)']) || 0,
        rarity: Number.isFinite(rarityValue) ? rarityValue : 1,
        uiCategory: Number(entry.fields['ItemUICategory@as(raw)']) || 0,
      }
      if (!isNormalizedItem(item)) {
        continue
      }
      items.push(item)
    }

    const nextAfter = pageEntries[pageEntries.length - 1].row_id
    if (after !== undefined && nextAfter <= after) {
      break
    }
    after = nextAfter
  }

  return items
}

function readPatchValue(fields: Record<string, unknown>): string | null {
  const patchValue = fields.Version ?? fields.Name
  if (typeof patchValue !== 'string' || patchValue.trim() === '') {
    return null
  }

  return patchValue
}

export async function loadLatestPatchVersion(): Promise<string | null> {
  const url = new URL(`${XIVAPI_BASE}/sheet/GamePatch`)
  url.searchParams.set('language', 'en')
  url.searchParams.set('limit', '1')
  url.searchParams.set('fields', 'Version,Name')

  const response = await fetch(url)
  if (!response.ok) {
    return null
  }

  const payload: unknown = await response.json()
  if (!isXivApiGamePatchPage(payload)) {
    return null
  }

  for (const row of payload.rows) {
    const patchValue = readPatchValue(row.fields)
    if (patchValue !== null) {
      return patchValue
    }
  }

  return null
}

import type { NormalizedItem } from '../src/data/types.ts'

const XIVAPI_BASE = 'https://v2.xivapi.com/api'
const PAGE_SIZE = 1_000

interface XivApiItemEntry {
  row_id: number
  fields: Record<string, unknown>
}

interface XivApiItemsPage {
  rows: XivApiItemEntry[]
}

interface FetchXivApiItemsOptions {
  fetchInit?: RequestInit
  baseUrl?: string
  pageSize?: number
}

function toSafeInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  return fallback
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

function toNormalizedItem(entry: XivApiItemEntry): NormalizedItem | null {
  const name = entry.fields.Name
  if (typeof name !== 'string' || name === '' || entry.row_id === 0) {
    return null
  }
  if (entry.fields.IsUntradable === true) {
    return null
  }

  const rarityValue = Number(entry.fields.Rarity)
  return {
    id: entry.row_id,
    name,
    iconId: toSafeInt(entry.fields['Icon@as(raw)'], 0),
    levelItem: toSafeInt(entry.fields['LevelItem@as(raw)'], 0),
    rarity: Number.isFinite(rarityValue) ? rarityValue : 1,
    uiCategory: toSafeInt(entry.fields['ItemUICategory@as(raw)'], 0),
  }
}

/**
 * Fetches all tradable items from XIVAPI's Item sheet using cursor pagination.
 */
export async function fetchXivApiItems(
  options: FetchXivApiItemsOptions = {},
): Promise<NormalizedItem[]> {
  const { fetchInit, baseUrl = XIVAPI_BASE, pageSize = PAGE_SIZE } = options

  const items: NormalizedItem[] = []
  let after: number | undefined

  for (;;) {
    const url = new URL(`${baseUrl}/sheet/Item`)
    url.searchParams.set('language', 'en')
    url.searchParams.set('limit', pageSize.toString())
    url.searchParams.set(
      'fields',
      'Name,Icon@as(raw),LevelItem@as(raw),Rarity,ItemUICategory@as(raw),IsUntradable',
    )
    if (after !== undefined) {
      url.searchParams.set('after', after.toString())
    }

    const response = await fetch(url, fetchInit)
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
      const item = toNormalizedItem(entry)
      if (item !== null) {
        items.push(item)
      }
    }

    const nextAfter = pageEntries[pageEntries.length - 1].row_id
    if (!Number.isFinite(nextAfter) || nextAfter <= 0 || nextAfter === after) {
      break
    }

    after = nextAfter
  }

  return items
}

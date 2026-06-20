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

function toSafeInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  return fallback
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
  fetchInit?: RequestInit,
): Promise<NormalizedItem[]> {
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

    const response = await fetch(url, fetchInit)
    if (!response.ok) {
      throw new Error(
        `Failed to load item index (${response.status.toString()})`,
      )
    }

    const payload = (await response.json()) as XivApiItemsPage
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

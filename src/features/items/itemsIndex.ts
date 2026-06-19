import type { NormalizedItem } from '../../data/types.ts'

const XIVAPI_BASE = 'https://v2.xivapi.com/api'
const PAGE_SIZE = 1_000

interface XivApiRow {
  row_id: number
  fields: Record<string, unknown>
}

interface XivApiSheetResponse {
  rows: XivApiRow[]
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

function isXivApiSheetResponse(value: unknown): value is XivApiSheetResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Record<string, unknown>
  return Array.isArray(payload.rows)
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
    if (!isXivApiSheetResponse(payload)) {
      throw new Error('Invalid item index payload')
    }

    const pageRows = payload.rows
    if (pageRows.length === 0) {
      break
    }

    for (const row of pageRows) {
      const name = row.fields.Name
      if (typeof name !== 'string' || name === '' || row.row_id === 0) {
        continue
      }
      if (row.fields.IsUntradable === true) {
        continue
      }

      const item: NormalizedItem = {
        id: row.row_id,
        name,
        iconId: Number(row.fields['Icon@as(raw)']) || 0,
        levelItem: Number(row.fields['LevelItem@as(raw)']) || 0,
        rarity: Number(row.fields.Rarity) || 1,
        uiCategory: Number(row.fields['ItemUICategory@as(raw)']) || 0,
      }
      if (!isNormalizedItem(item)) {
        continue
      }
      items.push(item)
    }

    const nextAfter = pageRows[pageRows.length - 1].row_id
    if (after !== undefined && nextAfter <= after) {
      break
    }
    after = nextAfter
  }

  return items
}

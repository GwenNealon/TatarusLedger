import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface XivApiItemEntry {
  row_id: number
  fields: Record<string, unknown>
}

interface XivApiItemsPage {
  rows: XivApiItemEntry[]
}

interface ItemArtifact {
  version: string
  items: {
    id: number
    name: string
    iconId: number
    levelItem: number
    rarity: number
    uiCategory: number
  }[]
}

const XIVAPI_BASE = 'https://v2.xivapi.com/api'
const PAGE_SIZE = 1_000

function toSafeInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  return fallback
}

async function fetchItems(): Promise<ItemArtifact['items']> {
  const items: ItemArtifact['items'] = []
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

    const response = await fetch(url, {
      headers: {
        'Accept-Encoding': 'identity',
      },
    })
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url.toString()}: HTTP ${response.status.toString()}`,
      )
    }

    const payload: unknown = await response.json()
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !Array.isArray((payload as XivApiItemsPage).rows)
    ) {
      throw new Error('Invalid item payload from XIVAPI')
    }

    const pageEntries = (payload as XivApiItemsPage).rows
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

      items.push({
        id: entry.row_id,
        name,
        iconId: toSafeInt(entry.fields['Icon@as(raw)'], 0),
        levelItem: toSafeInt(entry.fields['LevelItem@as(raw)'], 0),
        rarity: toSafeInt(entry.fields.Rarity, 1),
        uiCategory: toSafeInt(entry.fields['ItemUICategory@as(raw)'], 0),
      })
    }

    const nextAfter = pageEntries[pageEntries.length - 1].row_id
    if (after !== undefined && nextAfter <= after) {
      break
    }
    after = nextAfter
  }

  return items
}

async function run(): Promise<void> {
  const version = process.argv[2] ?? 'unknown'
  const items = await fetchItems()

  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'public',
    'data',
  )
  await mkdir(outDir, { recursive: true })

  const artifact: ItemArtifact = {
    version,
    items,
  }

  await writeFile(join(outDir, 'items.json'), JSON.stringify(artifact), 'utf8')
  console.log(`Wrote ${items.length.toString()} items to ${outDir}`)
}

await run()

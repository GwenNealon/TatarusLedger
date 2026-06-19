import type { NormalizedItem } from './types.ts'

/**
 * Normalizes a single raw row from Item.csv into a compact {@link NormalizedItem}.
 *
 * Returns `null` for placeholder rows (id 0 or empty name) that are not
 * real in-game items.
 */
export function normalizeItem(
  row: Record<string, string>,
): NormalizedItem | null {
  const id = parseInt(row['#'] || '', 10)
  if (!Number.isFinite(id) || id === 0) return null

  const name = row.Name
  if (!name) return null

  const iconValue = row.IconID || row.Icon || '0'
  const levelItemValue = row['Level{Item}'] || row.LevelItem || '0'
  const uiCategoryValue = row.UICategory || row.ItemUICategory || '0'

  return {
    id,
    name,
    iconId: parseInt(iconValue, 10),
    levelItem: parseInt(levelItemValue, 10),
    rarity: parseInt(row.Rarity || '1', 10),
    uiCategory: parseInt(uiCategoryValue, 10),
  }
}

/**
 * Normalizes all rows from Item.csv into a compact array of
 * {@link NormalizedItem} objects, filtering out placeholder/empty rows.
 */
export function normalizeItems(
  rows: Record<string, string>[],
): NormalizedItem[] {
  const result: NormalizedItem[] = []
  for (const row of rows) {
    const item = normalizeItem(row)
    if (item !== null) result.push(item)
  }
  return result
}

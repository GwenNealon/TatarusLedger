import { describe, expect, it } from 'vitest'
import { normalizeItem, normalizeItems } from './normalizeItems.ts'

const makeRow = (
  overrides: Record<string, string> = {},
): Record<string, string> => ({
  '#': '1',
  Name: 'Bronze Sword',
  IconID: '20000',
  'Level{Item}': '1',
  Rarity: '1',
  UICategory: '2',
  ...overrides,
})

describe('normalizeItem', () => {
  it('normalizes a valid row into a NormalizedItem', () => {
    const item = normalizeItem(makeRow())
    expect(item).toEqual({
      id: 1,
      name: 'Bronze Sword',
      iconId: 20000,
      levelItem: 1,
      rarity: 1,
      uiCategory: 2,
    })
  })

  it('returns null for id 0 (placeholder row)', () => {
    expect(normalizeItem(makeRow({ '#': '0' }))).toBeNull()
  })

  it('returns null when id is missing or non-numeric', () => {
    expect(normalizeItem(makeRow({ '#': '' }))).toBeNull()
    expect(normalizeItem(makeRow({ '#': 'abc' }))).toBeNull()
  })

  it('returns null when Name is empty', () => {
    expect(normalizeItem(makeRow({ Name: '' }))).toBeNull()
  })

  it('defaults missing numeric fields to 0', () => {
    const item = normalizeItem(
      makeRow({ IconID: '', 'Level{Item}': '', UICategory: '' }),
    )
    expect(item?.iconId).toBe(0)
    expect(item?.levelItem).toBe(0)
    expect(item?.uiCategory).toBe(0)
  })

  it('defaults missing Rarity to 1', () => {
    const item = normalizeItem(makeRow({ Rarity: '' }))
    expect(item?.rarity).toBe(1)
  })

  it('parses high item-level values correctly', () => {
    const item = normalizeItem(
      makeRow({ 'Level{Item}': '660', IconID: '65498' }),
    )
    expect(item?.levelItem).toBe(660)
    expect(item?.iconId).toBe(65498)
  })
})

describe('normalizeItems', () => {
  it('returns an empty array for empty input', () => {
    expect(normalizeItems([])).toEqual([])
  })

  it('filters out null items (id 0 or empty name)', () => {
    const rows = [
      makeRow({ '#': '0' }),
      makeRow({ Name: '' }),
      makeRow({ '#': '5', Name: 'Iron Sword' }),
    ]
    const items = normalizeItems(rows)
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(5)
  })

  it('preserves order of valid items', () => {
    const rows = [
      makeRow({ '#': '1', Name: 'Sword' }),
      makeRow({ '#': '2', Name: 'Shield' }),
      makeRow({ '#': '3', Name: 'Staff' }),
    ]
    const items = normalizeItems(rows)
    expect(items.map((i) => i.id)).toEqual([1, 2, 3])
  })
})

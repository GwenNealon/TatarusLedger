import { describe, expect, it } from 'vitest'
import { normalizeRecipe, normalizeRecipes } from './normalizeRecipes.ts'

const makeRow = (
  overrides: Record<string, string> = {},
): Record<string, string> => ({
  '#': '1',
  CraftType: '0',
  RecipeLevelTable: '1',
  'Item{Result}': '10',
  'Amount{Result}': '1',
  'Item{Ingredient0}': '5',
  'Amount{Ingredient0}': '3',
  'Item{Ingredient1}': '6',
  'Amount{Ingredient1}': '1',
  'Item{Ingredient2}': '0',
  'Amount{Ingredient2}': '0',
  'Item{Ingredient3}': '0',
  'Amount{Ingredient3}': '0',
  'Item{Ingredient4}': '0',
  'Amount{Ingredient4}': '0',
  'Item{Ingredient5}': '0',
  'Amount{Ingredient5}': '0',
  'Item{Ingredient6}': '0',
  'Amount{Ingredient6}': '0',
  'Item{Ingredient7}': '0',
  'Amount{Ingredient7}': '0',
  'Item{Ingredient8}': '0',
  'Amount{Ingredient8}': '0',
  'Item{Ingredient9}': '0',
  'Amount{Ingredient9}': '0',
  ...overrides,
})

describe('normalizeRecipe', () => {
  it('normalizes a valid row into a NormalizedRecipe', () => {
    const recipe = normalizeRecipe(makeRow())
    expect(recipe).toEqual({
      id: 1,
      resultItemId: 10,
      resultAmount: 1,
      craftType: 0,
      recipeLevelTable: 1,
      ingredients: [
        { itemId: 5, amount: 3 },
        { itemId: 6, amount: 1 },
      ],
    })
  })

  it('returns null for id 0', () => {
    expect(normalizeRecipe(makeRow({ '#': '0' }))).toBeNull()
  })

  it('returns null when id is missing or non-numeric', () => {
    expect(normalizeRecipe(makeRow({ '#': '' }))).toBeNull()
    expect(normalizeRecipe(makeRow({ '#': 'abc' }))).toBeNull()
  })

  it('returns null when Item{Result} is 0', () => {
    expect(normalizeRecipe(makeRow({ 'Item{Result}': '0' }))).toBeNull()
  })

  it('returns null when Item{Result} is missing', () => {
    expect(normalizeRecipe(makeRow({ 'Item{Result}': '' }))).toBeNull()
  })

  it('only includes ingredients with itemId > 0 and amount > 0', () => {
    const recipe = normalizeRecipe(
      makeRow({
        'Item{Ingredient0}': '7',
        'Amount{Ingredient0}': '0', // amount 0 → excluded
        'Item{Ingredient1}': '0',
        'Amount{Ingredient1}': '5', // itemId 0 → excluded
      }),
    )
    expect(recipe?.ingredients).toEqual([])
  })

  it('handles all 10 ingredient slots', () => {
    const overrides: Record<string, string> = {
      'Item{Ingredient0}': '0',
      'Amount{Ingredient0}': '0',
      'Item{Ingredient1}': '0',
      'Amount{Ingredient1}': '0',
    }
    for (let i = 2; i < 10; i++) {
      const slot = String(i)
      overrides[`Item{Ingredient${slot}}`] = String(100 + i)
      overrides[`Amount{Ingredient${slot}}`] = '1'
    }
    const recipe = normalizeRecipe(makeRow(overrides))
    expect(recipe?.ingredients).toHaveLength(8)
    expect(recipe?.ingredients[0].itemId).toBe(102)
    expect(recipe?.ingredients[7].itemId).toBe(109)
  })

  it('defaults missing numeric fields to 0 or 1', () => {
    const recipe = normalizeRecipe(
      makeRow({ CraftType: '', RecipeLevelTable: '', 'Amount{Result}': '' }),
    )
    expect(recipe?.craftType).toBe(0)
    expect(recipe?.recipeLevelTable).toBe(0)
    expect(recipe?.resultAmount).toBe(1)
  })

  it('parses craftType correctly for all eight disciplines', () => {
    for (let type = 0; type < 8; type++) {
      const recipe = normalizeRecipe(makeRow({ CraftType: String(type) }))
      expect(recipe?.craftType).toBe(type)
    }
  })
})

describe('normalizeRecipes', () => {
  it('returns an empty array for empty input', () => {
    expect(normalizeRecipes([])).toEqual([])
  })

  it('filters out null recipes', () => {
    const rows = [
      makeRow({ '#': '0' }),
      makeRow({ 'Item{Result}': '0' }),
      makeRow({ '#': '3', 'Item{Result}': '15' }),
    ]
    const recipes = normalizeRecipes(rows)
    expect(recipes).toHaveLength(1)
    expect(recipes[0].id).toBe(3)
  })

  it('preserves order of valid recipes', () => {
    const rows = [
      makeRow({ '#': '1', 'Item{Result}': '10' }),
      makeRow({ '#': '2', 'Item{Result}': '20' }),
      makeRow({ '#': '3', 'Item{Result}': '30' }),
    ]
    const recipes = normalizeRecipes(rows)
    expect(recipes.map((r) => r.id)).toEqual([1, 2, 3])
  })
})

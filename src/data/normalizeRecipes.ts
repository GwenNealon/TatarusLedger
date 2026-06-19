import type { NormalizedIngredient, NormalizedRecipe } from './types.ts'

const INGREDIENT_SLOTS = 10

function readField(
  row: Partial<Record<string, string>>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== '') {
      return value
    }
  }
  return ''
}

/**
 * Normalizes a single raw row from Recipe.csv into a compact
 * {@link NormalizedRecipe}.
 *
 * Returns `null` for invalid rows (id 0 or missing result item).
 */
export function normalizeRecipe(
  row: Record<string, string>,
): NormalizedRecipe | null {
  const id = parseInt(row['#'] || '', 10)
  if (!Number.isFinite(id) || id === 0) return null

  const resultItemId = parseInt(
    readField(row, 'Item{Result}', 'ItemResult') || '0',
    10,
  )
  if (resultItemId === 0) return null

  const ingredients: NormalizedIngredient[] = []
  for (let i = 0; i < INGREDIENT_SLOTS; i++) {
    const slot = String(i)
    const itemId = parseInt(
      readField(row, `Item{Ingredient${slot}}`, `Ingredient[${slot}]`) || '0',
      10,
    )
    const amount = parseInt(
      readField(
        row,
        `Amount{Ingredient${slot}}`,
        `AmountIngredient[${slot}]`,
      ) || '0',
      10,
    )
    if (itemId > 0 && amount > 0) {
      ingredients.push({ itemId, amount })
    }
  }

  return {
    id,
    resultItemId,
    resultAmount: parseInt(
      readField(row, 'Amount{Result}', 'AmountResult') || '1',
      10,
    ),
    craftType: parseInt(row.CraftType || '0', 10),
    recipeLevelTable: parseInt(row.RecipeLevelTable || '0', 10),
    ingredients,
  }
}

/**
 * Normalizes all rows from Recipe.csv into a compact array of
 * {@link NormalizedRecipe} objects, filtering out invalid/empty rows.
 */
export function normalizeRecipes(
  rows: Record<string, string>[],
): NormalizedRecipe[] {
  const result: NormalizedRecipe[] = []
  for (const row of rows) {
    const recipe = normalizeRecipe(row)
    if (recipe !== null) result.push(recipe)
  }
  return result
}

/** A normalized item from the FFXIV datamining source. */
export interface NormalizedItem {
  id: number
  name: string
  iconId: number
  levelItem: number
  rarity: number
  uiCategory: number
}

/** A single ingredient in a recipe. */
export interface NormalizedIngredient {
  itemId: number
  amount: number
}

/** A normalized recipe from the FFXIV datamining source. */
export interface NormalizedRecipe {
  id: number
  resultItemId: number
  resultAmount: number
  craftType: number
  /** Index into RecipeLevelTable; use to determine required crafting level. */
  recipeLevelTable: number
  ingredients: NormalizedIngredient[]
}

/** Compact JSON artifact written to public/data/items.json. */
export interface ItemsArtifact {
  /** Patch version string (e.g. "7.2") recorded at generation time. */
  version: string
  items: NormalizedItem[]
}

/** Compact JSON artifact written to public/data/recipes.json. */
export interface RecipesArtifact {
  /** Patch version string (e.g. "7.2") recorded at generation time. */
  version: string
  recipes: NormalizedRecipe[]
}

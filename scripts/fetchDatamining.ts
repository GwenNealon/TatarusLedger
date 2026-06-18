/**
 * Fetch and normalize item/recipe metadata from the xivapi/ffxiv-datamining
 * repository and write compact JSON artifacts to public/data/.
 *
 * Usage (requires Node.js >= 22.6):
 *   node --experimental-strip-types scripts/fetchDatamining.ts [version]
 *
 * The optional [version] argument is a patch string (e.g. "7.2") embedded in
 * the output artifacts so consumers can detect staleness.  Defaults to "unknown".
 *
 * Output files:
 *   public/data/items.json    – ItemsArtifact
 *   public/data/recipes.json  – RecipesArtifact
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseDataminingCsv } from '../src/data/parseDataminingCsv.ts'
import { normalizeItems } from '../src/data/normalizeItems.ts'
import { normalizeRecipes } from '../src/data/normalizeRecipes.ts'
import type { ItemsArtifact, RecipesArtifact } from '../src/data/types.ts'

const DATAMINING_BASE =
  'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv'

async function fetchCsv(name: string): Promise<string> {
  const url = `${DATAMINING_BASE}/${name}`
  console.log(`Fetching ${url} …`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: HTTP ${response.status.toString()}`,
    )
  }
  return response.text()
}

async function run(): Promise<void> {
  const version = process.argv[2] ?? 'unknown'

  const [itemCsv, recipeCsv] = await Promise.all([
    fetchCsv('Item.csv'),
    fetchCsv('Recipe.csv'),
  ])

  const itemRows = parseDataminingCsv(itemCsv)
  const recipeRows = parseDataminingCsv(recipeCsv)

  const itemsArtifact: ItemsArtifact = {
    version,
    items: normalizeItems(itemRows),
  }

  const recipesArtifact: RecipesArtifact = {
    version,
    recipes: normalizeRecipes(recipeRows),
  }

  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'public',
    'data',
  )
  await mkdir(outDir, { recursive: true })

  await Promise.all([
    writeFile(
      join(outDir, 'items.json'),
      JSON.stringify(itemsArtifact),
      'utf8',
    ),
    writeFile(
      join(outDir, 'recipes.json'),
      JSON.stringify(recipesArtifact),
      'utf8',
    ),
  ])

  console.log(
    `Wrote ${itemsArtifact.items.length.toString()} items and` +
      ` ${recipesArtifact.recipes.length.toString()} recipes to ${outDir}`,
  )
}

await run()

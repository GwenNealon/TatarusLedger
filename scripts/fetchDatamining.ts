import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchXivApiItems } from '../src/data/fetchXivApiItems.ts'
import type { NormalizedItem } from '../src/data/types.ts'

interface ItemArtifact {
  version: string
  items: NormalizedItem[]
}

async function run(): Promise<void> {
  const version = process.argv[2] ?? 'unknown'
  const items = await fetchXivApiItems({
    fetchInit: {
      headers: {
        'Accept-Encoding': 'identity',
      },
    },
  })

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

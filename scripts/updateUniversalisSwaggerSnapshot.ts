import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const UNIVERSALIS_SWAGGER_URL =
  'https://universalis.app/swagger/v2/swagger.json'
const SNAPSHOT_FILE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'api',
  'universalis.swagger.v2.snapshot.json',
)

async function fetchSnapshotJson(): Promise<string> {
  const response = await fetch(UNIVERSALIS_SWAGGER_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Universalis swagger snapshot: HTTP ${response.status.toString()}`,
    )
  }

  const payload: unknown = await response.json()
  return `${JSON.stringify(payload, null, 2)}\n`
}

async function run(): Promise<void> {
  const snapshotJson = await fetchSnapshotJson()
  await writeFile(SNAPSHOT_FILE_PATH, snapshotJson, 'utf8')
  console.log(`Updated ${SNAPSHOT_FILE_PATH}`)
}

await run()

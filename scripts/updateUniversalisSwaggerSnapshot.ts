import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const UNIVERSALIS_SWAGGER_URL =
  'https://universalis.app/swagger/v2/swagger.json'
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { version: APP_VERSION } = JSON.parse(
  readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf8'),
) as { version: string }
const USER_AGENT = `TatarusLedger/${APP_VERSION} (nealon.gwen@gmail.com)`
const FETCH_TIMEOUT_MS = 30_000
const MAX_FETCH_ATTEMPTS = 3
const FETCH_BACKOFF_BASE_MS = 500
const SNAPSHOT_FILE_PATH = resolve(
  PROJECT_ROOT,
  'src',
  'api',
  'universalis.swagger.v2.snapshot.json',
)
const GENERATED_TYPES_FILE_PATH = resolve(
  PROJECT_ROOT,
  'src',
  'api',
  'universalis.swagger.v2.generated.ts',
)

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortJson(entryValue)]),
    )
  }

  return value
}

async function fetchLatestSwagger(): Promise<JsonValue> {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(UNIVERSALIS_SWAGGER_URL, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) {
          throw new Error(
            `Failed to fetch Universalis swagger snapshot: HTTP ${response.status.toString()}`,
          )
        }

        throw new Error(
          `Transient fetch failure for Universalis swagger snapshot: HTTP ${response.status.toString()}`,
        )
      }

      return (await response.json()) as JsonValue
    } catch (error) {
      if (attempt >= MAX_FETCH_ATTEMPTS) {
        throw error
      }

      const message = error instanceof Error ? error.message : ''
      const isRetryableHttpError = message.includes(
        'Transient fetch failure for Universalis swagger snapshot: HTTP',
      )
      const isRetryableNetworkError =
        error instanceof TypeError || message.includes('timed out')

      if (!isRetryableHttpError && !isRetryableNetworkError) {
        throw error
      }

      const backoffMs = FETCH_BACKOFF_BASE_MS * 2 ** (attempt - 1)
      await new Promise<void>((resolvePromise) => {
        setTimeout(resolvePromise, backoffMs)
      })
    }
  }

  throw new Error('Unreachable')
}

async function readSnapshotSwagger(): Promise<JsonValue> {
  const snapshotText = await readFile(SNAPSHOT_FILE_PATH, 'utf8')
  return JSON.parse(snapshotText) as JsonValue
}

async function updateSnapshot(): Promise<void> {
  const latestSwagger = await fetchLatestSwagger()
  const snapshotJson = `${JSON.stringify(sortJson(latestSwagger), null, 2)}\n`
  await writeFile(SNAPSHOT_FILE_PATH, snapshotJson, 'utf8')
  console.log(`Updated ${SNAPSHOT_FILE_PATH}`)
}

async function checkSnapshot(): Promise<void> {
  const [latestSwagger, snapshotSwagger] = await Promise.all([
    fetchLatestSwagger(),
    readSnapshotSwagger(),
  ])

  const latestCanonical = JSON.stringify(sortJson(latestSwagger))
  const snapshotCanonical = JSON.stringify(sortJson(snapshotSwagger))

  if (latestCanonical !== snapshotCanonical) {
    throw new Error(
      'Universalis swagger changed structurally. Run "npm run api:spec:update" and commit the updated snapshot and generated types.',
    )
  }

  console.log(
    'Universalis swagger snapshot matches latest API (format-insensitive).',
  )
}

async function checkGeneratedTypesUpToDate(): Promise<void> {
  const tempDirPath = await mkdtemp(
    resolve(tmpdir(), 'tatarus-ledger-openapi-'),
  )
  const tempTypesFilePath = resolve(
    tempDirPath,
    'universalis.swagger.v2.generated.ts',
  )

  try {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const child = spawn(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        [
          'exec',
          '--yes',
          'openapi-typescript@7.13.0',
          '--',
          SNAPSHOT_FILE_PATH,
          '-o',
          tempTypesFilePath,
        ],
        {
          cwd: PROJECT_ROOT,
          shell: process.platform === 'win32',
          stdio: 'inherit',
        },
      )

      child.on('error', rejectPromise)
      child.on('close', (code) => {
        if (code === 0) {
          resolvePromise()
          return
        }

        rejectPromise(
          new Error(
            `Command failed with exit code ${code?.toString() ?? 'unknown'}.`,
          ),
        )
      })
    })

    const [currentTypes, expectedTypes] = await Promise.all([
      readFile(GENERATED_TYPES_FILE_PATH, 'utf8'),
      readFile(tempTypesFilePath, 'utf8'),
    ])

    if (currentTypes !== expectedTypes) {
      throw new Error(
        'Generated types are out of date with the committed snapshot. Run "npm run api:spec:generate-types" and commit src/api/universalis.swagger.v2.generated.ts.',
      )
    }

    console.log('Generated Universalis API types are up to date.')
  } finally {
    await rm(tempDirPath, { force: true, recursive: true })
  }
}

async function run(): Promise<void> {
  const mode = process.argv[2] ?? 'update'

  if (mode === 'update') {
    await updateSnapshot()
    return
  }

  if (mode === 'check') {
    await checkSnapshot()
    await checkGeneratedTypesUpToDate()
    return
  }

  throw new Error(`Unknown mode "${mode}". Use "update" or "check".`)
}

await run()

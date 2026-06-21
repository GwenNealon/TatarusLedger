import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CSS_URL =
  'https://raw.githubusercontent.com/ewwwin/ffxiv-symbol-fonts/refs/heads/main/FFXIV_Lodestone_SSF.css'
const WOFF_URL =
  'https://github.com/ewwwin/ffxiv-symbol-fonts/raw/refs/heads/main/FFXIV_Lodestone_SSF.woff'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { version: APP_VERSION } = JSON.parse(
  readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf8'),
) as { version: string }
const USER_AGENT = `TatarusLedger/${APP_VERSION} (nealon.gwen@gmail.com)`
const FETCH_TIMEOUT_MS = 30_000
const MAX_FETCH_ATTEMPTS = 3
const FETCH_BACKOFF_BASE_MS = 500

const FONTS_DIR = resolve(PROJECT_ROOT, 'public', 'fonts')
const CSS_FILE_PATH = resolve(FONTS_DIR, 'FFXIV_Lodestone_SSF.css')
const WOFF_FILE_PATH = resolve(FONTS_DIR, 'FFXIV_Lodestone_SSF.woff')

async function fetchWithRetry(url: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) {
          throw new Error(
            `Failed to fetch ${url}: HTTP ${response.status.toString()}`,
          )
        }

        throw new Error(
          `Transient fetch failure for ${url}: HTTP ${response.status.toString()}`,
        )
      }

      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      if (attempt >= MAX_FETCH_ATTEMPTS) {
        throw error
      }

      const message = error instanceof Error ? error.message : ''
      const errorName =
        typeof error === 'object' && error !== null && 'name' in error
          ? String(error.name)
          : ''
      const isRetryable =
        message.includes('Transient fetch failure') ||
        error instanceof TypeError ||
        errorName === 'TimeoutError'

      if (!isRetryable) {
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

async function updateFonts(): Promise<void> {
  const [css, woff] = await Promise.all([
    fetchWithRetry(CSS_URL),
    fetchWithRetry(WOFF_URL),
  ])

  await mkdir(FONTS_DIR, { recursive: true })
  await Promise.all([
    writeFile(CSS_FILE_PATH, css),
    writeFile(WOFF_FILE_PATH, woff),
  ])

  console.log(`Updated ${CSS_FILE_PATH}`)
  console.log(`Updated ${WOFF_FILE_PATH}`)
}

async function checkFonts(): Promise<void> {
  const [remoteCss, remoteWoff, localCss, localWoff] = await Promise.all([
    fetchWithRetry(CSS_URL),
    fetchWithRetry(WOFF_URL),
    readFile(CSS_FILE_PATH),
    readFile(WOFF_FILE_PATH),
  ])

  let ok = true

  if (!remoteCss.equals(localCss)) {
    console.error(
      'FFXIV_Lodestone_SSF.css is out of date. Run "npm run fonts:ffxiv:update" and commit the updated files.',
    )
    ok = false
  }

  if (!remoteWoff.equals(localWoff)) {
    console.error(
      'FFXIV_Lodestone_SSF.woff is out of date. Run "npm run fonts:ffxiv:update" and commit the updated files.',
    )
    ok = false
  }

  if (!ok) {
    throw new Error('Font files are out of date.')
  }

  console.log('FFXIV Lodestone SSF font files are up to date.')
}

async function run(): Promise<void> {
  const mode = process.argv[2] ?? 'update'

  if (mode === 'update') {
    await updateFonts()
    return
  }

  if (mode === 'check') {
    await checkFonts()
    return
  }

  throw new Error(`Unknown mode "${mode}". Use "update" or "check".`)
}

await run()

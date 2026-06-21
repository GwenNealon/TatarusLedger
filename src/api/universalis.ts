import type { Listing, MarketData, Sale } from './types.ts'
import type { components } from './universalis/universalis.swagger.v2.generated.ts'

type ListingView =
  components['schemas']['Universalis.Application.Views.V1.ListingView']
type MinimizedSaleView =
  components['schemas']['Universalis.Application.Views.V1.MinimizedSaleView']
type CurrentlyShownView =
  components['schemas']['Universalis.Application.Views.V1.CurrentlyShownView']
type CurrentlyShownMultiViewV2 =
  components['schemas']['Universalis.Application.Views.V2.CurrentlyShownMultiViewV2']
type HistoryView =
  components['schemas']['Universalis.Application.Views.V1.HistoryView']

const BASE_URL = 'https://universalis.app/api/v2'
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BASE_DELAY_MS = 1_000

export class UniversalisError extends Error {
  readonly statusCode: number | undefined

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'UniversalisError'
    this.statusCode = statusCode
  }
}

/**
 * Query options for {@link fetchMarketBoard}.
 *
 * All query parameters map directly to the Universalis v2 API:
 * `GET /api/v2/{worldDcRegion}/{itemIds}`
 */
export interface MarketBoardOptions {
  /** Maximum number of retry attempts on failure (default: 3). */
  maxRetries?: number
  /** Base delay in milliseconds for exponential backoff (default: 1000). */
  baseDelayMs?: number
  /**
   * Number of listings to return per item.
   * By default all listings are returned.
   */
  listings?: number
  /**
   * Number of recent history entries to return per item.
   * By default a maximum of 5 entries is returned.
   */
  entries?: number
  /**
   * Filter results by quality. `true` returns only HQ, `false` returns only
   * NQ. Omit (or `undefined`) to return both.
   */
  hq?: boolean
  /**
   * The amount of time before now to calculate stats over, in milliseconds.
   * Defaults to 604 800 000 (7 days).
   */
  statsWithin?: number
  /**
   * The amount of time before now to take entries within, in seconds.
   * Negative values are ignored by the API.
   */
  entriesWithin?: number
  /**
   * A comma-separated list of fields to include in the response.
   * When querying multiple items, prefix with `items.`
   * (e.g. `"items.listings.pricePerUnit"`).
   * Omit to receive all fields.
   */
  fields?: string
}

export interface WorldInfo {
  id: number
  name: string
}

async function fetchWithRetry(
  url: string,
  maxRetries: number,
  baseDelayMs: number,
): Promise<Response> {
  const maxAttempts = Math.max(0, maxRetries)

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      url,
      typeof window === 'undefined'
        ? {
            headers: {
              'User-Agent': `TatarusLedger/${import.meta.env.VITE_APP_VERSION} (nealon.gwen@gmail.com)`,
            },
          }
        : undefined,
    )
    if (response.status === 429) {
      if (attempt >= maxAttempts) {
        throw new UniversalisError('Rate limit exceeded', 429)
      }
      const retryAfter = response.headers.get('Retry-After')
      const retryAfterSeconds =
        retryAfter !== null ? Number(retryAfter) : Number.NaN
      const delay =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1_000
          : baseDelayMs * 2 ** attempt
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay)
      })
      continue
    }

    if (!response.ok) {
      throw new UniversalisError(
        `Universalis API returned ${response.status.toString()}`,
        response.status,
      )
    }

    return response
  }

  throw new UniversalisError('Rate limit exceeded', 429)
}

function hasItemsMap(value: unknown): value is {
  items?: Record<string, CurrentlyShownView | HistoryView> | null
} {
  if (typeof value !== 'object' || value === null) return false

  // Single-item payloads always include itemID; multi-item payloads do not.
  if (
    'itemID' in value &&
    typeof (value as { itemID?: unknown }).itemID === 'number'
  ) {
    return false
  }

  if (!('items' in value)) {
    // Multi-item payloads may omit `items` when no results are returned.
    return 'itemIDs' in value || 'unresolvedItems' in value
  }

  const items = (value as { items?: unknown }).items
  return items == null || (typeof items === 'object' && !Array.isArray(items))
}

export function transformListing(raw: ListingView): Listing {
  return {
    listingId: raw.listingID ?? undefined,
    worldId: raw.worldID ?? undefined,
    worldName: raw.worldName ?? undefined,
    hq: raw.hq,
    pricePerUnit: raw.pricePerUnit,
    quantity: raw.quantity,
    total: raw.total,
    tax: raw.tax,
    retainerName: raw.retainerName ?? undefined,
    lastReviewTime: new Date(raw.lastReviewTime * 1_000),
  }
}

export function transformSale(
  raw:
    | MinimizedSaleView
    | components['schemas']['Universalis.Application.Views.V1.SaleView'],
): Sale {
  return {
    worldId: raw.worldID ?? undefined,
    worldName: raw.worldName ?? undefined,
    hq: raw.hq,
    pricePerUnit: raw.pricePerUnit,
    quantity: raw.quantity,
    timestamp: new Date(raw.timestamp * 1_000),
    buyerName: raw.buyerName ?? undefined,
  }
}
/**
 * Fetches current market board listings and recent sale history for one or
 * more items from a world, data centre, or region.
 */
export async function fetchMarketBoard(
  worldDcRegion: string,
  itemIds: number[],
  options: MarketBoardOptions = {},
): Promise<MarketData[]> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    listings,
    entries,
    hq,
    statsWithin,
    entriesWithin,
    fields,
  } = options

  const params = new URLSearchParams()
  if (listings !== undefined) params.set('listings', String(listings))
  if (entries !== undefined) params.set('entries', String(entries))
  if (hq !== undefined) params.set('hq', String(hq))
  if (statsWithin !== undefined) params.set('statsWithin', String(statsWithin))
  if (entriesWithin !== undefined)
    params.set('entriesWithin', String(entriesWithin))
  if (fields !== undefined) params.set('fields', fields)

  const query = params.size > 0 ? `?${params.toString()}` : ''
  const url = `${BASE_URL}/${encodeURIComponent(worldDcRegion)}/${itemIds.join(',')}${query}`
  const response = await fetchWithRetry(url, maxRetries, baseDelayMs)
  const raw: unknown = await response.json()

  if (hasItemsMap(raw)) {
    const data = raw as CurrentlyShownMultiViewV2
    return Object.values(data.items ?? {}).map((item) => ({
      itemId: item.itemID,
      listings: (item.listings ?? []).map(transformListing),
      sales: (item.recentHistory ?? []).map(transformSale),
    }))
  }

  const data = raw as CurrentlyShownView
  return [
    {
      itemId: data.itemID,
      listings: (data.listings ?? []).map(transformListing),
      sales: (data.recentHistory ?? []).map(transformSale),
    },
  ]
}

export async function fetchWorlds(): Promise<WorldInfo[]> {
  const response = await fetchWithRetry(
    `${BASE_URL}/worlds`,
    DEFAULT_MAX_RETRIES,
    DEFAULT_BASE_DELAY_MS,
  )
  const raw: unknown = await response.json()

  if (!Array.isArray(raw)) {
    throw new UniversalisError('Universalis world list was not an array')
  }

  return raw.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return []
    }

    const world = entry as { id?: unknown; name?: unknown }
    if (typeof world.id !== 'number' || typeof world.name !== 'string') {
      return []
    }

    return [{ id: world.id, name: world.name }]
  })
}

export async function fetchMarketableItemIds(): Promise<number[]> {
  const response = await fetchWithRetry(
    `${BASE_URL}/marketable`,
    DEFAULT_MAX_RETRIES,
    DEFAULT_BASE_DELAY_MS,
  )
  const raw: unknown = await response.json()

  if (!Array.isArray(raw)) {
    throw new UniversalisError('Universalis marketable list was not an array')
  }

  return raw.flatMap((entry) =>
    typeof entry === 'number' && Number.isInteger(entry) && entry > 0
      ? [entry]
      : [],
  )
}

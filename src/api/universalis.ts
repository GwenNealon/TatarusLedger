import pLimit from 'p-limit'
import type { Listing, MarketData, Sale } from './types.ts'
import type { components } from './universalis.swagger.v2.generated.ts'

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
type HistoryMultiViewV2 =
  components['schemas']['Universalis.Application.Views.V2.HistoryMultiViewV2']

const BASE_URL = 'https://universalis.app/api/v2'
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BASE_DELAY_MS = 1_000
const MAX_CONCURRENT_API_REQUESTS = 4
const USER_AGENT = `TatarusLedger/${import.meta.env.VITE_APP_VERSION} (nealon.gwen@gmail.com)`
const limitApiRequest = pLimit(MAX_CONCURRENT_API_REQUESTS)

export class UniversalisError extends Error {
  readonly statusCode: number | undefined

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'UniversalisError'
    this.statusCode = statusCode
  }
}

export class RateLimitError extends UniversalisError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429)
    this.name = 'RateLimitError'
  }
}

/** Options for controlling retry behaviour on API calls. */
export interface FetchOptions {
  /** Maximum number of retry attempts on failure (default: 3). */
  maxRetries?: number
  /** Base delay in milliseconds for exponential backoff (default: 1000). */
  baseDelayMs?: number
}

/**
 * Query options for {@link fetchMarketBoard}.
 *
 * All query parameters map directly to the Universalis v2 API:
 * `GET /api/v2/{worldDcRegion}/{itemIds}`
 */
export interface MarketBoardOptions extends FetchOptions {
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

/**
 * Query options for {@link fetchSaleHistory}.
 *
 * All query parameters map directly to the Universalis v2 API:
 * `GET /api/v2/history/{worldDcRegion}/{itemIds}`
 */
export interface SaleHistoryOptions extends FetchOptions {
  /**
   * Number of sale history entries to return per item.
   * Defaults to 1800; maximum is 99 999.
   */
  entriesToReturn?: number
  /**
   * The amount of time before now to calculate stats over, in milliseconds.
   * Defaults to 604 800 000 (7 days).
   */
  statsWithin?: number
  /**
   * The amount of time before {@link entriesUntil} (or now) to take entries
   * within, in seconds. Defaults to 604 800 (7 days). Negative values are
   * ignored by the API.
   */
  entriesWithin?: number
  /**
   * UNIX timestamp in seconds. Only entries recorded before this time are
   * returned. Defaults to the current time. Negative values are ignored by
   * the API.
   */
  entriesUntil?: number
  /**
   * Inclusive minimum unit sale price of entries to return.
   */
  minSalePrice?: number
  /**
   * Inclusive maximum unit sale price of entries to return.
   */
  maxSalePrice?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchWithRetry(
  url: string,
  maxRetries: number,
  baseDelayMs: number,
): Promise<Response> {
  const requestInit: RequestInit = {
    headers: {
      'User-Agent': USER_AGENT,
    },
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await limitApiRequest(async () => fetch(url, requestInit))

    if (response.status === 429) {
      if (attempt >= maxRetries) {
        throw new RateLimitError()
      }
      const retryAfter = response.headers.get('Retry-After')
      const retryAfterSeconds =
        retryAfter !== null ? Number(retryAfter) : Number.NaN
      const delay =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1_000
          : baseDelayMs * 2 ** attempt
      await sleep(delay)
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

  throw new RateLimitError()
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

export function transformSale(raw: MinimizedSaleView): Sale {
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

/**
 * Fetches recent sale history only for one or more items from a world, data
 * centre, or region.
 */
export async function fetchSaleHistory(
  worldDcRegion: string,
  itemIds: number[],
  options: SaleHistoryOptions = {},
): Promise<MarketData[]> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    entriesToReturn,
    statsWithin,
    entriesWithin,
    entriesUntil,
    minSalePrice,
    maxSalePrice,
  } = options

  const params = new URLSearchParams()
  if (entriesToReturn !== undefined)
    params.set('entriesToReturn', String(entriesToReturn))
  if (statsWithin !== undefined) params.set('statsWithin', String(statsWithin))
  if (entriesWithin !== undefined)
    params.set('entriesWithin', String(entriesWithin))
  if (entriesUntil !== undefined)
    params.set('entriesUntil', String(entriesUntil))
  if (minSalePrice !== undefined)
    params.set('minSalePrice', String(minSalePrice))
  if (maxSalePrice !== undefined)
    params.set('maxSalePrice', String(maxSalePrice))

  const query = params.size > 0 ? `?${params.toString()}` : ''
  const url = `${BASE_URL}/history/${encodeURIComponent(worldDcRegion)}/${itemIds.join(',')}${query}`
  const response = await fetchWithRetry(url, maxRetries, baseDelayMs)
  const raw: unknown = await response.json()

  if (hasItemsMap(raw)) {
    const data = raw as HistoryMultiViewV2
    return Object.values(data.items ?? {}).map((item) => ({
      itemId: item.itemID,
      listings: [],
      sales: (item.entries ?? []).map(transformSale),
    }))
  }

  const data = raw as HistoryView
  return [
    {
      itemId: data.itemID,
      listings: [],
      sales: (data.entries ?? []).map(transformSale),
    },
  ]
}

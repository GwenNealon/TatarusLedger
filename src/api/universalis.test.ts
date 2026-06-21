import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  UniversalisError,
  fetchMarketBoard,
  transformListing,
  transformSale,
} from './universalis.ts'

type RawListing = Parameters<typeof transformListing>[0]
type RawSale = Parameters<typeof transformSale>[0]

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RAW_LISTING: RawListing = {
  listingID: 'abc123',
  hq: true,
  isCrafted: true,
  onMannequin: false,
  pricePerUnit: 10_000,
  quantity: 1,
  total: 10_000,
  tax: 500,
  retainerCity: 1,
  stainID: 0,
  retainerName: 'Tataru',
  worldID: 73,
  worldName: 'Balmung',
  lastReviewTime: 1_700_000_000,
}

const RAW_SALE: RawSale = {
  hq: false,
  pricePerUnit: 8_000,
  quantity: 3,
  timestamp: 1_700_000_200,
  buyerName: 'BuyerA',
  worldID: 73,
  worldName: 'Balmung',
}

// ---------------------------------------------------------------------------
// Unit tests: transformListing
// ---------------------------------------------------------------------------

describe('transformListing', () => {
  it('maps all fields from a raw listing', () => {
    const listing = transformListing(RAW_LISTING)

    expect(listing.listingId).toBe('abc123')
    expect(listing.hq).toBe(true)
    expect(listing.pricePerUnit).toBe(10_000)
    expect(listing.quantity).toBe(1)
    expect(listing.total).toBe(10_000)
    expect(listing.tax).toBe(500)
    expect(listing.retainerName).toBe('Tataru')
    expect(listing.worldId).toBe(73)
    expect(listing.worldName).toBe('Balmung')
    expect(listing.lastReviewTime).toEqual(new Date(1_700_000_000 * 1_000))
  })

  it('converts unix timestamp to a Date', () => {
    const listing = transformListing({ ...RAW_LISTING, lastReviewTime: 0 })
    expect(listing.lastReviewTime).toEqual(new Date(0))
  })

  it('sets worldName to undefined when absent', () => {
    const listing = transformListing({
      listingID: 'def456',
      hq: false,
      isCrafted: true,
      onMannequin: false,
      pricePerUnit: 5_000,
      quantity: 2,
      total: 10_000,
      tax: 250,
      retainerCity: 1,
      stainID: 0,
      retainerName: 'TestRetainer',
      worldID: 74,
      lastReviewTime: 1_700_000_100,
    })
    expect(listing.worldName).toBeUndefined()
  })

  it('preserves hq: false', () => {
    const listing = transformListing({ ...RAW_LISTING, hq: false })
    expect(listing.hq).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Unit tests: transformSale
// ---------------------------------------------------------------------------

describe('transformSale', () => {
  it('maps all fields from a raw sale', () => {
    const sale = transformSale(RAW_SALE)

    expect(sale.hq).toBe(false)
    expect(sale.pricePerUnit).toBe(8_000)
    expect(sale.quantity).toBe(3)
    expect(sale.timestamp).toEqual(new Date(1_700_000_200 * 1_000))
    expect(sale.buyerName).toBe('BuyerA')
    expect(sale.worldId).toBe(73)
    expect(sale.worldName).toBe('Balmung')
  })

  it('converts unix timestamp to a Date', () => {
    const sale = transformSale({ ...RAW_SALE, timestamp: 0 })
    expect(sale.timestamp).toEqual(new Date(0))
  })

  it('sets worldName to undefined when absent', () => {
    const sale = transformSale({
      hq: true,
      pricePerUnit: 5_000,
      quantity: 1,
      timestamp: 1_700_000_300,
      buyerName: 'BuyerB',
      worldID: 74,
    })
    expect(sale.worldName).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Mocked integration tests: rate-limit handling
// ---------------------------------------------------------------------------

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function make429Response(retryAfterSeconds?: number): Response {
  const headers: Record<string, string> = {}
  if (retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(retryAfterSeconds)
  }
  return new Response(null, { status: 429, headers })
}

const SINGLE_MARKET_BODY = {
  itemID: 5,
  listings: [RAW_LISTING],
  recentHistory: [RAW_SALE],
}

const EXPECTED_USER_AGENT = `TatarusLedger/${import.meta.env.VITE_APP_VERSION} (nealon.gwen@gmail.com)`

describe('fetchMarketBoard — rate-limit handling', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns market data on a successful single-item request', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeOkResponse(SINGLE_MARKET_BODY),
    )

    const result = await fetchMarketBoard('Balmung', [5], { baseDelayMs: 0 })

    expect(result).toHaveLength(1)
    expect(result[0].itemId).toBe(5)
    expect(result[0].listings).toHaveLength(1)
    expect(result[0].sales).toHaveLength(1)
    expect(result[0].listings[0].listingId).toBe('abc123')
    expect(result[0].sales[0].buyerName).toBe('BuyerA')
  })

  it('retries after a 429 response and succeeds', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(makeOkResponse(SINGLE_MARKET_BODY))

    const result = await fetchMarketBoard('Balmung', [5], { baseDelayMs: 0 })

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(result[0].itemId).toBe(5)
  })

  it('retries with Retry-After header and succeeds', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(make429Response(1))
      .mockResolvedValueOnce(makeOkResponse(SINGLE_MARKET_BODY))

    vi.useFakeTimers()
    try {
      const promise = fetchMarketBoard('Balmung', [5])
      await vi.runAllTimersAsync()
      const result = await promise

      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
      expect(result[0].itemId).toBe(5)
    } finally {
      vi.useRealTimers()
    }
  })

  it('throws UniversalisError with 429 status after exhausting all retries', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(make429Response())

    await expect(
      fetchMarketBoard('Balmung', [5], { maxRetries: 2, baseDelayMs: 0 }),
    ).rejects.toThrow(UniversalisError)

    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('throws UniversalisError on a non-429 HTTP error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    )

    await expect(
      fetchMarketBoard('Balmung', [5], { baseDelayMs: 0 }),
    ).rejects.toThrow(UniversalisError)
  })

  it('returns data for multiple items', async () => {
    const multiBody = {
      itemIDs: [5, 6],
      items: {
        '5': { itemID: 5, listings: [], recentHistory: [] },
        '6': { itemID: 6, listings: [RAW_LISTING], recentHistory: [RAW_SALE] },
      },
    }
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeOkResponse(multiBody))

    const result = await fetchMarketBoard('Balmung', [5, 6], { baseDelayMs: 0 })

    expect(result).toHaveLength(2)
    const item6 = result.find((r) => r.itemId === 6)
    expect(item6?.listings).toHaveLength(1)
    expect(item6?.sales).toHaveLength(1)
  })

  it('handles single requested item returned in multi-shape payload', async () => {
    const multiShapeSingleItemBody = {
      itemIDs: [5],
      items: {
        '5': { itemID: 5, listings: [RAW_LISTING], recentHistory: [RAW_SALE] },
      },
    }
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeOkResponse(multiShapeSingleItemBody),
    )

    const result = await fetchMarketBoard('Balmung', [5], { baseDelayMs: 0 })

    expect(result).toHaveLength(1)
    expect(result[0].itemId).toBe(5)
    expect(result[0].listings).toHaveLength(1)
    expect(result[0].sales).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Query parameter forwarding
// ---------------------------------------------------------------------------

function capturedUrl(): string {
  const calls = vi.mocked(globalThis.fetch).mock.calls
  const lastCall = calls.at(-1)
  if (lastCall === undefined) throw new Error('No fetch call was made')
  // fetchWithRetry always passes a plain string URL as the first argument.
  return lastCall[0] as string
}

function capturedRequestInit(): RequestInit {
  const calls = vi.mocked(globalThis.fetch).mock.calls
  const lastCall = calls.at(-1)
  if (lastCall === undefined) throw new Error('No fetch call was made')
  return lastCall[1] ?? {}
}

describe('fetchMarketBoard — query parameter forwarding', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeOkResponse(SINGLE_MARKET_BODY),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appends no query string when no API options are set', async () => {
    await fetchMarketBoard('Balmung', [5], { baseDelayMs: 0 })
    expect(capturedUrl()).not.toContain('?')
  })

  it('forwards listings and entries', async () => {
    await fetchMarketBoard('Balmung', [5], {
      baseDelayMs: 0,
      listings: 10,
      entries: 20,
    })
    const url = capturedUrl()
    expect(url).toContain('listings=10')
    expect(url).toContain('entries=20')
  })

  it('forwards hq=true', async () => {
    await fetchMarketBoard('Balmung', [5], { baseDelayMs: 0, hq: true })
    expect(capturedUrl()).toContain('hq=true')
  })

  it('forwards hq=false', async () => {
    await fetchMarketBoard('Balmung', [5], { baseDelayMs: 0, hq: false })
    expect(capturedUrl()).toContain('hq=false')
  })

  it('forwards statsWithin and entriesWithin', async () => {
    await fetchMarketBoard('Balmung', [5], {
      baseDelayMs: 0,
      statsWithin: 86_400_000,
      entriesWithin: 3600,
    })
    const url = capturedUrl()
    expect(url).toContain('statsWithin=86400000')
    expect(url).toContain('entriesWithin=3600')
  })

  it('forwards fields', async () => {
    await fetchMarketBoard('Balmung', [5], {
      baseDelayMs: 0,
      fields: 'listings.pricePerUnit,listings.quantity',
    })
    expect(capturedUrl()).toContain('fields=')
    expect(capturedUrl()).toContain('pricePerUnit')
  })

  it('sends the configured User-Agent header', async () => {
    await fetchMarketBoard('Balmung', [5], { baseDelayMs: 0 })

    expect(capturedRequestInit()).toMatchObject({
      headers: {
        'User-Agent': EXPECTED_USER_AGENT,
      },
    })
  })
})

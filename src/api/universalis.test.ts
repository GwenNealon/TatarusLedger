import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RawListing, RawSale } from './types.ts'
import {
  RateLimitError,
  UniversalisError,
  fetchMarketBoard,
  fetchSaleHistory,
  transformListing,
  transformSale,
} from './universalis.ts'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RAW_LISTING: RawListing = {
  listingID: 'abc123',
  hq: true,
  pricePerUnit: 10_000,
  quantity: 1,
  total: 10_000,
  tax: 500,
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
      pricePerUnit: 5_000,
      quantity: 2,
      total: 10_000,
      tax: 250,
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

const SINGLE_HISTORY_BODY = {
  itemID: 5,
  entries: [RAW_SALE],
}

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
    const promise = fetchMarketBoard('Balmung', [5])
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(result[0].itemId).toBe(5)
  })

  it('throws RateLimitError after exhausting all retries', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(make429Response())

    await expect(
      fetchMarketBoard('Balmung', [5], { maxRetries: 2, baseDelayMs: 0 }),
    ).rejects.toThrow(RateLimitError)

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
})

describe('fetchSaleHistory — rate-limit handling', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns sale history on a successful single-item request', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeOkResponse(SINGLE_HISTORY_BODY),
    )

    const result = await fetchSaleHistory('Crystal', [5], { baseDelayMs: 0 })

    expect(result).toHaveLength(1)
    expect(result[0].itemId).toBe(5)
    expect(result[0].listings).toHaveLength(0)
    expect(result[0].sales).toHaveLength(1)
    expect(result[0].sales[0].buyerName).toBe('BuyerA')
  })

  it('retries after a 429 and succeeds', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(makeOkResponse(SINGLE_HISTORY_BODY))

    const result = await fetchSaleHistory('Crystal', [5], { baseDelayMs: 0 })

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(result[0].itemId).toBe(5)
  })

  it('throws RateLimitError after exhausting all retries', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(make429Response())

    await expect(
      fetchSaleHistory('Crystal', [5], { maxRetries: 1, baseDelayMs: 0 }),
    ).rejects.toThrow(RateLimitError)

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns data for multiple items', async () => {
    const multiBody = {
      itemIDs: [5, 6],
      items: {
        '5': { itemID: 5, entries: [] },
        '6': { itemID: 6, entries: [RAW_SALE] },
      },
    }
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeOkResponse(multiBody))

    const result = await fetchSaleHistory('Crystal', [5, 6], { baseDelayMs: 0 })

    expect(result).toHaveLength(2)
    const item6 = result.find((r) => r.itemId === 6)
    expect(item6?.sales).toHaveLength(1)
  })
})

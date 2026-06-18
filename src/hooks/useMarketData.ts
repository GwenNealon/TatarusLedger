import { useEffect, useRef, useState } from 'react'
import type { MarketData } from '../api/types.ts'
import { fetchMarketBoard } from '../api/universalis.ts'
import { Cache } from '../cache/cache.ts'
import type { FreshnessInfo } from '../cache/cache.ts'

/** Default TTL for market board data: 5 minutes. */
export const MARKET_DATA_DEFAULT_TTL_MS = 5 * 60 * 1_000

/** Shared cache instance for market board data. */
const marketBoardCache = new Cache(localStorage, 'tatarus:market:')

/** Result returned by {@link useMarketData}. */
export interface UseMarketDataResult {
  /** Cached or freshly fetched market data, or `null` while loading for the first time. */
  data: MarketData[] | null
  /** `true` while an API request is in-flight. */
  isLoading: boolean
  /** The last error from a failed fetch, or `null`. */
  error: Error | null
  /**
   * Freshness metadata for the most recently stored cache entry, or `null`
   * if data has not yet been fetched.
   *
   * Use this to display "last updated N minutes ago" or stale indicators in
   * the UI.
   */
  freshness: FreshnessInfo | null
  /**
   * Immediately re-fetch from the API regardless of the current TTL,
   * then update the cache and all returned state.
   */
  refresh: () => void
}

/**
 * Fetches market board data for the given world/DC/region and item IDs,
 * caching results in `localStorage` for `ttlMs` milliseconds.
 *
 * - On mount (and on key change) the hook reads any existing cache entry and
 *   shows it immediately without a network request when the entry is fresh.
 * - If the cache entry is absent or stale the hook fetches fresh data from the
 *   Universalis API and updates the cache.
 * - Calling `refresh()` forces a fresh API call regardless of TTL.
 *
 * **Stability**: `itemIds` is compared by value (via `.join(',')`), so a new
 * array with the same elements does not trigger a re-fetch.  Pass a stable
 * reference (e.g. a module-level constant or a `useState` value) to avoid
 * unnecessary renders.
 *
 * @param worldDcRegion - A world name, data-centre name, or region string
 *   accepted by the Universalis API (e.g. `"Balmung"`, `"Crystal"`,
 *   `"North-America"`).
 * @param itemIds - Item IDs to query.  Must be non-empty.
 * @param ttlMs - How long a cache entry is considered fresh (default: 5 min).
 */
export function useMarketData(
  worldDcRegion: string,
  itemIds: readonly number[],
  ttlMs = MARKET_DATA_DEFAULT_TTL_MS,
): UseMarketDataResult {
  // Encode itemIds as a stable string so that a new array object with the
  // same contents does not cause the effect to re-run.
  const itemIdsStr = itemIds.join(',')
  const key = `${worldDcRegion}:${itemIdsStr}`

  // Keep a ref to the latest itemIds so the fetch effect can pass the actual
  // array to fetchMarketBoard without including the (unstable) array reference
  // in the dependency list.  The ref-update effect is declared first so React
  // runs it before the fetch effect on every render where both are scheduled.
  const itemIdsRef = useRef<readonly number[]>(itemIds)
  useEffect(() => {
    itemIdsRef.current = itemIds
  }, [itemIds])

  // fetchResult stores the key + data of the most recent successful API call
  // so the component re-renders after a fetch without reading localStorage for
  // data (though freshness is still read from the cache).
  const [fetchResult, setFetchResult] = useState<{
    key: string
    data: MarketData[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [fetchTrigger, setFetchTrigger] = useState(0)
  // Tracks the last fetchTrigger the effect already processed so we can
  // distinguish a programmatic refresh from a key-change re-run.
  const lastFetchTriggerRef = useRef(0)

  // Derive data from the in-memory fetch result when it matches the current
  // key; otherwise fall back to whatever is in the persistent cache so that
  // data from a previous session (or another tab) is shown immediately.
  const data: MarketData[] | null =
    fetchResult?.key === key
      ? fetchResult.data
      : (marketBoardCache.get<MarketData[]>(key)?.data ?? null)

  // Derive freshness directly from the cache on every render so it reflects
  // the latest persisted entry (including writes by this or other tabs).
  const freshness: FreshnessInfo | null = marketBoardCache.getFreshness(key)

  useEffect(() => {
    // Determine whether this run was triggered by an explicit refresh() call.
    const isManualRefresh = lastFetchTriggerRef.current !== fetchTrigger
    lastFetchTriggerRef.current = fetchTrigger

    // Skip the network request if the cache is fresh and no manual refresh
    // was requested.  API responses are always treated as authoritative when
    // fetched, overwriting the existing cache entry.
    if (!isManualRefresh && !marketBoardCache.isStale(key)) return

    let cancelled = false

    if (itemIdsRef.current.length === 0) {
      setIsLoading(false)
      setError(new Error('useMarketData: itemIds must be non-empty'))
      return
    }

    setIsLoading(true)
    setError(null)

    void fetchMarketBoard(worldDcRegion, Array.from(itemIdsRef.current))
        if (cancelled) return
        marketBoardCache.set(key, result, ttlMs)
        setFetchResult({ key, data: result })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [key, fetchTrigger, worldDcRegion, ttlMs])

  function refresh(): void {
    setFetchTrigger((t) => t + 1)
  }

  return { data, isLoading, error, freshness, refresh }
}

import { Cache, defaultCache } from '../cache/cache';
import { MarketData, MultiItemMarketData } from '../types';

const BASE_URL = 'https://universalis.app/api/v2';

export const MARKETABLE_TTL_MS = 60 * 60 * 1000;
export const MARKET_DATA_TTL_MS = 5 * 60 * 1000;
/** Universalis allows up to 100 item IDs per request. */
export const MAX_ITEMS_PER_REQUEST = 100;

/**
 * Returns the list of item IDs currently tradeable on the Market Board.
 * Results are cached for one hour.
 */
export async function fetchMarketableItems(cache: Cache = defaultCache): Promise<number[]> {
  const cacheKey = 'universalis:marketable';
  const cached = cache.get<number[]>(cacheKey);
  if (cached !== null) return cached;

  const res = await fetch(`${BASE_URL}/marketable`);
  if (!res.ok) {
    throw new Error(`Universalis fetchMarketableItems failed: HTTP ${res.status}`);
  }
  const data: number[] = await res.json();
  cache.set(cacheKey, data, MARKETABLE_TTL_MS);
  return data;
}

/**
 * Returns current Market Board data for the given items on a world, DC, or region.
 * Pass up to `MAX_ITEMS_PER_REQUEST` item IDs per call.
 * Results are cached for five minutes.
 */
export async function fetchMarketData(
  worldOrDc: string,
  itemIds: number[],
  cache: Cache = defaultCache
): Promise<MarketData[]> {
  if (itemIds.length === 0) return [];

  const ids = itemIds.join(',');
  const cacheKey = `universalis:market:${worldOrDc}:${ids}`;
  const cached = cache.get<MarketData[]>(cacheKey);
  if (cached !== null) return cached;

  const url = `${BASE_URL}/${encodeURIComponent(worldOrDc)}/${ids}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Universalis fetchMarketData failed: HTTP ${res.status}`);
  }

  let result: MarketData[];
  if (itemIds.length === 1) {
    const data: MarketData = await res.json();
    result = [data];
  } else {
    const data: MultiItemMarketData = await res.json();
    result = Object.values(data.items);
  }

  cache.set(cacheKey, result, MARKET_DATA_TTL_MS);
  return result;
}

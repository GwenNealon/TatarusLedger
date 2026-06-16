import { Cache, defaultCache } from '../cache/cache';
import { XivItem } from '../types';

const BASE_URL = 'https://xivapi.com';

/** Item data is stable between patches; cache for 24 hours. */
export const ITEM_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Returns data for a single FFXIV item by its ID.
 * Results are cached for 24 hours.
 */
export async function fetchItem(id: number, cache: Cache = defaultCache): Promise<XivItem> {
  const cacheKey = `xivapi:item:${id}`;
  const cached = cache.get<XivItem>(cacheKey);
  if (cached !== null) return cached;

  const res = await fetch(`${BASE_URL}/item/${id}`);
  if (!res.ok) {
    throw new Error(`XIVAPI fetchItem failed: HTTP ${res.status}`);
  }
  const data: XivItem = await res.json();
  cache.set(cacheKey, data, ITEM_TTL_MS);
  return data;
}

/**
 * Returns data for multiple FFXIV items by their IDs.
 * Each item is fetched individually and cached separately.
 */
export async function fetchItems(ids: number[], cache: Cache = defaultCache): Promise<XivItem[]> {
  return Promise.all(ids.map((id) => fetchItem(id, cache)));
}

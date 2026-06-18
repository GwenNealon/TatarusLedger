import { z } from 'zod'

/** A stored cache entry with data and freshness metadata. */
export interface CacheEntry<T> {
  /** The cached payload. */
  data: T
  /** Unix millisecond timestamp when this entry was stored. */
  fetchedAt: number
  /** Time-to-live in milliseconds. */
  ttlMs: number
}

/** Freshness information for a cache entry. */
export interface FreshnessInfo {
  /** When the entry was fetched. */
  fetchedAt: Date
  /** When the entry expires. */
  expiresAt: Date
  /** Whether the entry has exceeded its TTL. */
  isStale: boolean
}

const cacheEntrySchema = z.object({
  data: z.unknown(),
  fetchedAt: z.number(),
  ttlMs: z.number(),
})

/**
 * Client-side cache backed by a {@link Storage} instance (e.g. `localStorage`)
 * with per-entry TTL and freshness metadata.
 *
 * All storage keys are namespaced under a configurable `prefix` so that
 * multiple `Cache` instances can coexist in the same storage without
 * collisions.
 *
 * @example
 * ```ts
 * const cache = new Cache(localStorage, 'app:market:')
 * cache.set('Crystal:5', data, 5 * 60 * 1_000) // 5-minute TTL
 * const entry = cache.get<MarketData[]>('Crystal:5')
 * if (entry && !cache.isStale('Crystal:5')) {
 *   // use entry.data
 * }
 * ```
 */
export class Cache {
  readonly #storage: Storage
  readonly #prefix: string

  constructor(storage: Storage, prefix = 'tatarus:') {
    this.#storage = storage
    this.#prefix = prefix
  }

  #storageKey(key: string): string {
    return `${this.#prefix}${key}`
  }

  /**
   * Store a value under `key` with the given TTL.
   * Overwrites any existing entry for this key.
   */
  set(key: string, data: unknown, ttlMs: number): void {
    const entry: CacheEntry<unknown> = {
      data,
      fetchedAt: Date.now(),
      ttlMs,
    }
    this.#storage.setItem(this.#storageKey(key), JSON.stringify(entry))
  }

  /**
   * Retrieve the raw cache entry for `key`, or `null` if absent or
   * unparseable or has an invalid shape.
   *
   * Does **not** check staleness — use {@link isStale} for that.
   */
  get<T>(key: string): CacheEntry<T> | null {
    const raw = this.#storage.getItem(this.#storageKey(key))
    if (raw === null) return null
    try {
      const parsedRaw: unknown = JSON.parse(raw)
      const parsedEntry = cacheEntrySchema.safeParse(parsedRaw)
      if (!parsedEntry.success) return null
      return {
        data: parsedEntry.data.data as T,
        fetchedAt: parsedEntry.data.fetchedAt,
        ttlMs: parsedEntry.data.ttlMs,
      }
    } catch {
      return null
    }
  }

  /**
   * Returns `true` when the entry is absent or has exceeded its TTL.
   */
  isStale(key: string): boolean {
    const entry = this.get(key)
    if (entry === null) return true
    return Date.now() > entry.fetchedAt + entry.ttlMs
  }

  /**
   * Returns freshness metadata for `key`, or `null` when the entry is absent.
   */
  getFreshness(key: string): FreshnessInfo | null {
    const entry = this.get(key)
    if (entry === null) return null
    const fetchedAt = new Date(entry.fetchedAt)
    const expiresAt = new Date(entry.fetchedAt + entry.ttlMs)
    return {
      fetchedAt,
      expiresAt,
      isStale: Date.now() > entry.fetchedAt + entry.ttlMs,
    }
  }

  /** Remove the entry for `key`. No-op if the key is not present. */
  remove(key: string): void {
    this.#storage.removeItem(this.#storageKey(key))
  }

  /**
   * Remove all entries that belong to this cache instance.
   *
   * Only entries whose storage key starts with this instance's prefix are
   * removed; other keys in the same storage are left untouched.
   */
  clear(): void {
    // Two-pass approach: collect matching keys first, then remove them.
    // This keeps iteration over the Storage indices independent of any
    // length changes that could occur if we removed items in the same loop.
    const keysToRemove: string[] = []
    for (let i = 0; i < this.#storage.length; i++) {
      const k = this.#storage.key(i)
      if (k?.startsWith(this.#prefix)) {
        keysToRemove.push(k)
      }
    }
    for (const k of keysToRemove) {
      this.#storage.removeItem(k)
    }
  }
}

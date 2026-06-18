import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cache } from './cache.ts'
import type { CacheEntry } from './cache.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fresh Cache backed by the jsdom localStorage for each test. */
function makeCache(prefix = 'test:'): Cache {
  return new Cache(localStorage, prefix)
}

// ---------------------------------------------------------------------------
// set / get
// ---------------------------------------------------------------------------

describe('Cache.set / Cache.get', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores and retrieves a value', () => {
    const cache = makeCache()
    cache.set('key1', { name: 'Tataru' }, 60_000)
    const entry = cache.get<{ name: string }>('key1')

    expect(entry).not.toBeNull()
    expect(entry?.data).toEqual({ name: 'Tataru' })
  })

  it('returns null for a missing key', () => {
    const cache = makeCache()
    expect(cache.get('nonexistent')).toBeNull()
  })

  it('stores fetchedAt close to Date.now()', () => {
    const before = Date.now()
    const cache = makeCache()
    cache.set('k', 42, 1_000)
    const after = Date.now()

    const entry = cache.get<number>('k')
    expect(entry?.fetchedAt).toBeGreaterThanOrEqual(before)
    expect(entry?.fetchedAt).toBeLessThanOrEqual(after)
  })

  it('stores the ttlMs in the entry', () => {
    const cache = makeCache()
    cache.set('k', 'hello', 30_000)
    const entry = cache.get<string>('k')
    expect(entry?.ttlMs).toBe(30_000)
  })

  it('overwrites an existing entry', () => {
    const cache = makeCache()
    cache.set('k', 'first', 1_000)
    cache.set('k', 'second', 2_000)
    const entry = cache.get<string>('k')
    expect(entry?.data).toBe('second')
    expect(entry?.ttlMs).toBe(2_000)
  })

  it('returns null when the stored JSON is corrupt', () => {
    const cache = makeCache()
    // Bypass Cache.set to insert invalid JSON
    localStorage.setItem('test:k', '{not-valid-json')
    expect(cache.get('k')).toBeNull()
  })

  it('returns null when the stored entry is missing required fields', () => {
    const cache = makeCache()
    localStorage.setItem(
      'test:k',
      JSON.stringify({ data: 1, fetchedAt: Date.now() }),
    )
    expect(cache.get('k')).toBeNull()
  })

  it('returns null when fetchedAt or ttlMs are not numbers', () => {
    const cache = makeCache()
    localStorage.setItem(
      'test:k',
      JSON.stringify({ data: 1, fetchedAt: 'bad', ttlMs: 1_000 }),
    )
    expect(cache.get('k')).toBeNull()
  })

  it('namespaces keys by prefix so two caches do not collide', () => {
    const a = new Cache(localStorage, 'a:')
    const b = new Cache(localStorage, 'b:')
    a.set('shared', 1, 1_000)
    b.set('shared', 2, 1_000)

    expect(a.get<number>('shared')?.data).toBe(1)
    expect(b.get<number>('shared')?.data).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// isStale
// ---------------------------------------------------------------------------

describe('Cache.isStale', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns true for a missing key', () => {
    const cache = makeCache()
    expect(cache.isStale('missing')).toBe(true)
  })

  it('returns true for an entry with an invalid stored shape', () => {
    const cache = makeCache()
    localStorage.setItem(
      'test:item',
      JSON.stringify({ data: 1, fetchedAt: 'bad', ttlMs: 1_000 }),
    )
    expect(cache.isStale('item')).toBe(true)
  })

  it('returns false immediately after set (TTL has not elapsed)', () => {
    const cache = makeCache()
    cache.set('fresh', 42, 60_000) // 1-minute TTL
    expect(cache.isStale('fresh')).toBe(false)
  })

  it('returns true after the TTL has elapsed', () => {
    vi.useFakeTimers()
    try {
      const cache = makeCache()
      cache.set('item', 42, 1_000) // 1-second TTL

      // Advance time just past the TTL
      vi.advanceTimersByTime(1_001)

      expect(cache.isStale('item')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns false just before the TTL elapses', () => {
    vi.useFakeTimers()
    try {
      const cache = makeCache()
      cache.set('item', 42, 1_000)

      // Advance time to 1 ms before expiry
      vi.advanceTimersByTime(999)

      expect(cache.isStale('item')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a zero-millisecond TTL is immediately stale', () => {
    vi.useFakeTimers()
    try {
      const cache = makeCache()
      cache.set('item', 42, 0)
      // Advance by 1 ms so Date.now() > fetchedAt + 0
      vi.advanceTimersByTime(1)
      expect(cache.isStale('item')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------
// getFreshness
// ---------------------------------------------------------------------------

describe('Cache.getFreshness', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null for a missing key', () => {
    const cache = makeCache()
    expect(cache.getFreshness('missing')).toBeNull()
  })

  it('returns null for an entry with an invalid stored shape', () => {
    const cache = makeCache()
    localStorage.setItem(
      'test:k',
      JSON.stringify({ data: 'x', fetchedAt: Date.now(), ttlMs: 'bad' }),
    )
    expect(cache.getFreshness('k')).toBeNull()
  })

  it('returns correct fetchedAt and expiresAt', () => {
    vi.useFakeTimers()
    try {
      const now = 1_700_000_000_000
      vi.setSystemTime(now)
      const cache = makeCache()
      cache.set('k', 'data', 5_000)

      const info = cache.getFreshness('k')
      expect(info?.fetchedAt).toEqual(new Date(now))
      expect(info?.expiresAt).toEqual(new Date(now + 5_000))
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports isStale: false for a fresh entry', () => {
    const cache = makeCache()
    cache.set('k', 'data', 60_000)
    expect(cache.getFreshness('k')?.isStale).toBe(false)
  })

  it('reports isStale: true after TTL elapses', () => {
    vi.useFakeTimers()
    try {
      const cache = makeCache()
      cache.set('k', 'data', 1_000)
      vi.advanceTimersByTime(1_001)
      expect(cache.getFreshness('k')?.isStale).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe('Cache.remove', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('removes a stored entry', () => {
    const cache = makeCache()
    cache.set('k', 1, 1_000)
    cache.remove('k')
    expect(cache.get('k')).toBeNull()
  })

  it('is a no-op for a missing key', () => {
    const cache = makeCache()
    expect(() => {
      cache.remove('nonexistent')
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe('Cache.clear', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('removes all entries for this cache', () => {
    const cache = makeCache('test:')
    cache.set('a', 1, 1_000)
    cache.set('b', 2, 1_000)
    cache.clear()

    expect(cache.get('a')).toBeNull()
    expect(cache.get('b')).toBeNull()
  })

  it('does not remove entries belonging to a different prefix', () => {
    const a = new Cache(localStorage, 'a:')
    const b = new Cache(localStorage, 'b:')

    a.set('shared', 1, 1_000)
    b.set('shared', 2, 1_000)

    a.clear()

    expect(a.get<number>('shared')).toBeNull()
    expect(b.get<number>('shared')?.data).toBe(2)
  })

  it('is a no-op when the cache is already empty', () => {
    const cache = makeCache()
    expect(() => {
      cache.clear()
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Full TTL lifecycle: set → fresh read → TTL expires → stale read
// ---------------------------------------------------------------------------

describe('Cache TTL lifecycle', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('progresses through fresh → stale states as time passes', () => {
    vi.useFakeTimers()
    try {
      const cache = makeCache()
      const TTL = 2_000

      // 1. Store value
      cache.set('item', { value: 42 }, TTL)

      // 2. Immediately fresh
      expect(cache.isStale('item')).toBe(false)
      expect(cache.get<{ value: number }>('item')?.data.value).toBe(42)

      // 3. Still fresh just before expiry
      vi.advanceTimersByTime(TTL - 1)
      expect(cache.isStale('item')).toBe(false)

      // 4. Stale after expiry
      vi.advanceTimersByTime(2)
      expect(cache.isStale('item')).toBe(true)

      // 5. Data is still readable even when stale (caller decides what to do)
      const entry = cache.get<{ value: number }>('item')
      expect(entry?.data.value).toBe(42)

      // 6. Re-storing refreshes TTL
      cache.set('item', { value: 99 }, TTL)
      expect(cache.isStale('item')).toBe(false)
      expect(cache.get<{ value: number }>('item')?.data.value).toBe(99)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------
// Type-level: CacheEntry shape
// ---------------------------------------------------------------------------

describe('CacheEntry shape', () => {
  it('has the expected fields', () => {
    const entry: CacheEntry<string> = {
      data: 'hello',
      fetchedAt: Date.now(),
      ttlMs: 5_000,
    }
    expect(entry.data).toBe('hello')
    expect(typeof entry.fetchedAt).toBe('number')
    expect(entry.ttlMs).toBe(5_000)
  })
})

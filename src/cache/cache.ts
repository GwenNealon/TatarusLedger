/** Minimal storage interface satisfied by both `localStorage` and `MemoryStorage`. */
export interface CacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** In-memory `CacheStorage` implementation, useful for tests and SSR. */
export class MemoryStorage implements CacheStorage {
  private data: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function resolveDefaultStorage(): CacheStorage {
  try {
    if (typeof window !== 'undefined') {
      return window.localStorage;
    }
  } catch {
    // localStorage blocked (e.g. sandboxed iframe)
  }
  return new MemoryStorage();
}

export const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** TTL-based cache backed by an injectable `CacheStorage`. */
export class Cache {
  private storage: CacheStorage;

  constructor(storage?: CacheStorage) {
    this.storage = storage !== undefined ? storage : resolveDefaultStorage();
  }

  get<T>(key: string): T | null {
    const raw = this.storage.getItem(key);
    if (raw === null) return null;
    try {
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expiresAt) {
        this.storage.removeItem(key);
        return null;
      }
      return entry.value;
    } catch {
      this.storage.removeItem(key);
      return null;
    }
  }

  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    this.storage.setItem(key, JSON.stringify(entry));
  }

  invalidate(key: string): void {
    this.storage.removeItem(key);
  }
}

export const defaultCache = new Cache();

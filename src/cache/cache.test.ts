import { Cache, MemoryStorage } from './cache';

const makeCache = () => new Cache(new MemoryStorage());

describe('MemoryStorage', () => {
  it('stores and retrieves a value', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
  });

  it('returns null for missing key', () => {
    const storage = new MemoryStorage();
    expect(storage.getItem('missing')).toBeNull();
  });

  it('removes a key', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', 'v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('does not throw when removing a nonexistent key', () => {
    const storage = new MemoryStorage();
    expect(() => storage.removeItem('nonexistent')).not.toThrow();
  });
});

describe('Cache.get / Cache.set', () => {
  it('returns a stored value before TTL expires', () => {
    const cache = makeCache();
    cache.set('key', { foo: 'bar' });
    expect(cache.get('key')).toEqual({ foo: 'bar' });
  });

  it('returns null for a missing key', () => {
    expect(makeCache().get('nonexistent')).toBeNull();
  });

  it('returns null after the TTL expires', () => {
    jest.useFakeTimers();
    const cache = makeCache();
    cache.set('key', 'value', 1000);
    jest.advanceTimersByTime(1001);
    expect(cache.get('key')).toBeNull();
    jest.useRealTimers();
  });

  it('removes the entry from storage once expired', () => {
    jest.useFakeTimers();
    const storage = new MemoryStorage();
    const cache = new Cache(storage);
    cache.set('key', 'value', 1000);
    jest.advanceTimersByTime(1001);
    cache.get('key');
    expect(storage.getItem('key')).toBeNull();
    jest.useRealTimers();
  });

  it('stores primitive, array, and object values', () => {
    const cache = makeCache();
    cache.set('num', 42);
    cache.set('arr', [1, 2, 3]);
    cache.set('obj', { a: 1 });
    expect(cache.get<number>('num')).toBe(42);
    expect(cache.get<number[]>('arr')).toEqual([1, 2, 3]);
    expect(cache.get<{ a: number }>('obj')).toEqual({ a: 1 });
  });
});

describe('Cache.invalidate', () => {
  it('removes an entry from the cache', () => {
    const cache = makeCache();
    cache.set('key', 'value');
    cache.invalidate('key');
    expect(cache.get('key')).toBeNull();
  });

  it('does not throw for a nonexistent key', () => {
    expect(() => makeCache().invalidate('nonexistent')).not.toThrow();
  });
});

describe('Cache corrupt data handling', () => {
  it('returns null and cleans up a corrupt entry', () => {
    const storage = new MemoryStorage();
    storage.setItem('key', 'not-valid-json{{{');
    const cache = new Cache(storage);
    expect(cache.get('key')).toBeNull();
    expect(storage.getItem('key')).toBeNull();
  });

  it('returns null and cleans up an entry with invalid JSON structure', () => {
    const storage = new MemoryStorage();
    // null is valid JSON but produces a corrupt cache entry
    storage.setItem('key', JSON.stringify(null));
    const cache = new Cache(storage);
    expect(cache.get<number>('key')).toBeNull();
    expect(storage.getItem('key')).toBeNull();
  });
});

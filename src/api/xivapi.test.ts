import { fetchItem, fetchItems } from './xivapi';
import { Cache, MemoryStorage } from '../cache/cache';
import { XivItem } from '../types';

const makeCache = () => new Cache(new MemoryStorage());

function makeXivItem(id: number): XivItem {
  return {
    ID: id,
    Name: `Test Item ${id}`,
    Icon: '/i/020000/020011.png',
    StackSize: 99,
    IsUntradable: 0,
    ItemSearchCategory: { ID: 1, Name: 'Ingredients' },
  };
}

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('fetchItem', () => {
  it('fetches and returns item data', async () => {
    const mockItem = makeXivItem(2);
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockItem });

    const result = await fetchItem(2, makeCache());
    expect(result).toEqual(mockItem);
    expect(mockFetch).toHaveBeenCalledWith('https://xivapi.com/item/2');
  });

  it('returns cached result without a second network call', async () => {
    const mockItem = makeXivItem(2);
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockItem });

    const cache = makeCache();
    await fetchItem(2, cache);
    await fetchItem(2, cache);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on a non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchItem(999, makeCache())).rejects.toThrow('HTTP 404');
  });

  it('caches each item independently by ID', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeXivItem(2) })
      .mockResolvedValueOnce({ ok: true, json: async () => makeXivItem(4) });

    const cache = makeCache();
    await fetchItem(2, cache);
    await fetchItem(4, cache);
    await fetchItem(2, cache);
    await fetchItem(4, cache);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('fetchItems', () => {
  it('fetches multiple items in parallel', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeXivItem(2) })
      .mockResolvedValueOnce({ ok: true, json: async () => makeXivItem(4) });

    const result = await fetchItems([2, 4], makeCache());
    expect(result).toHaveLength(2);
    expect(result[0].ID).toBe(2);
    expect(result[1].ID).toBe(4);
  });

  it('returns an empty array for empty input without calling fetch', async () => {
    const result = await fetchItems([], makeCache());
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws if any item fetch fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeXivItem(2) })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(fetchItems([2, 4], makeCache())).rejects.toThrow('HTTP 503');
  });
});

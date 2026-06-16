import { fetchMarketableItems, fetchMarketData } from './universalis';
import { Cache, MemoryStorage } from '../cache/cache';
import { MarketData, MultiItemMarketData } from '../types';

const makeCache = () => new Cache(new MemoryStorage());

function makeMarketData(itemID: number): MarketData {
  return {
    itemID,
    worldName: 'Gilgamesh',
    worldID: 63,
    lastUploadTime: 1700000000000,
    listings: [],
    recentHistory: [],
    currentAveragePrice: 100,
    currentAveragePriceNQ: 100,
    currentAveragePriceHQ: 0,
    averagePrice: 100,
    averagePriceNQ: 100,
    averagePriceHQ: 0,
    saleVelocity: 1,
    saleVelocityNQ: 1,
    saleVelocityHQ: 0,
    minPrice: 90,
    minPriceNQ: 90,
    minPriceHQ: 0,
    maxPrice: 110,
    maxPriceNQ: 110,
    maxPriceHQ: 0,
  };
}

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('fetchMarketableItems', () => {
  it('fetches and returns marketable item IDs', async () => {
    const mockData = [2, 4, 5, 6];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

    const result = await fetchMarketableItems(makeCache());
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('https://universalis.app/api/v2/marketable');
  });

  it('returns cached result without a second network call', async () => {
    const mockData = [2, 4, 5];
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockData });

    const cache = makeCache();
    await fetchMarketableItems(cache);
    await fetchMarketableItems(cache);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on a non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchMarketableItems(makeCache())).rejects.toThrow('HTTP 500');
  });
});

describe('fetchMarketData', () => {
  it('returns an empty array for an empty item list without calling fetch', async () => {
    const result = await fetchMarketData('Gilgamesh', [], makeCache());
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches a single item and wraps it in an array', async () => {
    const mockData = makeMarketData(2);
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

    const result = await fetchMarketData('Gilgamesh', [2], makeCache());
    expect(result).toHaveLength(1);
    expect(result[0].itemID).toBe(2);
  });

  it('fetches multiple items and returns all of them', async () => {
    const mockData: MultiItemMarketData = {
      itemIDs: [2, 4],
      items: { '2': makeMarketData(2), '4': makeMarketData(4) },
      worldName: 'Gilgamesh',
      unresolvedItems: [],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

    const result = await fetchMarketData('Gilgamesh', [2, 4], makeCache());
    expect(result).toHaveLength(2);
  });

  it('URL-encodes the world/DC name', async () => {
    const mockData = makeMarketData(2);
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

    await fetchMarketData('Light DC', [2], makeCache());
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('Light%20DC')
    );
  });

  it('returns cached result without a second network call', async () => {
    const mockData = makeMarketData(2);
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockData });

    const cache = makeCache();
    await fetchMarketData('Gilgamesh', [2], cache);
    await fetchMarketData('Gilgamesh', [2], cache);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on a non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchMarketData('Gilgamesh', [2], makeCache())).rejects.toThrow('HTTP 404');
  });
});

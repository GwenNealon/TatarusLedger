import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadItemsIndex } from './itemsIndex.ts'

describe('loadItemsIndex', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('loads tradable items from xivapi and filters untradable rows', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : ''
      if (requestUrl === '') {
        throw new Error('Unsupported request input')
      }
      const url = new URL(requestUrl)
      const rows = url.searchParams.has('after')
        ? []
        : [
            {
              row_id: 5339,
              fields: {
                Name: 'Craftsman Syrup',
                'Icon@as(raw)': 35484,
                'LevelItem@as(raw)': 560,
                Rarity: 1,
                'ItemUICategory@as(raw)': 58,
                IsUntradable: false,
              },
            },
            {
              row_id: 1,
              fields: {
                Name: 'Untradable Thing',
                'Icon@as(raw)': 1,
                'LevelItem@as(raw)': 1,
                Rarity: 1,
                'ItemUICategory@as(raw)': 1,
                IsUntradable: true,
              },
            },
          ]

      return Promise.resolve(
        new Response(JSON.stringify({ rows }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    globalThis.fetch = fetchMock

    const items = await loadItemsIndex()

    expect(items).toEqual([
      {
        id: 5339,
        name: 'Craftsman Syrup',
        iconId: 35484,
        levelItem: 560,
        rarity: 1,
        uiCategory: 58,
      },
    ])
    expect(fetchMock.mock.calls[0]?.[0]).toBeInstanceOf(URL)
  })
})

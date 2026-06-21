import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadCachedItemsIndex } from './cachedItemsIndex.ts'

describe('loadCachedItemsIndex', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('loads cached items artifact when available', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 33917,
                name: 'Orange Juice',
                iconId: 9362,
                levelItem: 430,
                rarity: 1,
                uiCategory: 46,
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )
    globalThis.fetch = fetchMock

    await expect(loadCachedItemsIndex()).resolves.toEqual([
      {
        id: 33917,
        name: 'Orange Juice',
        iconId: 9362,
        levelItem: 430,
        rarity: 1,
        uiCategory: 46,
      },
    ])
  })
})

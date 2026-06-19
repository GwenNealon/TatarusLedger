import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadItemsIndex } from './itemsIndex.ts'

describe('loadItemsIndex', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('shows an actionable error when the items artifact is missing', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => {
      return new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    })
    globalThis.fetch = fetchMock

    await expect(loadItemsIndex()).rejects.toThrow(
      'Run "npm run data:fetch" to generate public/data/items.json.',
    )
    expect(fetchMock).toHaveBeenCalledWith('/TatarusLedger/data/items.json')
  })
})

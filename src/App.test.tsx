import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.tsx'
import type { ItemsArtifact } from './data/types.ts'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const ITEMS_FIXTURE: ItemsArtifact = {
  version: 'test',
  items: [
    {
      id: 5339,
      name: 'Craftsman Syrup',
      iconId: 35484,
      levelItem: 560,
      rarity: 1,
      uiCategory: 58,
    },
    {
      id: 33917,
      name: 'Orange Juice',
      iconId: 9362,
      levelItem: 430,
      rarity: 1,
      uiCategory: 46,
    },
  ],
}

function makeJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.href
  }

  if (input instanceof Request) {
    return input.url
  }

  throw new Error('Unsupported request input')
}

function setupFetchMock(params: {
  marketResponsesByItemId?: Record<number, (Error | Response)[]>
}): ReturnType<typeof vi.fn> {
  const queueByItemId = new Map<number, (Error | Response)[]>()

  for (const [itemId, queue] of Object.entries(
    params.marketResponsesByItemId ?? {},
  )) {
    queueByItemId.set(Number.parseInt(itemId, 10), [...queue])
  }

  const mock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const requestUrl = getRequestUrl(input)

    if (requestUrl.includes('/data/items.json')) {
      return Promise.resolve(makeJsonResponse(ITEMS_FIXTURE))
    }

    const marketMatch = /\/api\/v2\/Crystal\/(\d+)/.exec(requestUrl)
    if (marketMatch !== null) {
      const itemId = Number.parseInt(marketMatch[1], 10)
      const queue = queueByItemId.get(itemId)
      const next = queue?.shift()
      if (next === undefined) {
        return Promise.reject(
          new Error(`No queued market response for item ${itemId.toString()}`),
        )
      }

      if (next instanceof Error) {
        return Promise.reject(next)
      }

      return Promise.resolve(next)
    }

    return Promise.reject(new Error(`Unexpected fetch URL: ${requestUrl}`))
  })

  globalThis.fetch = mock
  return mock
}

async function renderApp(): Promise<{
  root: ReturnType<typeof createRoot>
  container: HTMLDivElement
}> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<App />)
    await Promise.resolve()
  })

  return { root, container }
}

describe('App', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.history.replaceState({}, '', '/TatarusLedger/')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('searches datamined items and routes to /TatarusLedger/{itemId}', async () => {
    vi.useFakeTimers()

    setupFetchMock({
      marketResponsesByItemId: {
        33917: [
          makeJsonResponse({
            itemID: 33917,
            listings: [{ pricePerUnit: 600 }],
            recentHistory: [{ pricePerUnit: 560, timestamp: 1_700_000_000 }],
          }),
        ],
      },
    })

    const { container } = await renderApp()

    const input =
      container.querySelector<HTMLInputElement>('#item-search-input')
    expect(input).not.toBeNull()
    if (input === null) return

    act(() => {
      input.value = 'orange'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    const itemButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent.includes('Orange Juice'),
    )
    expect(itemButton).not.toBeUndefined()
    if (itemButton === undefined) return

    act(() => {
      itemButton.click()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(window.location.pathname).toBe('/TatarusLedger/33917')
    expect(container.textContent).toContain('Orange Juice')
    expect(container.textContent).toContain('ID')
    expect(container.textContent).toContain('Category')
    expect(container.innerHTML).toContain(
      'https://universalis.app/market/33917',
    )
    expect(container.innerHTML).toContain(
      'https://saddlebagexchange.com/queries/item-data/33917',
    )
    expect(container.innerHTML).toContain(
      'https://ffxivteamcraft.com/db/en/item/33917/Orange%20Juice',
    )
    expect(container.innerHTML).toContain(
      'https://www.garlandtools.org/db/#item/33917',
    )
  })

  it('shows cached indicator when local cache is fresh', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    localStorage.setItem(
      'item-cache-5339',
      JSON.stringify({
        fetchedAt: now,
        item: {
          id: 5339,
          name: 'Craftsman Syrup',
          iconId: 35484,
          levelItem: 560,
          rarity: 1,
          uiCategory: 58,
        },
        marketSummary: {
          lowestPrice: 1000,
          listingCount: 2,
          saleCount: 3,
        },
      }),
    )

    const fetchSpy = setupFetchMock({})

    const { container } = await renderApp()

    const itemButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent.includes('Craftsman Syrup'),
    )
    expect(itemButton).not.toBeUndefined()
    if (itemButton === undefined) return

    act(() => {
      itemButton.click()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Cached and fresh')
    expect(container.textContent).toContain('1000 gil')

    const universalisCalls = fetchSpy.mock.calls.filter((call) => {
      const request = call[0] as RequestInfo | URL
      return getRequestUrl(request).includes('/api/v2/Crystal/5339')
    })
    expect(universalisCalls).toHaveLength(0)
  })

  it('opens a routed item URL with trailing slash', async () => {
    window.history.replaceState({}, '', '/TatarusLedger/5339/')

    setupFetchMock({
      marketResponsesByItemId: {
        5339: [
          makeJsonResponse({
            itemID: 5339,
            listings: [{ pricePerUnit: 700 }],
            recentHistory: [{ pricePerUnit: 680, timestamp: 1_700_000_100 }],
          }),
        ],
      },
    })

    const { container } = await renderApp()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Craftsman Syrup')
    expect(container.textContent).toContain('700 gil')
  })

  it.each([
    '/TatarusLedger/not-a-number',
    '/TatarusLedger/-1',
    '/TatarusLedger/5339/extra',
  ])('ignores invalid routed URL %s', async (path) => {
    window.history.replaceState({}, '', path)

    setupFetchMock({})

    const { container } = await renderApp()

    expect(container.textContent).toContain(
      'Select an item to open /TatarusLedger/{itemId}.',
    )
  })

  it('shows error indicator on refresh failure and supports retry', async () => {
    setupFetchMock({
      marketResponsesByItemId: {
        5339: [
          new Error('network failed'),
          makeJsonResponse({
            itemID: 5339,
            listings: [{ pricePerUnit: 450 }],
            recentHistory: [{ pricePerUnit: 410, timestamp: 1_700_000_000 }],
          }),
        ],
      },
    })

    const { container } = await renderApp()

    const itemButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent.includes('Craftsman Syrup'),
    )
    expect(itemButton).not.toBeUndefined()
    if (itemButton === undefined) return

    act(() => {
      itemButton.click()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Cache refresh failed')

    const retryButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Retry',
    )
    expect(retryButton).not.toBeUndefined()
    if (retryButton === undefined) return

    act(() => {
      retryButton.click()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Cached and fresh')
    expect(container.textContent).toContain('450 gil')
  })
})

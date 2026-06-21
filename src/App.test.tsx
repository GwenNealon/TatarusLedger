import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.tsx'
import type { NormalizedItem } from './data/types.ts'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const ITEMS_FIXTURE: NormalizedItem[] = [
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
]

let lastRoot: ReturnType<typeof createRoot> | null = null

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueDescriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )
  if (valueDescriptor?.set === undefined) {
    throw new Error('Missing HTMLInputElement.value setter')
  }
  valueDescriptor.set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function setupFetchMock(params: {
  marketResponsesByItemId?: Record<number, (Error | Response)[]>
}): ReturnType<typeof vi.fn> {
  const jsonResponse = (payload: unknown): Response =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  const queueByItemId = new Map<number, (Error | Response)[]>()

  for (const [itemId, queue] of Object.entries(
    params.marketResponsesByItemId ?? {},
  )) {
    queueByItemId.set(Number.parseInt(itemId, 10), [...queue])
  }

  const mock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url

    if (requestUrl.includes('/data/items.json')) {
      return Promise.resolve(
        jsonResponse({
          version: 'test',
          items: ITEMS_FIXTURE,
        }),
      )
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
  lastRoot = root

  await act(async () => {
    root.render(<App />)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })

  return { root, container }
}

async function searchAndSelectItem(params: {
  container: HTMLDivElement
  query: string
  itemName: string
  waitMs?: number
}): Promise<void> {
  const { container, query, itemName, waitMs = 300 } = params

  const input = container.querySelector<HTMLInputElement>('#item-search-input')
  expect(input).not.toBeNull()
  if (input === null) return

  act(() => {
    setInputValue(input, query)
  })

  await act(async () => {
    await vi.advanceTimersByTimeAsync(waitMs)
  })

  const itemButton = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent.includes(itemName),
  )
  expect(itemButton).not.toBeUndefined()
  if (itemButton === undefined) return

  act(() => {
    itemButton.click()
  })
}

describe('App', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.history.replaceState({}, '', '/TatarusLedger/')
  })

  afterEach(async () => {
    if (lastRoot !== null) {
      const root = lastRoot
      lastRoot = null
      await act(async () => {
        root.unmount()
        await Promise.resolve()
      })
    }
    globalThis.fetch = originalFetch
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('searches datamined items and routes to /TatarusLedger/{itemId}', async () => {
    vi.useFakeTimers()

    setupFetchMock({
      marketResponsesByItemId: {
        33917: [
          new Response(
            JSON.stringify({
              itemID: 33917,
              listings: [{ pricePerUnit: 600 }],
              recentHistory: [{ pricePerUnit: 560, timestamp: 1_700_000_000 }],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ],
      },
    })

    const { container } = await renderApp()
    await searchAndSelectItem({
      container,
      query: 'orange',
      itemName: 'Orange Juice',
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
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
    vi.useFakeTimers()

    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    window.localStorage.setItem(
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
    await searchAndSelectItem({
      container,
      query: 'craftsman',
      itemName: 'Craftsman Syrup',
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Cached and fresh')
    expect(container.textContent).toContain('1000 gil')

    const universalisCalls = fetchSpy.mock.calls.filter((call) => {
      const request = call[0] as RequestInfo | URL
      const requestUrl =
        typeof request === 'string'
          ? request
          : request instanceof URL
            ? request.href
            : request.url
      return requestUrl.includes('/api/v2/Crystal/5339')
    })
    expect(universalisCalls).toHaveLength(0)
  })

  it('does not expose live refresh controls in artifact-only mode', async () => {
    setupFetchMock({})

    const { container } = await renderApp()

    expect(container.textContent).toContain('Last updated (build artifact):')
    expect(container.textContent).not.toContain('Refresh Item Data')
  })

  it('opens a routed item URL with trailing slash', async () => {
    window.history.replaceState({}, '', '/TatarusLedger/5339/')

    setupFetchMock({
      marketResponsesByItemId: {
        5339: [
          new Response(
            JSON.stringify({
              itemID: 5339,
              listings: [{ pricePerUnit: 700 }],
              recentHistory: [{ pricePerUnit: 680, timestamp: 1_700_000_100 }],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ],
      },
    })

    const { container } = await renderApp()
    await searchAndSelectItem({
      container,
      query: 'craftsman',
      itemName: 'Craftsman Syrup',
      waitMs: 180,
    })

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
    vi.useFakeTimers()

    setupFetchMock({
      marketResponsesByItemId: {
        5339: [
          new Error('network failed'),
          new Response(
            JSON.stringify({
              itemID: 5339,
              listings: [{ pricePerUnit: 450 }],
              recentHistory: [{ pricePerUnit: 410, timestamp: 1_700_000_000 }],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ],
      },
    })

    const { container } = await renderApp()
    await searchAndSelectItem({
      container,
      query: 'craftsman',
      itemName: 'Craftsman Syrup',
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
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

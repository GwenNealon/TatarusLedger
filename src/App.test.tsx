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

function setInputValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const valueDescriptor = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    'value',
  )
  if (valueDescriptor?.set === undefined) {
    throw new Error('Missing HTMLInputElement.value setter')
  }
  valueDescriptor.set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

function makeResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
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
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url

    if (requestUrl.includes('/data/items.json')) {
      return Promise.resolve(
        makeResponse({
          version: 'test',
          items: ITEMS_FIXTURE,
        }),
      )
    }

    if (requestUrl.endsWith('/api/v2/worlds')) {
      return Promise.resolve(
        makeResponse([
          { id: 73, name: 'Balmung' },
          { id: 74, name: 'Jenova' },
        ]),
      )
    }

    if (requestUrl.endsWith('/api/v2/marketable')) {
      return Promise.resolve(makeResponse([5339, 33917, 999999]))
    }

    if (requestUrl.includes('/api/v2/Balmung/5339,33917,999999')) {
      return Promise.resolve(
        makeResponse({
          itemIDs: [5339, 33917, 999999],
          items: {
            5339: {
              itemID: 5339,
              listings: [
                {
                  listingID: 'owned-1',
                  hq: false,
                  isCrafted: true,
                  onMannequin: false,
                  pricePerUnit: 1_000,
                  quantity: 1,
                  total: 1_000,
                  tax: 0,
                  retainerCity: 1,
                  stainID: 0,
                  retainerName: 'Tataru',
                  worldID: 73,
                  worldName: 'Balmung',
                  lastReviewTime: 1_700_000_000,
                },
              ],
              recentHistory: [],
            },
            33917: {
              itemID: 33917,
              listings: [
                {
                  listingID: 'other-1',
                  hq: false,
                  isCrafted: true,
                  onMannequin: false,
                  pricePerUnit: 2_000,
                  quantity: 1,
                  total: 2_000,
                  tax: 0,
                  retainerCity: 1,
                  stainID: 0,
                  retainerName: 'SomeoneElse',
                  worldID: 73,
                  worldName: 'Balmung',
                  lastReviewTime: 1_700_000_000,
                },
              ],
              recentHistory: [],
            },
            999999: {
              itemID: 999999,
              listings: [],
              recentHistory: [],
            },
          },
        }),
      )
    }

    const marketMatch = /\/api\/v2\/(?:Crystal|Balmung)\/(\d+)/.exec(requestUrl)
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

  if (vi.isFakeTimers()) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(waitMs)
    })
  } else {
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitMs)
      })
    })
  }

  const itemButton = Array.from(container.querySelectorAll('button')).find(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (button) => (button.textContent ?? '').includes(itemName),
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

    if (typeof window.localStorage.setItem !== 'function') {
      const values = new Map<string, string>()
      const storage: Storage = {
        get length() {
          return values.size
        },
        clear() {
          values.clear()
        },
        getItem(key: string) {
          return values.get(key) ?? null
        },
        key(index: number) {
          return [...values.keys()][index] ?? null
        },
        removeItem(key: string) {
          values.delete(key)
        },
        setItem(key: string, value: string) {
          values.set(key, value)
        },
      }
      Object.defineProperty(window, 'localStorage', {
        value: storage,
        configurable: true,
      })
    }

    if (typeof window.localStorage.clear === 'function') {
      window.localStorage.clear()
    }

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

    expect(window.location.pathname.endsWith('/33917')).toBe(true)
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

  it('searches by item id without showing ids in search results', async () => {
    vi.useFakeTimers()

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
    const input =
      container.querySelector<HTMLInputElement>('#item-search-input')
    expect(input).not.toBeNull()
    if (input === null) return

    act(() => {
      setInputValue(input, '5339')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    const itemButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent.includes('Craftsman Syrup'),
    )
    expect(itemButton).not.toBeUndefined()
    if (itemButton === undefined) return

    expect(itemButton.textContent).not.toContain('5339')

    act(() => {
      itemButton.click()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(window.location.pathname.endsWith('/5339')).toBe(true)
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

    expect(container.textContent).toContain('Select an item to open /{itemId}.')
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

  it('shows a refresh error when the market API returns no entry for the item', async () => {
    vi.useFakeTimers()

    setupFetchMock({
      marketResponsesByItemId: {
        5339: [
          new Response(
            JSON.stringify({
              itemIDs: [5339],
              items: {},
              unresolvedItems: [5339],
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

    expect(container.textContent).toContain(
      'Cache refresh failed: No market data returned for item',
    )
  })

  it('opens the live undercut tracker page', async () => {
    setupFetchMock({})
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    expect(container.textContent).toContain('Live undercut tracker')
    expect(container.textContent).toContain('WebSocket first')
  })

  it('links to the live undercut tracker from the main page', async () => {
    setupFetchMock({})

    const { container } = await renderApp()

    const trackerLink = Array.from(container.querySelectorAll('a')).find(
      (link) => link.textContent === 'undercut tracker',
    )

    expect(trackerLink?.getAttribute('href')).toContain('/undercut-tracker')
  })

  it('shows world suggestions on the undercut tracker page', async () => {
    setupFetchMock({})
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    const worldSelect = container.querySelector<HTMLSelectElement>(
      '#undercut-world-select',
    )
    expect(worldSelect).not.toBeNull()
    expect(worldSelect?.value).toBe('Balmung')

    const chevron = container.querySelector('[aria-hidden="true"]')
    expect(chevron?.textContent).toBe('▾')
  })

  it('renders the HQ quality glyph in the undercut tracker table', async () => {
    setupFetchMock({
      marketResponsesByItemId: {
        5339: [
          makeResponse({
            itemID: 5339,
            listings: [
              {
                listingID: 'owned-1',
                hq: true,
                isCrafted: true,
                onMannequin: false,
                pricePerUnit: 1_000,
                quantity: 1,
                total: 1_000,
                tax: 0,
                retainerCity: 1,
                stainID: 0,
                retainerName: 'Tataru',
                worldID: 73,
                worldName: 'Balmung',
                lastReviewTime: 1_700_000_000,
              },
            ],
            recentHistory: [],
          }),
        ],
      },
    })
    window.localStorage.setItem(
      'undercut-tracker-config',
      JSON.stringify({
        world: 'Balmung',
        retainerInput: 'Tataru',
        itemInput: '5339',
      }),
    )
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const qualitySymbol = container.querySelector(
      'span[aria-label="High Quality"]',
    )
    expect(qualitySymbol).not.toBeNull()
    expect(qualitySymbol?.textContent).toBe('')
  })

  it('selects highlighted item from item search on Enter', async () => {
    vi.useFakeTimers()
    setupFetchMock({})
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    const input =
      container.querySelector<HTMLInputElement>('#item-search-input')
    expect(input).not.toBeNull()
    if (input === null) return

    act(() => {
      setInputValue(input, 'r')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })

    expect(container.textContent).toContain('Craftsman Syrup (5339)')

    const orangeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent.includes('Orange Juice'),
    )
    expect(orangeButton).not.toBeUndefined()
    if (orangeButton === undefined) return

    act(() => {
      orangeButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Orange Juice (33917)')
  })

  it('moves item search highlight with ArrowUp and ArrowDown', async () => {
    vi.useFakeTimers()
    setupFetchMock({})
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    const input =
      container.querySelector<HTMLInputElement>('#item-search-input')
    expect(input).not.toBeNull()
    if (input === null) return

    act(() => {
      setInputValue(input, 'r')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      )
    })

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })

    expect(container.textContent).toContain('Orange Juice (33917)')

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      )
    })

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })

    expect(container.textContent).toContain('Craftsman Syrup (5339)')
  })

  it('filters already tracked items from undercut tracker search results', async () => {
    vi.useFakeTimers()
    setupFetchMock({})
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    const input =
      container.querySelector<HTMLInputElement>('#item-search-input')
    expect(input).not.toBeNull()
    if (input === null) return

    act(() => {
      setInputValue(input, 'craft')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })

    expect(container.textContent).toContain('Craftsman Syrup (5339)')

    const craftsmanSearchButton = Array.from(
      container.querySelectorAll('button'),
    ).find((button) => button.textContent.includes('Craftsman Syrup'))

    expect(craftsmanSearchButton).toBeUndefined()
  })

  it('clears item listing when removing the last tracked item', async () => {
    setupFetchMock({
      marketResponsesByItemId: {
        5339: [
          makeResponse({
            itemID: 5339,
            listings: [
              {
                listingID: 'owned-1',
                hq: false,
                isCrafted: true,
                onMannequin: false,
                pricePerUnit: 1_000,
                quantity: 1,
                total: 1_000,
                tax: 0,
                retainerCity: 1,
                stainID: 0,
                retainerName: 'Tataru',
                worldID: 73,
                worldName: 'Balmung',
                lastReviewTime: 1_700_000_000,
              },
            ],
            recentHistory: [],
          }),
        ],
      },
    })
    window.localStorage.setItem(
      'undercut-tracker-config',
      JSON.stringify({
        world: 'Balmung',
        retainerInput: 'Tataru',
        itemInput: '5339',
      }),
    )
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Craftsman Syrup')

    const tableRow = Array.from(container.querySelectorAll('tr')).find((row) =>
      row.textContent.includes('Craftsman Syrup (5339)'),
    )
    expect(tableRow).not.toBeUndefined()
    if (tableRow === undefined) return

    const removeButton = tableRow.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Craftsman Syrup"]',
    )
    expect(removeButton).not.toBeNull()
    if (removeButton === null) return

    act(() => {
      removeButton.click()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain(
      'Add a world and at least one item to start tracking.',
    )
    expect(container.textContent).not.toContain('Craftsman Syrup')
  })

  it('auto-discovers watched items from retainers', async () => {
    setupFetchMock({})
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    const retainers = container.querySelector<HTMLInputElement>(
      'input[placeholder="Add retainer name"]',
    )
    expect(retainers).not.toBeNull()
    if (retainers === null) return

    act(() => {
      setInputValue(retainers, 'Tataru')
    })

    const addRetainerButton = Array.from(
      container.querySelectorAll('button'),
    ).find((button) => button.textContent === 'Add retainer')
    expect(addRetainerButton).not.toBeUndefined()
    if (addRetainerButton === undefined) return

    act(() => {
      addRetainerButton.click()
    })

    const discoverButton = Array.from(
      container.querySelectorAll('button'),
    ).find((button) => button.textContent === 'Discover my listings')
    expect(discoverButton).not.toBeUndefined()
    if (discoverButton === undefined) return

    act(() => {
      discoverButton.click()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Craftsman Syrup (5339)')
    expect(container.textContent).not.toContain('Orange Juice (33917)')
    expect(container.textContent).toContain('Discovered 1 item(s)')
  })

  it('shows live discovery progress while scanning marketable items', async () => {
    const marketableItemIds = Array.from({ length: 101 }, (_, index) =>
      index === 0 ? 5339 : 40000 + index,
    )
    const marketableResponse = createDeferred<Response>()
    const firstBatchResponse = createDeferred<Response>()
    const secondBatchResponse = createDeferred<Response>()

    const mock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url

      if (requestUrl.includes('/data/items.json')) {
        return Promise.resolve(
          makeResponse({
            version: 'test',
            items: ITEMS_FIXTURE,
          }),
        )
      }

      if (requestUrl.endsWith('/api/v2/worlds')) {
        return Promise.resolve(
          makeResponse([
            { id: 73, name: 'Balmung' },
            { id: 74, name: 'Jenova' },
          ]),
        )
      }

      if (requestUrl.endsWith('/api/v2/marketable')) {
        return marketableResponse.promise
      }

      if (requestUrl.includes('/api/v2/Balmung/')) {
        if (requestUrl.includes('5339')) {
          return firstBatchResponse.promise
        }

        return secondBatchResponse.promise
      }

      return Promise.reject(new Error(`Unexpected fetch URL: ${requestUrl}`))
    })

    globalThis.fetch = mock
    window.history.replaceState({}, '', '/TatarusLedger/undercut-tracker')

    const { container } = await renderApp()

    const retainers = container.querySelector<HTMLInputElement>(
      'input[placeholder="Add retainer name"]',
    )
    expect(retainers).not.toBeNull()
    if (retainers === null) return

    act(() => {
      setInputValue(retainers, 'Tataru')
    })

    const addRetainerButton = Array.from(
      container.querySelectorAll('button'),
    ).find((button) => button.textContent === 'Add retainer')
    expect(addRetainerButton).not.toBeUndefined()
    if (addRetainerButton === undefined) return

    act(() => {
      addRetainerButton.click()
    })

    const discoverButton = Array.from(
      container.querySelectorAll('button'),
    ).find((button) => button.textContent === 'Discover my listings')
    expect(discoverButton).not.toBeUndefined()
    if (discoverButton === undefined) return

    act(() => {
      discoverButton.click()
    })

    await act(async () => {
      marketableResponse.resolve(makeResponse(marketableItemIds))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain(
      'Checked 0 of 101 marketable items...',
    )

    await act(async () => {
      firstBatchResponse.resolve(
        makeResponse({
          itemIDs: marketableItemIds.slice(0, 100),
          items: {
            5339: {
              itemID: 5339,
              listings: [
                {
                  listingID: 'owned-1',
                  hq: false,
                  isCrafted: true,
                  onMannequin: false,
                  pricePerUnit: 1_000,
                  quantity: 1,
                  total: 1_000,
                  tax: 0,
                  retainerCity: 1,
                  stainID: 0,
                  retainerName: 'Tataru',
                  worldID: 73,
                  worldName: 'Balmung',
                  lastReviewTime: 1_700_000_000,
                },
              ],
              recentHistory: [],
            },
          },
        }),
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain(
      'Checked 100 of 101 marketable items...',
    )

    await act(async () => {
      secondBatchResponse.resolve(
        makeResponse({
          itemIDs: marketableItemIds.slice(100),
          items: {
            [marketableItemIds[100]]: {
              itemID: marketableItemIds[100],
              listings: [],
              recentHistory: [],
            },
          },
        }),
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Discovered 1 item(s)')
    expect(container.textContent).toContain('Craftsman Syrup (5339)')
  })
})

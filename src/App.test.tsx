import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

function renderApp(): {
  root: ReturnType<typeof createRoot>
  container: HTMLDivElement
} {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(<App />)
  })

  return { root, container }
}

describe('App', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('searches items with icons and opens the selected item page', async () => {
    vi.useFakeTimers()
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          itemID: 5339,
          listings: [],
          recentHistory: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const { container } = renderApp()
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

    const rowIcon = itemButton.querySelector('img')
    expect(rowIcon).not.toBeNull()
    if (rowIcon === null) return
    expect(rowIcon.getAttribute('alt')).toContain('Orange Juice icon')

    act(() => {
      itemButton.click()
    })

    await act(async () => {
      await Promise.resolve()
    })

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
          category: 'Medicine',
        },
        listings: [],
        recentHistory: [],
        marketSummary: {
          lowestPrice: 1000,
          listingCount: 2,
          saleCount: 3,
        },
      }),
    )

    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const { container } = renderApp()
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
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('shows error indicator on refresh failure and supports retry', async () => {
    const response = new Response(
      JSON.stringify({
        itemID: 5339,
        listings: [{ pricePerUnit: 450 }],
        recentHistory: [{ pricePerUnit: 410, timestamp: 1_700_000_000 }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce(response)

    const { container } = renderApp()
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

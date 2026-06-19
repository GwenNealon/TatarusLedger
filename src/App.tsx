import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import type { NormalizedItem } from './data/types.ts'
import { ItemDetailPage } from './features/items/ItemDetailPage.tsx'
import { ItemSearch } from './features/items/ItemSearch.tsx'
import { loadItemsIndex } from './features/items/itemsIndex.ts'

const pageStyles: CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  padding: '2rem 1rem',
  backgroundColor: '#f8fafc',
  color: '#0f172a',
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const cardStyles: CSSProperties = {
  width: '100%',
  maxWidth: '64rem',
  margin: '0 auto',
  borderRadius: '0.75rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  padding: '2rem',
}

const APP_BASE_PATH =
  import.meta.env.BASE_URL === '/'
    ? '/TatarusLedger/'
    : import.meta.env.BASE_URL

function trimTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path
}

function parseRoutedItemId(pathname: string): number | null {
  const base = trimTrailingSlash(APP_BASE_PATH)

  if (!pathname.startsWith(base)) {
    return null
  }

  const rest = pathname.slice(base.length).replace(/^\/+|\/+$/g, '')
  if (rest.length === 0 || rest.includes('/')) {
    return null
  }

  const parsed = Number.parseInt(rest, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function buildItemPath(itemId: number): string {
  return `${APP_BASE_PATH}${itemId.toString()}`
}

function navigateToPath(
  nextPath: string,
  setPathname: (pathname: string) => void,
): void {
  window.history.pushState({}, '', nextPath)
  setPathname(window.location.pathname)
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [items, setItems] = useState<NormalizedItem[]>([])
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [isLoadingItems, setIsLoadingItems] = useState(true)

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void loadItemsIndex()
      .then((nextItems) => {
        if (cancelled) {
          return
        }

        setItems(nextItems)
        setLoadingError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setLoadingError(
          error instanceof Error ? error.message : 'Unable to load item index',
        )
      })
      .finally(() => {
        if (cancelled) {
          return
        }

        setIsLoadingItems(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectedItemId = useMemo(() => parseRoutedItemId(pathname), [pathname])

  const selectedItem = useMemo(() => {
    if (selectedItemId === null) {
      return null
    }

    return items.find((item) => item.id === selectedItemId) ?? null
  }, [items, selectedItemId])

  return (
    <main style={pageStyles}>
      <article style={cardStyles}>
        <h1>Tataru&apos;s Ledger</h1>
        <p>
          Search an item, open its details page, and quickly jump to popular
          FFXIV item resources.
        </p>

        {isLoadingItems ? (
          <p aria-live="polite">Loading items from XIVAPI…</p>
        ) : null}
        {loadingError !== null ? (
          <p role="alert">{`Item index failed to load: ${loadingError}`}</p>
        ) : null}

        {!isLoadingItems ? (
          <ItemSearch
            items={items}
            onSelectItem={(item) => {
              navigateToPath(buildItemPath(item.id), setPathname)
            }}
          />
        ) : null}

        {selectedItem !== null ? (
          <ItemDetailPage key={selectedItem.id} item={selectedItem} />
        ) : selectedItemId !== null ? (
          <p role="alert">Item not found in the loaded index.</p>
        ) : (
          <p role="status">
            Select an item to open /TatarusLedger/{'{itemId}'}.
          </p>
        )}
      </article>
    </main>
  )
}

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import type { NormalizedItem } from './data/types.ts'
import { ItemDetailPage } from './features/items/ItemDetailPage.tsx'
import { ItemSearch } from './features/items/ItemSearch.tsx'
import { loadCachedItemsIndex } from './features/items/cachedItemsIndex.ts'

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
const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP

function parseRoutedItemId(pathname: string): number | null {
  const base = APP_BASE_PATH.endsWith('/')
    ? APP_BASE_PATH.slice(0, -1)
    : APP_BASE_PATH

  if (pathname !== base && !pathname.startsWith(`${base}/`)) {
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

function navigateToPath(
  nextPath: string,
  setPathname: (pathname: string) => void,
): void {
  window.history.pushState({}, '', nextPath)
  setPathname(window.location.pathname)
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [items, setItems] = useState<NormalizedItem[] | null>(null)
  const [loadingError, setLoadingError] = useState<string | null>(null)

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

    void loadCachedItemsIndex()
      .then((cachedItems) => {
        if (cancelled) {
          return
        }
        if (cachedItems.length === 0) {
          setLoadingError('Checked-in item artifact is empty or unavailable')
          return
        }

        setItems(cachedItems)
        setLoadingError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setLoadingError(
          error instanceof Error
            ? error.message
            : 'Unable to load checked-in item index',
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectedItemId = parseRoutedItemId(pathname)

  const selectedItem =
    selectedItemId === null || items === null
      ? null
      : (items.find((item) => item.id === selectedItemId) ?? null)

  return (
    <main style={pageStyles}>
      <article style={cardStyles}>
        <h1>Tataru&apos;s Ledger</h1>
        <p>
          Search an item, open its details page, and quickly jump to popular
          FFXIV item resources.
        </p>

        {loadingError === null && items === null ? (
          <p aria-live="polite">Loading item index…</p>
        ) : null}
        {loadingError !== null ? (
          <p role="alert">{`Item index failed to load: ${loadingError}`}</p>
        ) : null}
        <p>{`Last updated (build artifact): ${
          Number.isNaN(new Date(BUILD_TIMESTAMP).getTime())
            ? BUILD_TIMESTAMP
            : new Date(BUILD_TIMESTAMP).toLocaleString()
        }`}</p>

        <ItemSearch
          items={items ?? []}
          onSelectItem={(item) => {
            navigateToPath(`${APP_BASE_PATH}${item.id.toString()}`, setPathname)
          }}
        />

        {selectedItem !== null ? (
          <ItemDetailPage key={selectedItem.id} item={selectedItem} />
        ) : selectedItemId !== null && items !== null ? (
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

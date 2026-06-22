import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import type { NormalizedItem } from './data/types.ts'
import { ItemDetailPage } from './features/items/ItemDetailPage.tsx'
import { ItemSearch } from './features/items/ItemSearch.tsx'
import { loadCachedItemsIndex } from './features/items/cachedItemsIndex.ts'
import { UndercutTrackerPage } from './features/undercut-tracker/UndercutTrackerPage.tsx'
import { APP_BASE_PATH } from './constants.ts'

const styles: Record<'page' | 'card', CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '2rem 1rem',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '64rem',
    margin: '0 auto',
    borderRadius: '0.75rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    padding: '2rem',
  },
}

const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [items, setItems] = useState<NormalizedItem[] | null>(null)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const basePath = APP_BASE_PATH.replace(/\/+$/, '')
  const undercutTrackerPath = `${basePath}/undercut-tracker`
  const routeBases = [...new Set(['/TatarusLedger', basePath || '/'])]

  const joinRoute = (base: string, suffix: string): string =>
    base === '/' ? `/${suffix}` : `${base}/${suffix}`

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
          setLoadingError('Cached item artifact is empty or unavailable')
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
            : 'Unable to load cached item index',
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectedItemId = (() => {
    const matchedBase = routeBases.find(
      (candidate) =>
        pathname === candidate ||
        pathname.startsWith(candidate === '/' ? '/' : `${candidate}/`),
    )
    if (matchedBase === undefined) {
      return null
    }

    if (pathname === joinRoute(matchedBase, 'undercut-tracker')) {
      return null
    }

    const routeBase = matchedBase === '/' ? '' : matchedBase
    const escapedBase = routeBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`^${escapedBase}/(\\d+)/?$`).exec(pathname)
    if (match === null) {
      return null
    }

    const parsed = Number.parseInt(match[1], 10)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return null
    }

    return parsed
  })()

  const isUndercutTrackerRoute = routeBases.some(
    (candidate) => pathname === joinRoute(candidate, 'undercut-tracker'),
  )
  const selectedItem =
    selectedItemId === null || items === null || isUndercutTrackerRoute
      ? null
      : (items.find((item) => item.id === selectedItemId) ?? null)

  return (
    <main style={styles.page}>
      <article
        style={{
          ...styles.card,
          maxWidth: isUndercutTrackerRoute ? '80rem' : styles.card.maxWidth,
        }}
      >
        <h1>Tataru&apos;s Ledger</h1>
        <p>
          Search an item, open its details page, and quickly jump to popular
          FFXIV item resources. For live tracking, open the{' '}
          <a href={undercutTrackerPath}>undercut tracker</a>.
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

        {isUndercutTrackerRoute ? (
          <UndercutTrackerPage items={items ?? []} />
        ) : (
          <>
            <ItemSearch
              items={items ?? []}
              onSelectItem={(item) => {
                window.history.pushState(
                  {},
                  '',
                  `${APP_BASE_PATH}${item.id.toString()}`,
                )
                setPathname(window.location.pathname)
              }}
            />

            {selectedItem !== null ? (
              <ItemDetailPage key={selectedItem.id} item={selectedItem} />
            ) : selectedItemId !== null && items !== null ? (
              <p role="alert">Item not found in the loaded index.</p>
            ) : (
              <p role="status">
                Select an item to open {APP_BASE_PATH}
                {'{itemId}'}. For live tracking, open {undercutTrackerPath}.
              </p>
            )}
          </>
        )}
      </article>
    </main>
  )
}

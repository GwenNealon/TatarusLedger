import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { fetchMarketBoard } from './api/universalis.ts'

interface SearchItem {
  id: number
  name: string
  iconId: number
  category: string
}

interface ItemMarketSummary {
  lowestPrice: number | null
  listingCount: number
  saleCount: number
}

interface ItemCacheEntry {
  fetchedAt: number
  item: SearchItem
  marketSummary: ItemMarketSummary
}

type CacheStatus =
  | { state: 'cached' }
  | { state: 'refreshing' }
  | { state: 'error'; message: string }

const ITEM_CACHE_TTL_MS = 5 * 60 * 1_000
const SEARCH_DEBOUNCE_MS = 180

const ITEM_INDEX: SearchItem[] = [
  { id: 5339, name: 'Craftsman Syrup', iconId: 35484, category: 'Medicine' },
  {
    id: 12900,
    name: 'Tincture of Strength',
    iconId: 35489,
    category: 'Medicine',
  },
  { id: 36041, name: 'Integral Lumber', iconId: 24390, category: 'Lumber' },
  { id: 36073, name: 'Integral Ingot', iconId: 22217, category: 'Metal' },
  {
    id: 27857,
    name: 'Grade 2 Tincture of Dexterity',
    iconId: 35495,
    category: 'Medicine',
  },
  { id: 33917, name: 'Orange Juice', iconId: 9362, category: 'Meal' },
]

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

const searchInputStyles: CSSProperties = {
  width: '100%',
  maxWidth: '24rem',
  border: '1px solid #94a3b8',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '1rem',
}

const itemListStyles: CSSProperties = {
  listStyle: 'none',
  margin: '0.75rem 0 0',
  padding: 0,
  maxWidth: '24rem',
  maxHeight: '14rem',
  overflowY: 'auto',
  border: '1px solid #e2e8f0',
  borderRadius: '0.5rem',
}

const itemButtonStyles: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  border: 0,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem',
  cursor: 'pointer',
}

const sectionStyles: CSSProperties = {
  marginTop: '1.5rem',
  paddingTop: '1rem',
  borderTop: '1px solid #e2e8f0',
}

const itemHeaderStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
}

const iconStyles: CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
}

const spinningIconStyles: CSSProperties = {
  display: 'inline-block',
  marginRight: '0.35rem',
  animation: 'spin 1s linear infinite',
}

function toIconUrl(iconId: number): string {
  const iconName = String(iconId).padStart(6, '0')
  const folder = `${iconName.slice(0, 3)}000`
  return `https://xivapi.com/i/${folder}/${iconName}.png`
}

function getCacheKey(itemId: number): string {
  return `item-cache-${itemId.toString()}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readCache(itemId: number): ItemCacheEntry | null {
  const raw = localStorage.getItem(getCacheKey(itemId))
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    const item = parsed.item
    const marketSummary = parsed.marketSummary
    if (
      typeof parsed.fetchedAt === 'number' &&
      isRecord(item) &&
      typeof item.id === 'number' &&
      typeof item.name === 'string' &&
      typeof item.iconId === 'number' &&
      typeof item.category === 'string' &&
      isRecord(marketSummary) &&
      typeof marketSummary.listingCount === 'number' &&
      typeof marketSummary.saleCount === 'number' &&
      (typeof marketSummary.lowestPrice === 'number' ||
        marketSummary.lowestPrice === null)
    ) {
      return {
        fetchedAt: parsed.fetchedAt,
        item: {
          id: item.id,
          name: item.name,
          iconId: item.iconId,
          category: item.category,
        },
        marketSummary: {
          listingCount: marketSummary.listingCount,
          saleCount: marketSummary.saleCount,
          lowestPrice: marketSummary.lowestPrice,
        },
      }
    }
  } catch {
    return null
  }
  return null
}

function writeCache(entry: ItemCacheEntry): void {
  localStorage.setItem(getCacheKey(entry.item.id), JSON.stringify(entry))
}

function isFresh(entry: ItemCacheEntry): boolean {
  return Date.now() - entry.fetchedAt <= ITEM_CACHE_TTL_MS
}

function getResourceLinks(item: SearchItem): { label: string; href: string }[] {
  const encodedName = encodeURIComponent(item.name)
  return [
    {
      label: 'Universalis',
      href: `https://universalis.app/market/${item.id.toString()}`,
    },
    {
      label: 'saddlebagexchange',
      href: `https://saddlebagexchange.com/queries/item-data/${item.id.toString()}`,
    },
    {
      label: 'Teamcraft',
      href: `https://ffxivteamcraft.com/db/en/item/${item.id.toString()}/${encodedName}`,
    },
    {
      label: 'Garland Tools',
      href: `https://www.garlandtools.org/db/#item/${item.id.toString()}`,
    },
  ]
}

async function refreshItem(item: SearchItem): Promise<ItemCacheEntry> {
  const [marketData] = await fetchMarketBoard('Crystal', [item.id], {
    baseDelayMs: 0,
    listings: 10,
    entries: 10,
  })

  const lowestPrice =
    marketData.listings.length === 0
      ? null
      : Math.min(...marketData.listings.map((listing) => listing.pricePerUnit))

  const entry: ItemCacheEntry = {
    fetchedAt: Date.now(),
    item,
    marketSummary: {
      lowestPrice,
      listingCount: marketData.listings.length,
      saleCount: marketData.sales.length,
    },
  }
  writeCache(entry)
  return entry
}

function CacheStatusIcon(props: { status: CacheStatus; onRetry: () => void }) {
  const { status, onRetry } = props

  if (status.state === 'cached') {
    return (
      <span
        role="status"
        aria-label="Cached and fresh"
        title="Cached and fresh"
      >
        ✅ Cached and fresh
      </span>
    )
  }

  if (status.state === 'refreshing') {
    return (
      <span role="status" aria-live="polite" title="Refreshing cache">
        <span aria-hidden="true" style={spinningIconStyles}>
          ↻
        </span>
        Refreshing cache…
      </span>
    )
  }

  return (
    <span role="status" aria-live="polite" title={status.message}>
      ⚠️ Cache refresh failed
      <button type="button" style={{ marginLeft: '0.5rem' }} onClick={onRetry}>
        Retry
      </button>
    </span>
  )
}

export default function App() {
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [latestEntry, setLatestEntry] = useState<ItemCacheEntry | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [retrySignal, setRetrySignal] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(queryInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [queryInput])

  const filteredItems = useMemo(() => {
    if (query.length === 0) return ITEM_INDEX
    const lowered = query.toLowerCase()
    return ITEM_INDEX.filter((item) =>
      item.name.toLowerCase().includes(lowered),
    )
  }, [query])

  const selectedItem = useMemo(
    () => ITEM_INDEX.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId],
  )
  const selectedCache =
    selectedItem === null
      ? null
      : latestEntry !== null && latestEntry.item.id === selectedItem.id
        ? latestEntry
        : readCache(selectedItem.id)
  const needsRefresh =
    selectedItem !== null && (selectedCache === null || !isFresh(selectedCache))
  const cacheStatus: CacheStatus =
    refreshError !== null
      ? { state: 'error', message: refreshError }
      : needsRefresh
        ? { state: 'refreshing' }
        : { state: 'cached' }

  useEffect(() => {
    if (selectedItem === null) return

    const cachedEntry = readCache(selectedItem.id)
    if (cachedEntry !== null) {
      if (isFresh(cachedEntry)) {
        return
      }
    }

    let cancelled = false

    void refreshItem(selectedItem)
      .then((entry) => {
        if (cancelled) return
        setLatestEntry(entry)
        setRefreshError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setRefreshError(
          error instanceof Error ? error.message : 'Unknown refresh error',
        )
      })

    return () => {
      cancelled = true
    }
  }, [selectedItem, retrySignal])

  return (
    <main style={pageStyles}>
      <style>
        {
          '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
        }
      </style>
      <article style={cardStyles}>
        <h1>Tataru&apos;s Ledger</h1>
        <p>
          Search an item, open its details page, and quickly jump to popular
          FFXIV item resources.
        </p>

        <section aria-labelledby="item-search-heading">
          <h2 id="item-search-heading">Item search</h2>
          <label htmlFor="item-search-input">Search items</label>
          <br />
          <input
            id="item-search-input"
            type="search"
            style={searchInputStyles}
            value={queryInput}
            onChange={(event) => {
              setQueryInput(event.target.value)
            }}
            placeholder="Type an item name"
          />

          <ul style={itemListStyles}>
            {filteredItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  style={itemButtonStyles}
                  onClick={() => {
                    setSelectedItemId(item.id)
                    setLatestEntry(null)
                    setRefreshError(null)
                  }}
                >
                  <img
                    src={toIconUrl(item.iconId)}
                    alt={`${item.name} icon`}
                    width={24}
                    height={24}
                    style={{ borderRadius: '4px' }}
                  />
                  <span>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selectedItem !== null ? (
          <section aria-labelledby="item-detail-heading" style={sectionStyles}>
            <div style={itemHeaderStyles}>
              <img
                src={toIconUrl(selectedItem.iconId)}
                alt={`${selectedItem.name} icon`}
                style={iconStyles}
              />
              <h2 id="item-detail-heading" style={{ margin: 0 }}>
                {selectedItem.name}
              </h2>
              <CacheStatusIcon
                status={cacheStatus}
                onRetry={() => {
                  setRefreshError(null)
                  setRetrySignal((value) => value + 1)
                }}
              />
            </div>

            <dl>
              <dt>ID</dt>
              <dd>{selectedItem.id}</dd>
              <dt>Category</dt>
              <dd>{selectedItem.category}</dd>
              <dt>Listings in latest refresh</dt>
              <dd>{selectedCache?.marketSummary.listingCount ?? '—'}</dd>
              <dt>Sales in latest refresh</dt>
              <dd>{selectedCache?.marketSummary.saleCount ?? '—'}</dd>
              <dt>Lowest observed price</dt>
              <dd>
                {selectedCache?.marketSummary.lowestPrice === null ||
                selectedCache === null
                  ? '—'
                  : `${selectedCache.marketSummary.lowestPrice.toString()} gil`}
              </dd>
            </dl>

            <nav aria-label="External item resources">
              {getResourceLinks(selectedItem).map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginRight: '0.75rem' }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </section>
        ) : null}
      </article>
    </main>
  )
}

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { fetchMarketBoard } from '../../api/universalis.ts'
import type { NormalizedItem } from '../../data/types.ts'
import { toIconUrl } from './iconUrl.ts'

interface ItemMarketSummary {
  lowestPrice: number | null
  listingCount: number
  saleCount: number
}

interface ItemCacheEntry {
  fetchedAt: number
  item: NormalizedItem
  marketSummary: ItemMarketSummary
}

type CacheStatus =
  | { state: 'cached' }
  | { state: 'refreshing' }
  | { state: 'error'; message: string }

const ITEM_CACHE_TTL_MS = 5 * 60 * 1_000

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

function getCacheKey(itemId: number): string {
  return `item-cache-${itemId.toString()}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readCache(itemId: number): ItemCacheEntry | null {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(getCacheKey(itemId))
  } catch {
    return null
  }
  if (raw === null) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return null
    }

    const item = parsed.item
    const marketSummary = parsed.marketSummary

    if (
      typeof parsed.fetchedAt === 'number' &&
      isRecord(item) &&
      typeof item.id === 'number' &&
      typeof item.name === 'string' &&
      typeof item.iconId === 'number' &&
      typeof item.levelItem === 'number' &&
      typeof item.rarity === 'number' &&
      typeof item.uiCategory === 'number' &&
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
          levelItem: item.levelItem,
          rarity: item.rarity,
          uiCategory: item.uiCategory,
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
  try {
    window.localStorage.setItem(
      getCacheKey(entry.item.id),
      JSON.stringify(entry),
    )
  } catch {
    // Ignore cache write failures (quota/privacy mode); keep showing in-memory data.
  }
}

function isFresh(entry: ItemCacheEntry): boolean {
  return Date.now() - entry.fetchedAt <= ITEM_CACHE_TTL_MS
}

function getResourceLinks(
  item: NormalizedItem,
): { label: string; href: string }[] {
  const encodedName = encodeURIComponent(item.name)
  return [
    {
      label: 'Universalis',
      href: `https://universalis.app/market/${item.id.toString()}`,
    },
    {
      label: 'Saddlebag Exchange',
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

async function refreshItem(item: NormalizedItem): Promise<ItemCacheEntry> {
  const [marketData] = await fetchMarketBoard('Crystal', [item.id], {
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

interface ItemDetailPageProps {
  item: NormalizedItem
}

export function ItemDetailPage(props: ItemDetailPageProps) {
  const { item } = props
  const [latestEntry, setLatestEntry] = useState<ItemCacheEntry | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [retrySignal, setRetrySignal] = useState(0)

  const selectedCache =
    latestEntry !== null && latestEntry.item.id === item.id
      ? latestEntry
      : readCache(item.id)

  const needsRefresh = selectedCache === null || !isFresh(selectedCache)

  const cacheStatus: CacheStatus =
    refreshError !== null
      ? { state: 'error', message: refreshError }
      : needsRefresh
        ? { state: 'refreshing' }
        : { state: 'cached' }

  useEffect(() => {
    const cachedEntry = readCache(item.id)
    if (cachedEntry !== null && isFresh(cachedEntry)) {
      return
    }

    let cancelled = false

    void refreshItem(item)
      .then((entry) => {
        if (cancelled) {
          return
        }

        setLatestEntry(entry)
        setRefreshError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setRefreshError(
          error instanceof Error ? error.message : 'Unknown refresh error',
        )
      })

    return () => {
      cancelled = true
    }
  }, [item, retrySignal])

  return (
    <section aria-labelledby="item-detail-heading" style={sectionStyles}>
      <style>
        {
          '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
        }
      </style>
      <div style={itemHeaderStyles}>
        <img
          src={toIconUrl(item.iconId)}
          alt={`${item.name} icon`}
          style={iconStyles}
        />
        <h2 id="item-detail-heading" style={{ margin: 0 }}>
          {item.name}
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
        <dd>{item.id}</dd>
        <dt>Category</dt>
        <dd>{`UI Category ${item.uiCategory.toString()}`}</dd>
        <dt>Listings in latest refresh</dt>
        <dd>{selectedCache?.marketSummary.listingCount ?? '—'}</dd>
        <dt>Sales in latest refresh</dt>
        <dd>{selectedCache?.marketSummary.saleCount ?? '—'}</dd>
        <dt>Lowest observed price</dt>
        <dd>
          {selectedCache?.marketSummary.lowestPrice == null
            ? '—'
            : `${selectedCache.marketSummary.lowestPrice.toString()} gil`}
        </dd>
      </dl>

      <nav aria-label="External item resources">
        {getResourceLinks(item).map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginRight: '0.75rem' }}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </section>
  )
}

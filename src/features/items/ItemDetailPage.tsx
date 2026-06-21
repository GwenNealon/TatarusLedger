import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { fetchMarketBoard } from '../../api/universalis.ts'
import type { NormalizedItem } from '../../data/types.ts'

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

const ITEM_CACHE_TTL_MS = 5 * 60 * 1_000

const styles: Record<
  'section' | 'itemHeader' | 'icon' | 'spinningIcon',
  CSSProperties
> = {
  section: {
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  icon: {
    width: '40px',
    height: '40px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
  },
  spinningIcon: {
    display: 'inline-block',
    marginRight: '0.35rem',
    animation: 'spin 1s linear infinite',
  },
}

function isItemCacheEntry(value: unknown): value is ItemCacheEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const entry = value as Record<string, unknown>

  if (typeof entry.fetchedAt !== 'number') {
    return false
  }

  const item = entry.item
  const marketSummary = entry.marketSummary

  // Validate item
  if (
    typeof item !== 'object' ||
    item === null ||
    typeof (item as Record<string, unknown>).id !== 'number' ||
    typeof (item as Record<string, unknown>).name !== 'string' ||
    typeof (item as Record<string, unknown>).iconId !== 'number' ||
    typeof (item as Record<string, unknown>).levelItem !== 'number' ||
    typeof (item as Record<string, unknown>).rarity !== 'number' ||
    typeof (item as Record<string, unknown>).uiCategory !== 'number'
  ) {
    return false
  }

  // Validate marketSummary
  if (typeof marketSummary !== 'object' || marketSummary === null) {
    return false
  }

  const ms = marketSummary as Record<string, unknown>
  const lowestPrice = ms.lowestPrice

  return (
    typeof ms.listingCount === 'number' &&
    typeof ms.saleCount === 'number' &&
    (typeof lowestPrice === 'number' || lowestPrice === null)
  )
}

function readCache(itemId: number): ItemCacheEntry | null {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(`item-cache-${itemId.toString()}`)
  } catch {
    return null
  }
  if (raw === null) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return isItemCacheEntry(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeCache(entry: ItemCacheEntry): void {
  try {
    window.localStorage.setItem(
      `item-cache-${entry.item.id.toString()}`,
      JSON.stringify(entry),
    )
  } catch {
    // Ignore cache write failures (quota/privacy mode); keep showing in-memory data.
  }
}

function isFresh(entry: ItemCacheEntry): boolean {
  return Date.now() - entry.fetchedAt <= ITEM_CACHE_TTL_MS
}

async function refreshItem(item: NormalizedItem): Promise<ItemCacheEntry> {
  const marketData = (
    await fetchMarketBoard('Crystal', [item.id], {
      listings: 10,
      entries: 10,
    })
  ).at(0)

  if (marketData === undefined) {
    throw new Error('No market data returned for item')
  }

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

interface ItemDetailPageProps {
  item: NormalizedItem
}

export function ItemDetailPage(props: ItemDetailPageProps) {
  const { item } = props
  const [latestEntry, setLatestEntry] = useState<ItemCacheEntry | null>(() =>
    readCache(item.id),
  )
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [retrySignal, setRetrySignal] = useState(0)

  const needsRefresh = latestEntry === null || !isFresh(latestEntry)

  useEffect(() => {
    if (!needsRefresh) {
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
  }, [item, needsRefresh, retrySignal])

  return (
    <section aria-labelledby="item-detail-heading" style={styles.section}>
      <style>
        {
          '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
        }
      </style>
      <div style={styles.itemHeader}>
        <img
          src={`https://xivapi.com/i/${String(item.iconId).padStart(6, '0').slice(0, 3)}000/${String(item.iconId).padStart(6, '0')}.png`}
          alt={`${item.name} icon`}
          style={styles.icon}
        />
        <h2 id="item-detail-heading" style={{ margin: 0 }}>
          {item.name}
        </h2>
        {refreshError !== null ? (
          <span>
            <span role="status" aria-live="polite">
              {`⚠️ Cache refresh failed: ${refreshError}`}
            </span>
            <button
              type="button"
              style={{ marginLeft: '0.5rem' }}
              onClick={() => {
                setRefreshError(null)
                setRetrySignal((value) => value + 1)
              }}
            >
              Retry
            </button>
          </span>
        ) : needsRefresh ? (
          <span role="status" aria-live="polite" title="Refreshing cache">
            <span aria-hidden="true" style={styles.spinningIcon}>
              ↻
            </span>
            Refreshing cache…
          </span>
        ) : (
          <span
            role="status"
            aria-label="Cached and fresh"
            title="Cached and fresh"
          >
            ✅ Cached and fresh
          </span>
        )}
      </div>

      <dl>
        <dt>ID</dt>
        <dd>{item.id}</dd>
        <dt>Category</dt>
        <dd>{`UI Category ${item.uiCategory.toString()}`}</dd>
        <dt>Listings in latest refresh</dt>
        <dd>{latestEntry?.marketSummary.listingCount ?? '—'}</dd>
        <dt>Sales in latest refresh</dt>
        <dd>{latestEntry?.marketSummary.saleCount ?? '—'}</dd>
        <dt>Lowest observed price</dt>
        <dd>
          {latestEntry?.marketSummary.lowestPrice == null
            ? '—'
            : `${latestEntry.marketSummary.lowestPrice.toString()} gil`}
        </dd>
      </dl>

      <nav aria-label="External item resources">
        {[
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
            href: `https://ffxivteamcraft.com/db/en/item/${item.id.toString()}/${encodeURIComponent(item.name)}`,
          },
          {
            label: 'Garland Tools',
            href: `https://www.garlandtools.org/db/#item/${item.id.toString()}`,
          },
        ].map((link) => (
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

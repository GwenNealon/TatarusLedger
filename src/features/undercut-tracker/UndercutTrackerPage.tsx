import { deserialize, serialize } from 'bson'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import {
  fetchMarketBoard,
  fetchMarketableItemIds,
  fetchWorlds,
} from '../../api/universalis.ts'
import type { MarketData } from '../../api/types.ts'
import type { NormalizedItem } from '../../data/types.ts'
import { ItemSearch } from '../items/ItemSearch.tsx'
import {
  appendUniqueTokens,
  buildSubscriptionChannel,
  deriveItemState,
  discoverOwnedItemTokens,
  normalizeRetainerNames,
  parseWatchTokens,
  resolveWatchItems,
  type UndercutItemState,
} from './undercutTracker.ts'
import { APP_BASE_PATH } from '../../constants.ts'

interface UndercutTrackerPageProps {
  items: NormalizedItem[]
}

interface StoredConfig {
  world: string
  retainerInput: string
  itemInput: string
}

const STORAGE_KEY = 'undercut-tracker-config'
const WS_URL = 'wss://universalis.app/api/ws'
const POLL_INTERVAL_MS = 5 * 60 * 1_000

const styles: Record<
  | 'section'
  | 'grid'
  | 'card'
  | 'status'
  | 'controls'
  | 'chip'
  | 'chips'
  | 'tableWrap'
  | 'table'
  | 'tableCell'
  | 'iconCell'
  | 'icon'
  | 'qualitySymbol'
  | 'removeButton'
  | 'worldField'
  | 'worldSelect'
  | 'worldChevron',
  CSSProperties
> = {
  section: {
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
  },
  grid: {
    display: 'grid',
    gap: '1rem',
  },
  card: {
    border: '1px solid #cbd5e1',
    borderRadius: '0.75rem',
    padding: '1rem',
    background: '#f8fafc',
  },
  status: {
    margin: 0,
    fontWeight: 600,
  },
  controls: {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
    alignItems: 'start',
    marginBottom: '1rem',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    padding: '0.25rem 0.6rem',
    background: '#fff',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.5rem',
    padding: 0,
    listStyle: 'none',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tableCell: {
    borderBottom: '1px solid #e2e8f0',
    padding: '0.5rem',
    textAlign: 'left',
    verticalAlign: 'middle',
  },
  iconCell: {
    width: '2.5rem',
    textAlign: 'center',
  },
  icon: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    verticalAlign: 'middle',
  },
  qualitySymbol: {
    fontFamily: 'FFXIV_Lodestone_SSF',
  },
  removeButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '0.4rem',
    background: '#fff',
    cursor: 'pointer',
    width: '1.8rem',
    height: '1.8rem',
    lineHeight: 1,
  },
  worldField: {
    position: 'relative',
    display: 'grid',
    gap: '0.25rem',
  },
  worldSelect: {
    appearance: 'none',
    width: '100%',
    border: '1px solid #94a3b8',
    borderRadius: '0.5rem',
    padding: '0.5rem 2rem 0.5rem 0.75rem',
    backgroundColor: '#fff',
  },
  worldChevron: {
    position: 'absolute',
    right: '0.75rem',
    bottom: '0.7rem',
    pointerEvents: 'none',
    color: '#475569',
    fontSize: '0.85rem',
  },
}

function loadStoredConfig(): StoredConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return { world: 'Crystal', retainerInput: '', itemInput: '' }
    }

    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    return {
      world: typeof parsed.world === 'string' ? parsed.world : 'Crystal',
      retainerInput:
        typeof parsed.retainerInput === 'string' ? parsed.retainerInput : '',
      itemInput: typeof parsed.itemInput === 'string' ? parsed.itemInput : '',
    }
  } catch {
    return { world: 'Crystal', retainerInput: '', itemInput: '' }
  }
}

function formatGil(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString()} gil`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function formatQuantity(value: number): string {
  return value.toLocaleString()
}

function formatQuality(value: 'HQ' | 'NQ' | 'Mixed' | null): string {
  if (value === 'HQ') {
    return '\uE03C'
  }

  if (value === 'NQ') {
    return ''
  }

  return value ?? '—'
}

interface WatchContext {
  world: string
  itemIds: number[]
  itemNamesById: Map<number, string>
  retainerNames: string[]
  hasInput: boolean
}

interface ReconcileResult {
  nextStates: UndercutItemState[]
  newlyUndercut: UndercutItemState[]
}

function reconcileMarketData(params: {
  marketData: MarketData[]
  watchContext: WatchContext
  currentStates: UndercutItemState[]
}): ReconcileResult {
  const { marketData, watchContext, currentStates } = params
  const previousById = new Map(
    currentStates.map((state) => [state.itemId, state]),
  )
  const nextStates = marketData.map((entry) => {
    const itemName =
      watchContext.itemNamesById.get(entry.itemId) ??
      `Item ${entry.itemId.toString()}`

    return deriveItemState({
      marketData: entry,
      itemName,
      retainerNames: watchContext.retainerNames,
    })
  })

  const newlyUndercut = nextStates.filter((nextState) => {
    const previousState = previousById.get(nextState.itemId)
    return !previousState?.undercut && nextState.undercut
  })

  return { nextStates, newlyUndercut }
}

function playTone(): void {
  const audioContext = new AudioContext()
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gain.gain.value = 0.04

  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.18)
  oscillator.onended = () => {
    void audioContext.close()
  }
}

function readStoredConfig(): StoredConfig {
  return loadStoredConfig()
}

export function UndercutTrackerPage(props: UndercutTrackerPageProps) {
  const { items } = props
  const [config, setConfig] = useState(readStoredConfig)
  const [retainerDraft, setRetainerDraft] = useState('')
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  )
  const [itemStates, setItemStates] = useState<UndercutItemState[]>([])
  const [worldOptions, setWorldOptions] = useState<string[]>([])
  const [socketStatus, setSocketStatus] = useState('idle')
  const [refreshStatus, setRefreshStatus] = useState('Waiting for input')
  const [discoverStatus, setDiscoverStatus] = useState<string | null>(null)

  const itemTokens = useMemo(
    () => parseWatchTokens(config.itemInput),
    [config.itemInput],
  )
  const retainerNames = useMemo(
    () => normalizeRetainerNames(config.retainerInput),
    [config.retainerInput],
  )
  const resolvedItems = useMemo(
    () => resolveWatchItems(items, itemTokens),
    [items, itemTokens],
  )
  const itemIds = useMemo(
    () => resolvedItems.items.map((item) => item.id),
    [resolvedItems.items],
  )
  const itemNamesById = useMemo(
    () => new Map(resolvedItems.items.map((item) => [item.id, item.name])),
    [resolvedItems.items],
  )
  const trackedItemIds = useMemo(() => new Set(itemIds), [itemIds])
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  )
  const itemStatesById = useMemo(
    () => new Map(itemStates.map((state) => [state.itemId, state])),
    [itemStates],
  )
  const searchableItems = useMemo(
    () => items.filter((item) => !trackedItemIds.has(item.id)),
    [items, trackedItemIds],
  )
  const selectedWorld = worldOptions.includes(config.world)
    ? config.world
    : (worldOptions[0] ?? '')
  const watchContext = useMemo<WatchContext>(() => {
    const world = selectedWorld.trim()

    return {
      world,
      itemIds,
      itemNamesById,
      retainerNames,
      hasInput: world.length > 0 && itemIds.length > 0,
    }
  }, [itemIds, itemNamesById, retainerNames, selectedWorld])
  const watchedItemIdsKey = itemIds.join(',')
  const retainerNamesKey = retainerNames.join(',')
  const displaySocketStatus = watchContext.hasInput
    ? socketStatus === 'idle'
      ? 'connecting'
      : socketStatus
    : 'idle'
  const displayRefreshStatus = watchContext.hasInput
    ? refreshStatus
    : 'Add a world and items to start tracking'
  const visibleItemRows = watchContext.hasInput
    ? resolvedItems.items.map((item) => ({
        item,
        state: itemStatesById.get(item.id) ?? null,
      }))
    : []
  const canDiscover =
    worldOptions.length > 0 &&
    selectedWorld.length > 0 &&
    retainerNames.length > 0
  const itemBasePath = APP_BASE_PATH.endsWith('/')
    ? APP_BASE_PATH
    : `${APP_BASE_PATH}/`

  const addRetainerName = () => {
    const nextRetainer = retainerDraft.trim()
    if (nextRetainer.length === 0) {
      return
    }

    setConfig((current) => ({
      ...current,
      retainerInput: appendUniqueTokens(current.retainerInput, [nextRetainer]),
    }))
    setRetainerDraft('')
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      /* ignore storage failures */
    }
  }, [config])

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      return
    }

    if (Notification.permission !== 'default') {
      return
    }

    void Notification.requestPermission().then((result) => {
      setPermission(result)
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    void fetchWorlds()
      .then((worlds) => {
        if (!cancelled) {
          setWorldOptions(
            worlds
              .map((world) => world.name)
              .sort((left, right) => left.localeCompare(right)),
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorldOptions([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!watchContext.hasInput) {
      return
    }

    let cancelled = false

    void fetchMarketBoard(watchContext.world, watchContext.itemIds, {
      listings: 100,
      entries: 5,
    })
      .then((marketData) => {
        if (cancelled) {
          return
        }

        const result = reconcileMarketData({
          marketData,
          watchContext,
          currentStates: [],
        })

        setItemStates(result.nextStates)
        setRefreshStatus(`Synced ${marketData.length.toString()} items`)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRefreshStatus(
            error instanceof Error
              ? error.message
              : 'Unable to refresh market data',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [watchContext, watchedItemIdsKey, retainerNamesKey])

  useEffect(() => {
    if (!watchContext.hasInput) {
      return
    }

    const socket = new WebSocket(WS_URL)
    socket.binaryType = 'arraybuffer'

    socket.onopen = () => {
      setSocketStatus('connected')

      for (const itemId of watchContext.itemIds) {
        for (const event of [
          'listings/add',
          'listings/remove',
          'sales/add',
        ] as const) {
          socket.send(
            serialize({
              event: 'subscribe',
              channel: buildSubscriptionChannel(
                event,
                watchContext.world,
                itemId,
              ),
            }) as unknown as ArrayBuffer,
          )
        }
      }
    }

    socket.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) {
        return
      }

      try {
        const payload = deserialize(new Uint8Array(event.data)) as Record<
          string,
          unknown
        >
        const eventName = typeof payload.event === 'string' ? payload.event : ''
        if (
          eventName === 'listings/add' ||
          eventName === 'listings/remove' ||
          eventName === 'sales/add'
        ) {
          void fetchMarketBoard(watchContext.world, watchContext.itemIds, {
            listings: 100,
            entries: 5,
          })
            .then((marketData) => {
              setItemStates((currentStates) => {
                const result = reconcileMarketData({
                  marketData,
                  watchContext,
                  currentStates,
                })

                for (const nextState of result.newlyUndercut) {
                  if (permission === 'granted') {
                    try {
                      new Notification('Undercut detected', {
                        body: `${nextState.itemName} dropped below your price`,
                      })
                    } catch {
                      /* ignore notification failures */
                    }
                  }

                  try {
                    playTone()
                  } catch {
                    /* ignore audio failures */
                  }
                }

                return result.nextStates
              })
            })
            .catch(() => {
              /* ignore websocket-triggered reconciliation failures */
            })
        }
      } catch {
        /* ignore malformed websocket messages */
      }
    }

    socket.onclose = () => {
      setSocketStatus('disconnected')
    }

    socket.onerror = () => {
      setSocketStatus('error')
    }

    return () => {
      socket.close()
    }
  }, [permission, watchContext, watchedItemIdsKey, retainerNamesKey])

  useEffect(() => {
    if (!watchContext.hasInput) {
      return
    }

    const interval = window.setInterval(() => {
      void fetchMarketBoard(watchContext.world, watchContext.itemIds, {
        listings: 100,
        entries: 5,
      })
        .then((marketData) => {
          setItemStates((currentStates) => {
            const result = reconcileMarketData({
              marketData,
              watchContext,
              currentStates,
            })

            for (const nextState of result.newlyUndercut) {
              if (permission === 'granted') {
                try {
                  new Notification('Undercut detected', {
                    body: `${nextState.itemName} dropped below your price`,
                  })
                } catch {
                  /* ignore notification failures */
                }
              }

              try {
                playTone()
              } catch {
                /* ignore audio failures */
              }
            }

            return result.nextStates
          })
          setRefreshStatus('Reconciled with REST snapshot')
        })
        .catch((error: unknown) => {
          setRefreshStatus(
            error instanceof Error
              ? error.message
              : 'Unable to refresh market data',
          )
        })
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [permission, watchContext, watchedItemIdsKey, retainerNamesKey])

  return (
    <section aria-labelledby="undercut-tracker-heading" style={styles.section}>
      <h2 id="undercut-tracker-heading">Live undercut tracker</h2>
      <p>WebSocket first, REST reconciliation every 5 minutes.</p>

      <p aria-live="polite" style={styles.status}>
        {`Socket: ${displaySocketStatus} | ${displayRefreshStatus}`}
      </p>

      <div style={styles.controls}>
        <label htmlFor="undercut-world-select" style={styles.worldField}>
          World
          <select
            id="undercut-world-select"
            value={selectedWorld}
            onChange={(event) => {
              setConfig((current) => ({
                ...current,
                world: event.target.value,
              }))
            }}
            style={styles.worldSelect}
            disabled={worldOptions.length === 0}
          >
            <option value="" disabled>
              Select a world
            </option>
            {worldOptions.map((world) => (
              <option key={world} value={world}>
                {world}
              </option>
            ))}
          </select>
          <span aria-hidden="true" style={styles.worldChevron}>
            ▾
          </span>
        </label>

        <label>
          Retainer names
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={retainerDraft}
              onChange={(event) => {
                setRetainerDraft(event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return
                }

                event.preventDefault()
                addRetainerName()
              }}
              placeholder="Add retainer name"
            />
            <button
              type="button"
              onClick={() => {
                addRetainerName()
              }}
            >
              Add retainer
            </button>
          </div>
        </label>
      </div>

      {parseWatchTokens(config.retainerInput).length > 0 ? (
        <ul style={styles.chips}>
          {parseWatchTokens(config.retainerInput).map((retainerName, index) => (
            <li key={`${retainerName}-${index.toString()}`} style={styles.chip}>
              <span>{retainerName}</span>
              <button
                type="button"
                onClick={() => {
                  setConfig((current) => ({
                    ...current,
                    retainerInput: parseWatchTokens(current.retainerInput)
                      .filter((token) => token !== retainerName)
                      .join('\n'),
                  }))
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {typeof Notification !== 'undefined' && permission !== 'granted' ? (
        <button
          type="button"
          disabled={permission !== 'default'}
          onClick={() => {
            if (Notification.permission !== 'default') {
              setPermission(Notification.permission)
              return
            }

            void Notification.requestPermission().then((result) => {
              setPermission(result)
            })
          }}
        >
          Enable browser alerts
        </button>
      ) : null}

      <button
        type="button"
        disabled={!canDiscover}
        onClick={() => {
          void (async () => {
            if (!canDiscover) {
              return
            }
            setDiscoverStatus('Scanning marketable items...')

            try {
              const marketableItemIds = await fetchMarketableItemIds()
              const totalMarketableItems = marketableItemIds.length
              let checkedMarketableItems = 0
              const discoveredTokens = new Set<string>()

              for (
                let index = 0;
                index < marketableItemIds.length;
                index += 100
              ) {
                setDiscoverStatus(
                  `Checked ${checkedMarketableItems.toString()} of ${totalMarketableItems.toString()} marketable items...`,
                )

                const batch = marketableItemIds.slice(index, index + 100)
                const marketData = await fetchMarketBoard(
                  watchContext.world,
                  batch,
                  {
                    listings: 100,
                    entries: 0,
                  },
                )

                checkedMarketableItems += batch.length

                const newlyDiscoveredTokens = discoverOwnedItemTokens({
                  marketData,
                  retainerNames: watchContext.retainerNames,
                }).filter((token) => !discoveredTokens.has(token))

                if (newlyDiscoveredTokens.length > 0) {
                  for (const token of newlyDiscoveredTokens) {
                    discoveredTokens.add(token)
                  }

                  setConfig((current) => ({
                    ...current,
                    itemInput: appendUniqueTokens(
                      current.itemInput,
                      newlyDiscoveredTokens,
                    ),
                  }))
                }

                setDiscoverStatus(
                  `Checked ${checkedMarketableItems.toString()} of ${totalMarketableItems.toString()} marketable items. Discovered ${discoveredTokens.size.toString()} item(s) so far.`,
                )
              }

              if (discoveredTokens.size === 0) {
                setDiscoverStatus('No listings matched your retainers')
                return
              }

              setDiscoverStatus(
                `Discovered ${discoveredTokens.size.toString()} item(s)`,
              )
            } catch (error: unknown) {
              setDiscoverStatus(
                error instanceof Error
                  ? error.message
                  : 'Discovery scan failed',
              )
            }
          })()
        }}
      >
        Discover my listings
      </button>
      {discoverStatus !== null ? (
        <p aria-live="polite">{discoverStatus}</p>
      ) : null}

      <ItemSearch
        items={searchableItems}
        onSelectItem={(item) => {
          setConfig((current) => ({
            ...current,
            itemInput: parseWatchTokens(
              `${current.itemInput}\n${item.id.toString()}`,
            ).join('\n'),
          }))
        }}
      />

      {resolvedItems.unresolvedTokens.length > 0 ? (
        <p role="alert">{`Could not resolve: ${resolvedItems.unresolvedTokens.join(', ')}`}</p>
      ) : null}

      <div style={styles.tableWrap}>
        {visibleItemRows.length === 0 ? (
          <article style={styles.card}>
            <p style={{ margin: 0 }}>
              Add a world and at least one item to start tracking.
            </p>
          </article>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableCell} />
                <th style={styles.tableCell} />
                <th style={styles.tableCell}>Item Name</th>
                <th style={styles.tableCell}>Quality</th>
                <th style={styles.tableCell}>Quantity</th>
                <th style={styles.tableCell}>Selling Price</th>
                <th style={styles.tableCell}>Lowest Competitor Price</th>
                <th style={styles.tableCell}>Last Synced</th>
              </tr>
            </thead>
            <tbody>
              {visibleItemRows.map(({ item, state }) => {
                const iconId = String(
                  itemById.get(item.id)?.iconId ?? item.iconId,
                ).padStart(6, '0')
                const iconUrl = `https://xivapi.com/i/${iconId.slice(0, 3)}000/${iconId}.png`

                return (
                  <tr key={item.id}>
                    <td style={styles.tableCell}>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        style={styles.removeButton}
                        onClick={() => {
                          setConfig((current) => ({
                            ...current,
                            itemInput: parseWatchTokens(current.itemInput)
                              .filter((token) => token !== item.id.toString())
                              .join('\n'),
                          }))
                        }}
                      >
                        X
                      </button>
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.iconCell }}>
                      <img
                        src={iconUrl}
                        alt={`${item.name} icon`}
                        width={24}
                        height={24}
                        style={styles.icon}
                      />
                    </td>
                    <td style={styles.tableCell}>
                      <a href={`${itemBasePath}${item.id.toString()}`}>
                        {item.name}
                      </a>
                    </td>
                    <td style={styles.tableCell}>
                      <span
                        aria-label={
                          state?.ownedQuality === 'HQ'
                            ? 'High Quality'
                            : undefined
                        }
                        style={
                          state?.ownedQuality === 'HQ'
                            ? styles.qualitySymbol
                            : undefined
                        }
                      >
                        {formatQuality(state?.ownedQuality ?? null)}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      {state?.lowestOwnedPrice != null
                        ? formatQuantity(state.ownedQuantity)
                        : '—'}
                    </td>
                    <td style={styles.tableCell}>
                      {formatGil(state?.lowestOwnedPrice ?? null)}
                    </td>
                    <td style={styles.tableCell}>
                      {formatGil(state?.lowestCompetitorPrice ?? null)}
                    </td>
                    <td style={styles.tableCell}>
                      {formatDate(state?.lastSyncedAt ?? Number.NaN)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p>
        Notifications: {permission}. The tracker only alerts on a transition
        from Competitive to Undercut.
      </p>
    </section>
  )
}

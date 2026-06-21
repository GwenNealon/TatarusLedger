import { deserialize, serialize } from 'bson'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import {
  fetchMarketBoard,
  fetchMarketableItemIds,
  fetchTaxRates,
  fetchWorlds,
  type TaxRates,
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
const GIL_SYMBOL = '\uE049'

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
  | 'gilSymbol'
  | 'gilValue'
  | 'removeButton'
  | 'worldField'
  | 'worldSelect'
  | 'worldChevron'
  | 'retainerCell'
  | 'marketIcon'
  | 'taxWarningBadge'
  | 'retainerChipIcon'
  | 'unknownRetainerIcon'
  | 'retainerHint'
  | 'chipRemoveButton'
  | 'rankBadge'
  | 'rankInfo',
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
  gilSymbol: {
    fontFamily: 'FFXIV_Lodestone_SSF',
  },
  gilValue: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.2rem',
    whiteSpace: 'nowrap',
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
  retainerCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  marketIcon: {
    width: '16px',
    height: '16px',
    borderRadius: '6px',
    verticalAlign: 'middle',
  },
  taxWarningBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid #f59e0b',
    borderRadius: '999px',
    padding: '0.05rem 0.35rem',
    backgroundColor: '#fffbeb',
    color: '#92400e',
    fontSize: '0.7rem',
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  retainerChipIcon: {
    width: '14px',
    height: '14px',
    borderRadius: '5px',
    verticalAlign: 'middle',
  },
  unknownRetainerIcon: {
    width: '14px',
    height: '14px',
    borderRadius: '999px',
    border: '1px solid #94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.65rem',
    color: '#475569',
    background: '#fff',
  },
  retainerHint: {
    marginTop: '0.5rem',
    marginBottom: 0,
    color: '#475569',
    fontSize: '0.85rem',
  },
  chipRemoveButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '0.35rem',
    background: '#fff',
    cursor: 'pointer',
    width: '1.3rem',
    height: '1.3rem',
    lineHeight: 1,
    fontSize: '0.75rem',
    padding: 0,
  },
  rankBadge: {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    minWidth: '1.35rem',
    height: '1.35rem',
    padding: '0 0.35rem',
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontSize: '0.7rem',
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    cursor: 'help',
  },
  rankInfo: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    width: '1.35rem',
    height: '1.35rem',
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontSize: '0.75rem',
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'help',
    userSelect: 'none',
  },
}

const SUBTABLE_LEFT_DIVIDER: CSSProperties = {
  borderLeft: '1px solid #e2e8f0',
}

const SUBTABLE_RIGHT_DIVIDER: CSSProperties = {
  borderRight: '1px solid #e2e8f0',
}

const RETAINER_CITY_BY_ID: Partial<
  Record<number, { name: keyof TaxRates; iconId: number }>
> = {
  1: { name: 'Limsa Lominsa', iconId: 60_881 },
  2: { name: 'Gridania', iconId: 60_882 },
  3: { name: "Ul'dah", iconId: 60_883 },
  4: { name: 'Ishgard', iconId: 60_884 },
  7: { name: 'Kugane', iconId: 60_885 },
  10: { name: 'Crystarium', iconId: 60_886 },
  12: { name: 'Old Sharlayan', iconId: 60_887 },
  14: { name: 'Tuliyollal', iconId: 60_888 },
}

function toXivIconUrl(iconId: number): string {
  const normalizedId = iconId.toString().padStart(6, '0')
  return `https://xivapi.com/i/${normalizedId.slice(0, 3)}000/${normalizedId}.png`
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

function formatGil(value: number | null): ReactNode {
  return value === null ? (
    ''
  ) : (
    <span style={styles.gilValue}>
      <span>{value.toLocaleString()}</span>
      <span style={styles.gilSymbol}>{GIL_SYMBOL}</span>
    </span>
  )
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
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

  return value ?? ''
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
  const [taxRatesByCity, setTaxRatesByCity] = useState<Partial<TaxRates>>({})
  const retainerInputTokens = useMemo(
    () => parseWatchTokens(config.retainerInput),
    [config.retainerInput],
  )
  const retainerCityByName = useMemo(() => {
    const cityByName = new Map<string, number>()

    for (const state of itemStates) {
      for (const listing of state.ownedListings) {
        if (listing.retainerCity === undefined) {
          continue
        }

        const key = listing.retainerName.toLowerCase()
        if (!cityByName.has(key)) {
          cityByName.set(key, listing.retainerCity)
        }
      }
    }

    return cityByName
  }, [itemStates])
  const hasUnknownRetainerCity = useMemo(
    () =>
      retainerInputTokens.some((retainerName) => {
        const cityId = retainerCityByName.get(retainerName.toLowerCase())
        if (cityId === undefined) {
          return true
        }

        return RETAINER_CITY_BY_ID[cityId] === undefined
      }),
    [retainerCityByName, retainerInputTokens],
  )
  const taxRateEntries = useMemo(() => {
    const entries: [keyof TaxRates, number][] = []

    for (const [city, taxRate] of Object.entries(taxRatesByCity)) {
      if (typeof taxRate === 'number') {
        entries.push([city as keyof TaxRates, taxRate])
      }
    }

    return entries
  }, [taxRatesByCity])
  const lowestTaxRate = useMemo(
    () =>
      taxRateEntries.length > 0
        ? Math.min(...taxRateEntries.map(([, taxRate]) => taxRate))
        : null,
    [taxRateEntries],
  )
  const lowestTaxCities = useMemo(
    () =>
      lowestTaxRate === null
        ? []
        : taxRateEntries
            .filter(([, taxRate]) => taxRate === lowestTaxRate)
            .map(([city]) => city),
    [lowestTaxRate, taxRateEntries],
  )

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
    if (selectedWorld.length === 0) {
      return
    }

    let cancelled = false

    void fetchTaxRates(selectedWorld)
      .then((taxRates) => {
        if (!cancelled) {
          setTaxRatesByCity(taxRates)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTaxRatesByCity({})
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedWorld])

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

      {retainerInputTokens.length > 0 ? (
        <ul style={styles.chips}>
          {retainerInputTokens.map((retainerName, index) => {
            const cityId = retainerCityByName.get(retainerName.toLowerCase())
            const marketCity =
              cityId === undefined ? undefined : RETAINER_CITY_BY_ID[cityId]
            const taxRate =
              marketCity === undefined
                ? undefined
                : taxRatesByCity[marketCity.name]
            const isHigherTaxThanLowest =
              typeof taxRate === 'number' &&
              lowestTaxRate !== null &&
              taxRate > lowestTaxRate

            return (
              <li
                key={`${retainerName}-${index.toString()}`}
                style={styles.chip}
              >
                <button
                  type="button"
                  aria-label={`Remove ${retainerName}`}
                  style={styles.chipRemoveButton}
                  onClick={() => {
                    setConfig((current) => ({
                      ...current,
                      retainerInput: parseWatchTokens(current.retainerInput)
                        .filter((token) => token !== retainerName)
                        .join('\n'),
                    }))
                  }}
                >
                  X
                </button>
                <span>{retainerName}</span>
                {marketCity !== undefined ? (
                  <img
                    src={toXivIconUrl(marketCity.iconId)}
                    alt={`${marketCity.name} market icon`}
                    title={
                      typeof taxRate === 'number'
                        ? `${marketCity.name} (${taxRate.toString()}% tax)`
                        : marketCity.name
                    }
                    width={14}
                    height={14}
                    style={styles.retainerChipIcon}
                  />
                ) : (
                  <span
                    aria-label="Market city unknown"
                    title="Market city unknown"
                    style={styles.unknownRetainerIcon}
                  >
                    ?
                  </span>
                )}
                {isHigherTaxThanLowest ? (
                  <span
                    style={styles.taxWarningBadge}
                    title={`Current: ${taxRate.toString()}% | Lowest: ${lowestTaxRate.toString()}% (${lowestTaxCities.join(', ')})`}
                  >
                    Tax High
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {hasUnknownRetainerCity ? (
        <p style={styles.retainerHint}>
          Unknown retainer market icons will update once a listing associated
          with that retainer is found.
        </p>
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
                <th style={styles.tableCell} rowSpan={2} />
                <th style={styles.tableCell} rowSpan={2} />
                <th style={styles.tableCell} rowSpan={2}>
                  Item Name
                </th>
                <th
                  style={{
                    ...styles.tableCell,
                    ...SUBTABLE_LEFT_DIVIDER,
                    ...SUBTABLE_RIGHT_DIVIDER,
                    textAlign: 'center',
                  }}
                  colSpan={4}
                >
                  Your listings
                </th>
                <th
                  style={{
                    ...styles.tableCell,
                    ...SUBTABLE_LEFT_DIVIDER,
                    ...SUBTABLE_RIGHT_DIVIDER,
                    textAlign: 'center',
                  }}
                  colSpan={6}
                >
                  Competitor listings
                </th>
                <th style={styles.tableCell} rowSpan={2}>
                  Last Synced
                </th>
              </tr>
              <tr>
                <th style={{ ...styles.tableCell, ...SUBTABLE_LEFT_DIVIDER }}>
                  Quality
                </th>
                <th style={styles.tableCell}>Quantity</th>
                <th style={styles.tableCell}>Selling Price</th>
                <th style={{ ...styles.tableCell, ...SUBTABLE_RIGHT_DIVIDER }}>
                  Retainer Name
                </th>
                <th style={{ ...styles.tableCell, ...SUBTABLE_LEFT_DIVIDER }}>
                  Quality
                </th>
                <th style={styles.tableCell}>Quantity</th>
                <th style={styles.tableCell}>Selling Price</th>
                <th style={styles.tableCell}>Total Cost</th>
                <th style={styles.tableCell}>Retainer Name</th>
                <th
                  style={{ ...styles.tableCell, ...SUBTABLE_RIGHT_DIVIDER }}
                  aria-label="Competitor details"
                />
              </tr>
            </thead>
            <tbody>
              {visibleItemRows.flatMap(({ item, state }) => {
                const iconId = String(
                  itemById.get(item.id)?.iconId ?? item.iconId,
                ).padStart(6, '0')
                const iconUrl = `https://xivapi.com/i/${iconId.slice(0, 3)}000/${iconId}.png`
                const listingRows =
                  state?.ownedListings.length !== undefined &&
                  state.ownedListings.length > 0
                    ? state.ownedListings
                    : [null]
                const competitorRows =
                  state?.competitorListings.length !== undefined &&
                  state.competitorListings.length > 0
                    ? state.competitorListings
                    : [null]
                const competitorListingCount =
                  state?.competitorListings.length ?? 0
                const showCompetitorInfoButton = competitorListingCount > 1
                const rowSpan = Math.max(
                  listingRows.length,
                  competitorRows.length,
                )

                return Array.from({ length: rowSpan }, (_, index) => {
                  const listing = listingRows[index] ?? null
                  const competitor = competitorRows[index] ?? null
                  const marketCity =
                    listing?.retainerCity !== undefined
                      ? RETAINER_CITY_BY_ID[listing.retainerCity]
                      : undefined
                  const taxRate =
                    marketCity === undefined
                      ? undefined
                      : taxRatesByCity[marketCity.name]
                  const isHigherTaxThanLowest =
                    typeof taxRate === 'number' &&
                    lowestTaxRate !== null &&
                    taxRate > lowestTaxRate
                  const competitorCity =
                    competitor?.retainerCity !== undefined
                      ? RETAINER_CITY_BY_ID[competitor.retainerCity]
                      : undefined

                  return (
                    <tr key={`${item.id.toString()}-${index.toString()}`}>
                      {index === 0 ? (
                        <>
                          <td style={styles.tableCell} rowSpan={rowSpan}>
                            <button
                              type="button"
                              aria-label={`Remove ${item.name}`}
                              style={styles.removeButton}
                              onClick={() => {
                                setConfig((current) => ({
                                  ...current,
                                  itemInput: parseWatchTokens(current.itemInput)
                                    .filter(
                                      (token) => token !== item.id.toString(),
                                    )
                                    .join('\n'),
                                }))
                              }}
                            >
                              X
                            </button>
                          </td>
                          <td
                            style={{ ...styles.tableCell, ...styles.iconCell }}
                            rowSpan={rowSpan}
                          >
                            <img
                              src={iconUrl}
                              alt={`${item.name} icon`}
                              width={24}
                              height={24}
                              style={styles.icon}
                            />
                          </td>
                          <td style={styles.tableCell} rowSpan={rowSpan}>
                            <a href={`${itemBasePath}${item.id.toString()}`}>
                              {item.name}
                            </a>
                          </td>
                        </>
                      ) : null}
                      <td
                        style={{
                          ...styles.tableCell,
                          ...SUBTABLE_LEFT_DIVIDER,
                        }}
                      >
                        <span
                          aria-label={
                            listing?.quality === 'HQ'
                              ? 'High Quality'
                              : undefined
                          }
                          style={
                            listing?.quality === 'HQ'
                              ? styles.qualitySymbol
                              : undefined
                          }
                        >
                          {formatQuality(listing?.quality ?? null)}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        {listing === null
                          ? ''
                          : formatQuantity(listing.quantity)}
                      </td>
                      <td style={styles.tableCell}>
                        {listing === null
                          ? ''
                          : formatGil(listing.sellingPrice)}
                      </td>
                      <td
                        style={{
                          ...styles.tableCell,
                          ...SUBTABLE_RIGHT_DIVIDER,
                        }}
                      >
                        {listing === null ? (
                          ''
                        ) : (
                          <span style={styles.retainerCell}>
                            <span>{listing.retainerName}</span>
                            {marketCity === undefined ? null : (
                              <img
                                src={toXivIconUrl(marketCity.iconId)}
                                alt={`${marketCity.name} market icon`}
                                title={
                                  typeof taxRate === 'number'
                                    ? `${marketCity.name} (${taxRate.toString()}% tax)`
                                    : marketCity.name
                                }
                                width={16}
                                height={16}
                                style={styles.marketIcon}
                              />
                            )}
                            {isHigherTaxThanLowest ? (
                              <span
                                style={styles.taxWarningBadge}
                                title={`Current: ${taxRate.toString()}% | Lowest: ${lowestTaxRate.toString()}% (${lowestTaxCities.join(', ')})`}
                              >
                                Tax High
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...styles.tableCell,
                          ...SUBTABLE_LEFT_DIVIDER,
                        }}
                      >
                        <span
                          aria-label={
                            competitor?.quality === 'HQ'
                              ? 'High Quality'
                              : undefined
                          }
                          style={
                            competitor?.quality === 'HQ'
                              ? styles.qualitySymbol
                              : undefined
                          }
                        >
                          {formatQuality(competitor?.quality ?? null)}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        {competitor === null
                          ? ''
                          : formatQuantity(competitor.quantity)}
                      </td>
                      <td style={styles.tableCell}>
                        {competitor === null
                          ? ''
                          : formatGil(competitor.sellingPrice)}
                      </td>
                      <td style={styles.tableCell}>
                        {competitor === null
                          ? ''
                          : formatGil(competitor.totalCost)}
                      </td>
                      <td
                        style={{
                          ...styles.tableCell,
                        }}
                      >
                        {competitor === null ? (
                          ''
                        ) : (
                          <span style={styles.retainerCell}>
                            <span>{competitor.retainerName}</span>
                            {competitorCity === undefined ? null : (
                              <img
                                src={toXivIconUrl(competitorCity.iconId)}
                                alt={`${competitorCity.name} market icon`}
                                title={competitorCity.name}
                                width={16}
                                height={16}
                                style={styles.marketIcon}
                              />
                            )}
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...styles.tableCell,
                          ...SUBTABLE_RIGHT_DIVIDER,
                        }}
                      >
                        {competitor === null ? (
                          ''
                        ) : showCompetitorInfoButton ? (
                          <button
                            type="button"
                            style={styles.rankInfo}
                            title={competitor.reasons.join(' | ')}
                            aria-label={`Competitor details: ${competitor.reasons.join(', ')}`}
                          >
                            i
                          </button>
                        ) : (
                          ''
                        )}
                      </td>
                      {index === 0 ? (
                        <td style={styles.tableCell} rowSpan={rowSpan}>
                          {formatDate(state?.lastSyncedAt ?? Number.NaN)}
                        </td>
                      ) : null}
                    </tr>
                  )
                })
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

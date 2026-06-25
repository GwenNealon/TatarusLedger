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
  | 'tableCellRight'
  | 'tableCellCenter'
  | 'iconCell'
  | 'icon'
  | 'qualitySymbol'
  | 'gilSymbol'
  | 'gilValue'
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
  | 'rankInfo'
  | 'ageInfo'
  | 'ageWarningIcon'
  | 'refreshButton'
  | 'refreshButtonError'
  | 'refreshGlyph'
  | 'liveTooltip'
  | 'skeletonBar'
  | 'visuallyHidden',
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
    width: 'fit-content',
    maxWidth: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    overflowX: 'auto',
  },
  table: {
    width: 'max-content',
    borderCollapse: 'collapse',
  },
  tableCell: {
    borderBottom: '1px solid #e2e8f0',
    padding: '0.25rem 0.5rem',
    textAlign: 'left',
    verticalAlign: 'middle',
  },
  tableCellRight: {
    borderBottom: '1px solid #e2e8f0',
    padding: '0.25rem 0.5rem',
    textAlign: 'right',
    verticalAlign: 'middle',
  },
  tableCellCenter: {
    borderBottom: '1px solid #e2e8f0',
    padding: '0.25rem 0.5rem',
    textAlign: 'center',
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
  ageInfo: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    width: '1.35rem',
    height: '1.35rem',
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontSize: '0.8rem',
    lineHeight: 1,
    cursor: 'help',
    userSelect: 'none',
  },
  ageWarningIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#92400e',
    fontSize: '0.9rem',
    lineHeight: 1,
    cursor: 'help',
    userSelect: 'none',
  },
  refreshButton: {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    minHeight: '1.8rem',
    backgroundColor: '#fff',
    color: '#334155',
    cursor: 'pointer',
    padding: '0.2rem 0.6rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  refreshButtonError: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
  },
  refreshGlyph: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    lineHeight: 1,
    transformOrigin: 'center',
  },
  liveTooltip: {
    position: 'fixed',
    zIndex: 1000,
    maxWidth: '20rem',
    border: '1px solid #334155',
    borderRadius: '0.45rem',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '0.75rem',
    lineHeight: 1.35,
    padding: '0.35rem 0.5rem',
    whiteSpace: 'pre-line',
    pointerEvents: 'none',
    boxShadow: '0 6px 16px rgba(2, 6, 23, 0.35)',
  },
  skeletonBar: {
    display: 'inline-block',
    height: '0.9rem',
    borderRadius: '0.35rem',
    backgroundColor: '#e2e8f0',
  },
  visuallyHidden: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
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
  return `https://v2.xivapi.com/api/asset?path=ui/icon/${normalizedId.slice(0, 3)}000/${normalizedId}.tex&format=png`
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

function formatRelativeAge(timestamp: number, now: number): string {
  if (!Number.isFinite(timestamp)) {
    return 'Age unknown'
  }

  const diffMs = Math.max(0, now - timestamp)
  const minuteMs = 60_000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < minuteMs) {
    return 'Just now'
  }

  if (diffMs < hourMs) {
    const minutes = Math.floor(diffMs / minuteMs)
    return `${minutes.toString()} minute${minutes === 1 ? '' : 's'} ago`
  }

  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs)
    return `${hours.toString()} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(diffMs / dayMs)
  return `${days.toString()} day${days === 1 ? '' : 's'} ago`
}

function formatAgeTooltip(timestamp: number, now: number): string {
  const relative = formatRelativeAge(timestamp, now)
  const exact = formatDate(timestamp)
  return exact.length > 0 ? `${relative} (${exact})` : relative
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds.toString()} second${seconds === 1 ? '' : 's'}`
  }

  if (seconds === 0) {
    return `${minutes.toString()} minute${minutes === 1 ? '' : 's'}`
  }

  return `${minutes.toString()} minute${minutes === 1 ? '' : 's'} ${seconds.toString()} second${seconds === 1 ? '' : 's'}`
}

function ageBadgeStyle(ageMs: number | null): CSSProperties {
  if (ageMs === null) {
    return styles.ageInfo
  }

  const sixHoursMs = 6 * 60 * 60 * 1_000
  const fortyEightHoursMs = 48 * 60 * 60 * 1_000

  if (ageMs > fortyEightHoursMs) {
    return {
      ...styles.ageInfo,
      borderColor: '#dc2626',
      backgroundColor: '#fef2f2',
      color: '#b91c1c',
    }
  }

  if (ageMs > sixHoursMs) {
    return {
      ...styles.ageInfo,
      borderColor: '#f59e0b',
      backgroundColor: '#fffbeb',
      color: '#92400e',
    }
  }

  return styles.ageInfo
}

function formatQuantity(value: number): string {
  return value.toLocaleString()
}

function competitorInfoStyle(params: {
  beatsByPrice: boolean
  beatsByComparableTotal: boolean
  allOneRespect: boolean
}): CSSProperties {
  const { beatsByPrice, beatsByComparableTotal, allOneRespect } = params
  if (beatsByPrice && beatsByComparableTotal) {
    return {
      ...styles.rankInfo,
      borderColor: '#dc2626',
      backgroundColor: '#fef2f2',
      color: '#b91c1c',
    }
  }

  if (beatsByPrice || beatsByComparableTotal) {
    // ponytail: if every competitor is only one-respect competitive, treat as red (same urgency as all-respects)
    const color = allOneRespect
      ? { borderColor: '#dc2626', backgroundColor: '#fef2f2', color: '#b91c1c' }
      : { borderColor: '#f59e0b', backgroundColor: '#fffbeb', color: '#92400e' }
    return { ...styles.rankInfo, ...color }
  }

  return styles.rankInfo
}

function formatCountdownMmSs(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

function widthFromText(
  values: string[],
  minWidthCh: number,
  maxWidthCh: number,
  widthScale = 1,
  extraPaddingCh = 2,
): string {
  let maxWidthChValue = minWidthCh

  for (const value of values) {
    maxWidthChValue = Math.max(maxWidthChValue, value.length * widthScale)
  }

  return `${Math.min(maxWidthChValue + extraPaddingCh, maxWidthCh).toString()}ch`
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

type LiveTooltipTarget =
  | {
      kind: 'refresh'
    }
  | {
      kind: 'age'
      itemId: number
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
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [refreshingItemIds, setRefreshingItemIds] = useState<number[]>([])
  const [rediscoveryPendingItemIds, setRediscoveryPendingItemIds] = useState<
    number[]
  >([])
  const [lastAutoRefreshStartMs, setLastAutoRefreshStartMs] = useState<
    number | null
  >(null)
  const [pollResetToken, setPollResetToken] = useState(0)
  const [liveTooltipTarget, setLiveTooltipTarget] =
    useState<LiveTooltipTarget | null>(null)
  const [liveTooltipPosition, setLiveTooltipPosition] = useState<{
    x: number
    y: number
  }>({ x: 0, y: 0 })
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
  const listingQuantityColumnWidth = useMemo(
    () =>
      widthFromText(
        [
          'Quantity',
          ...itemStates.flatMap((state) =>
            state.ownedListings.map((listing) =>
              formatQuantity(listing.quantity),
            ),
          ),
        ],
        0,
        12,
      ),
    [itemStates],
  )
  const listingPriceColumnWidth = useMemo(
    () =>
      widthFromText(
        [
          'Price',
          ...itemStates.flatMap((state) =>
            state.ownedListings.map(
              (listing) =>
                `${listing.sellingPrice.toLocaleString()} ${GIL_SYMBOL}`,
            ),
          ),
        ],
        0,
        16,
      ),
    [itemStates],
  )
  const listingRetainerColumnWidth = useMemo(() => {
    const retainerTexts = ['Retainer']

    for (const state of itemStates) {
      for (const listing of state.ownedListings) {
        const marketCity =
          listing.retainerCity === undefined
            ? undefined
            : RETAINER_CITY_BY_ID[listing.retainerCity]
        const taxRate =
          marketCity === undefined ? undefined : taxRatesByCity[marketCity.name]
        const isHigherTaxThanLowest =
          typeof taxRate === 'number' &&
          lowestTaxRate !== null &&
          taxRate > lowestTaxRate

        retainerTexts.push(
          `${listing.retainerName}${isHigherTaxThanLowest ? ' Tax High' : ''}`,
        )
      }
    }

    return widthFromText(retainerTexts, 0, 24)
  }, [itemStates, lowestTaxRate, taxRatesByCity])
  const competitorQuantityColumnWidth = useMemo(
    () =>
      widthFromText(
        [
          'Quantity',
          ...itemStates.flatMap((state) =>
            state.competitorListings.map((competitor) =>
              formatQuantity(competitor.quantity),
            ),
          ),
        ],
        0,
        12,
      ),
    [itemStates],
  )
  const competitorPriceColumnWidth = useMemo(
    () =>
      widthFromText(
        [
          'Price',
          ...itemStates.flatMap((state) =>
            state.competitorListings.map(
              (competitor) =>
                `${competitor.sellingPrice.toLocaleString()} ${GIL_SYMBOL}`,
            ),
          ),
        ],
        0,
        16,
      ),
    [itemStates],
  )
  const competitorRetainerColumnWidth = useMemo(() => {
    const retainerTexts = ['Retainer']

    for (const state of itemStates) {
      for (const competitor of state.competitorListings) {
        retainerTexts.push(competitor.retainerName)
      }
    }

    return widthFromText(retainerTexts, 0, 20)
  }, [itemStates])

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
  const itemColumnWidth = useMemo(
    () =>
      widthFromText(
        ['Item', ...resolvedItems.items.map((item) => item.name)],
        0,
        48,
        0.84,
        1.5,
      ),
    [resolvedItems.items],
  )
  const itemIds = useMemo(
    () => resolvedItems.items.map((item) => item.id),
    [resolvedItems.items],
  )
  const itemNamesById = useMemo(
    () => new Map(resolvedItems.items.map((item) => [item.id, item.name])),
    [resolvedItems.items],
  )
  const itemStatesById = useMemo(
    () => new Map(itemStates.map((state) => [state.itemId, state])),
    [itemStates],
  )
  const refreshingItemIdSet = useMemo(
    () => new Set(refreshingItemIds),
    [refreshingItemIds],
  )
  const rediscoveryPendingItemIdSet = useMemo(
    () => new Set(rediscoveryPendingItemIds),
    [rediscoveryPendingItemIds],
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
  const effectiveAutoRefreshAnchorMs =
    lastAutoRefreshStartMs === null ||
    nowMs - lastAutoRefreshStartMs > POLL_INTERVAL_MS
      ? nowMs
      : lastAutoRefreshStartMs
  const nextAutoRefreshAtMs = watchContext.hasInput
    ? effectiveAutoRefreshAnchorMs + POLL_INTERVAL_MS
    : null
  const watchedItemIdsKey = itemIds.join(',')
  const retainerNamesKey = retainerNames.join(',')
  const displaySocketStatus = watchContext.hasInput
    ? socketStatus === 'idle'
      ? 'connecting'
      : socketStatus
    : 'idle'
  const displayRefreshStatus = watchContext.hasInput
    ? refreshStatus
    : 'Add a world and retainers, then discover listings'
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
  const liveTooltipText = useMemo(() => {
    if (liveTooltipTarget === null) {
      return ''
    }

    if (liveTooltipTarget.kind === 'refresh') {
      if (!watchContext.hasInput || nextAutoRefreshAtMs === null) {
        return 'Auto-refresh runs every 5 minutes once a world and items are set.'
      }

      return `Fetch latest market data now.\nAuto-refresh runs every 5 minutes.\nNext auto-refresh in ${formatCountdownMmSs(
        nextAutoRefreshAtMs - nowMs,
      )}.`
    }

    const state = itemStatesById.get(liveTooltipTarget.itemId) ?? null

    if (state?.oldestListingReviewAt == null) {
      return 'Age unknown'
    }

    const ageText = formatAgeTooltip(state.oldestListingReviewAt, nowMs)
    if (!state.hasWorldTimestampDeltaWarning) {
      return ageText
    }

    const warningDelta = formatDuration(state.maxWorldTimestampDeltaMs)
    return `${ageText}\nWarning: listing timestamps differ by up to ${warningDelta} inside at least one world (threshold: 1 minute).`
  }, [
    itemStatesById,
    liveTooltipTarget,
    nextAutoRefreshAtMs,
    nowMs,
    watchContext.hasInput,
  ])

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

  const updateLiveTooltipPosition = (params: {
    clientX: number
    clientY: number
  }): void => {
    setLiveTooltipPosition({
      x: params.clientX + 12,
      y: params.clientY + 12,
    })
  }

  const showLiveTooltip = (
    target: LiveTooltipTarget,
    params: { clientX: number; clientY: number },
  ): void => {
    setLiveTooltipTarget(target)
    updateLiveTooltipPosition(params)
  }

  const hideLiveTooltip = (): void => {
    setLiveTooltipTarget(null)
  }

  const startRefreshingItems = (itemIdsToRefresh: number[]): void => {
    setRefreshingItemIds((current) => {
      const next = new Set(current)
      for (const itemId of itemIdsToRefresh) {
        next.add(itemId)
      }
      return [...next]
    })
  }

  const stopRefreshingItems = (itemIdsToRefresh: number[]): void => {
    setRefreshingItemIds((current) =>
      current.filter((itemId) => !itemIdsToRefresh.includes(itemId)),
    )
  }

  const refreshAllTrackedItems = (): void => {
    if (!watchContext.hasInput || watchContext.itemIds.length === 0) {
      return
    }

    setPollResetToken((current) => current + 1)
    setLastAutoRefreshStartMs(Date.now())

    const refreshingIds = [...watchContext.itemIds]
    startRefreshingItems(refreshingIds)

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
      .finally(() => {
        stopRefreshingItems(refreshingIds)
      })
  }

  const refreshTrackedItem = (itemId: number): void => {
    if (!watchContext.hasInput || !watchContext.itemIds.includes(itemId)) {
      return
    }

    setPollResetToken((current) => current + 1)

    startRefreshingItems([itemId])

    void fetchMarketBoard(watchContext.world, [itemId], {
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

          const nextStateById = new Map(
            currentStates.map((state) => [state.itemId, state]),
          )
          for (const nextState of result.nextStates) {
            nextStateById.set(nextState.itemId, nextState)
          }

          return watchContext.itemIds
            .map((currentItemId) => nextStateById.get(currentItemId))
            .filter((state): state is UndercutItemState => state !== undefined)
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
      .finally(() => {
        stopRefreshingItems([itemId])
      })
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

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
    let refreshStarted = false
    const refreshingIds = [...watchContext.itemIds]
    const startRefreshTimeout = window.setTimeout(() => {
      if (!cancelled) {
        refreshStarted = true
        startRefreshingItems(refreshingIds)
      }
    }, 0)

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
      .finally(() => {
        window.clearTimeout(startRefreshTimeout)
        if (!cancelled) {
          if (refreshStarted) {
            stopRefreshingItems(refreshingIds)
          }
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(startRefreshTimeout)
      if (refreshStarted) {
        stopRefreshingItems(refreshingIds)
      }
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
          const refreshingIds = [...watchContext.itemIds]
          startRefreshingItems(refreshingIds)

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
            .finally(() => {
              stopRefreshingItems(refreshingIds)
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
      setLastAutoRefreshStartMs(Date.now())

      const refreshingIds = [...watchContext.itemIds]
      startRefreshingItems(refreshingIds)

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
        .finally(() => {
          stopRefreshingItems(refreshingIds)
        })
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [
    permission,
    pollResetToken,
    watchContext,
    watchedItemIdsKey,
    retainerNamesKey,
  ])

  return (
    <section aria-labelledby="undercut-tracker-heading" style={styles.section}>
      <style>{`@keyframes undercut-refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
                <span>{retainerName}</span>
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
            setRediscoveryPendingItemIds([...watchContext.itemIds])

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

                  const newlyDiscoveredItemIds = newlyDiscoveredTokens
                    .map((token) => Number(token))
                    .filter((itemId) => Number.isInteger(itemId))
                  if (newlyDiscoveredItemIds.length > 0) {
                    setRediscoveryPendingItemIds((current) =>
                      current.filter(
                        (itemId) => !newlyDiscoveredItemIds.includes(itemId),
                      ),
                    )
                  }

                  setConfig((current) => ({
                    ...current,
                    itemInput: appendUniqueTokens(current.itemInput, [
                      ...discoveredTokens,
                    ]),
                  }))
                }

                setDiscoverStatus(
                  `Checked ${checkedMarketableItems.toString()} of ${totalMarketableItems.toString()} marketable items. Discovered ${discoveredTokens.size.toString()} item(s) so far.`,
                )
              }

              setConfig((current) => ({
                ...current,
                itemInput: [...discoveredTokens].join('\n'),
              }))

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
            } finally {
              setRediscoveryPendingItemIds([])
            }
          })()
        }}
      >
        Discover my listings
      </button>
      {discoverStatus !== null ? (
        <p aria-live="polite">{discoverStatus}</p>
      ) : null}

      {resolvedItems.unresolvedTokens.length > 0 ? (
        <p role="alert">{`Could not resolve: ${resolvedItems.unresolvedTokens.join(', ')}`}</p>
      ) : null}

      <div style={{ width: 'fit-content', maxWidth: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '0.5rem',
          }}
        >
          <button
            type="button"
            disabled={
              !watchContext.hasInput ||
              watchContext.itemIds.length === 0 ||
              watchContext.itemIds.every((itemId) =>
                refreshingItemIdSet.has(itemId),
              )
            }
            onClick={() => {
              refreshAllTrackedItems()
            }}
            onMouseEnter={(event) => {
              showLiveTooltip(
                {
                  kind: 'refresh',
                },
                event,
              )
            }}
            onMouseMove={(event) => {
              updateLiveTooltipPosition(event)
            }}
            onMouseLeave={() => {
              hideLiveTooltip()
            }}
            style={{
              ...styles.refreshButton,
            }}
            aria-label="Refresh all tracked items"
          >
            <span>Refresh Listings</span>
            <span
              aria-hidden="true"
              style={{
                ...styles.refreshGlyph,
                animation:
                  itemStates.length > 0 &&
                  itemStates.every((state) =>
                    refreshingItemIdSet.has(state.itemId),
                  )
                    ? 'undercut-refresh-spin 0.9s linear infinite'
                    : undefined,
              }}
            >
              {'↻'}
            </span>
          </button>
        </div>

        <div style={styles.tableWrap}>
          {visibleItemRows.length === 0 ? (
            <article style={styles.card}>
              <p style={{ margin: 0 }}>
                Add a world and retainers, then discover listings to start
                tracking.
              </p>
            </article>
          ) : (
            <table style={styles.table}>
              <colgroup>
                {/* ponytail: outer competitor cols must stay proportional to competitor subtable colgroup widths below */}
                <col style={{ width: '2.5rem' }} />
                <col style={{ width: itemColumnWidth }} />
                <col style={{ width: '4rem' }} />
                <col style={{ width: listingQuantityColumnWidth }} />
                <col style={{ width: listingPriceColumnWidth }} />
                <col style={{ width: listingRetainerColumnWidth }} />
                <col style={{ width: '2.5rem' }} />
                <col style={{ width: '4rem' }} />
                <col style={{ width: competitorQuantityColumnWidth }} />
                <col style={{ width: competitorPriceColumnWidth }} />
                <col style={{ width: competitorRetainerColumnWidth }} />
                <col style={{ width: '4rem' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.tableCellCenter} rowSpan={2} />
                  <th style={styles.tableCellCenter} rowSpan={2}>
                    Item
                  </th>
                  <th
                    style={{
                      ...styles.tableCellCenter,
                      ...SUBTABLE_LEFT_DIVIDER,
                      ...SUBTABLE_RIGHT_DIVIDER,
                    }}
                    colSpan={4}
                  >
                    Your Listings
                  </th>
                  <th
                    style={{
                      ...styles.tableCellCenter,
                      ...SUBTABLE_LEFT_DIVIDER,
                      ...SUBTABLE_RIGHT_DIVIDER,
                    }}
                    colSpan={5}
                  >
                    Competitor Listings
                  </th>
                  <th
                    style={styles.tableCellCenter}
                    rowSpan={2}
                    colSpan={1}
                    title={
                      'Universalis data may be out of date.\nVisit universalis.app/contribute to help update market data.'
                    }
                  >
                    <span
                      style={{
                        textDecoration: 'underline dotted',
                        textDecorationColor: '#cbd5e1',
                        textUnderlineOffset: '0.2rem',
                        cursor: 'help',
                      }}
                    >
                      Last Updated
                    </span>
                  </th>
                </tr>
                <tr>
                  <th
                    style={{
                      ...styles.tableCellCenter,
                      ...SUBTABLE_LEFT_DIVIDER,
                    }}
                  >
                    HQ
                  </th>
                  <th style={styles.tableCellCenter}>Quantity</th>
                  <th style={styles.tableCellCenter}>Price</th>
                  <th
                    style={{
                      ...styles.tableCellCenter,
                      ...SUBTABLE_RIGHT_DIVIDER,
                    }}
                  >
                    Retainer
                  </th>
                  <th
                    style={{
                      ...styles.tableCellCenter,
                      ...SUBTABLE_LEFT_DIVIDER,
                    }}
                    aria-label="Competitor details"
                  />
                  <th
                    style={{
                      ...styles.tableCellCenter,
                    }}
                  >
                    HQ
                  </th>
                  <th style={styles.tableCellCenter}>Quantity</th>
                  <th style={styles.tableCellCenter}>Price</th>
                  <th
                    style={{
                      ...styles.tableCellCenter,
                      ...SUBTABLE_RIGHT_DIVIDER,
                    }}
                  >
                    Retainer
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleItemRows.map(({ item, state }, itemIndex) => {
                  const iconId = String(item.iconId).padStart(6, '0')
                  const iconUrl = `https://v2.xivapi.com/api/asset?path=ui/icon/${iconId.slice(0, 3)}000/${iconId}.tex&format=png`
                  const isRefreshing = refreshingItemIdSet.has(item.id)
                  const isPendingRediscovery = rediscoveryPendingItemIdSet.has(
                    item.id,
                  )
                  const isRowLoading =
                    state === null || isRefreshing || isPendingRediscovery
                  const listingRows = isRowLoading ? [] : state.ownedListings
                  const competitorRows = isRowLoading
                    ? []
                    : state.competitorListings
                  const allCompetitorsOneRespect = isRowLoading
                    ? false
                    : state.allCompetitorsOneRespect
                  const BASE_SUBTABLE_PADDING_REM = 0.15
                  const MAX_SUBTABLE_PADDING_REM = 0.45
                  const listingRowPadding = `${Math.min(
                    BASE_SUBTABLE_PADDING_REM,
                    MAX_SUBTABLE_PADDING_REM,
                  ).toString()}rem`
                  const competitorRowPadding = `${Math.min(
                    BASE_SUBTABLE_PADDING_REM,
                    MAX_SUBTABLE_PADDING_REM,
                  ).toString()}rem`
                  const renderSkeleton = (
                    width: string,
                    height = '0.9rem',
                  ): ReactNode => (
                    <span
                      aria-hidden="true"
                      style={{
                        ...styles.skeletonBar,
                        width,
                        height,
                      }}
                    />
                  )

                  return (
                    <tr
                      key={item.id.toString()}
                      aria-busy={isRowLoading}
                      style={{
                        backgroundColor:
                          itemIndex % 2 === 0 ? '#fff' : '#f1f5f9',
                      }}
                    >
                      {/* Column: Item Icon */}
                      <td style={{ ...styles.tableCell, ...styles.iconCell }}>
                        <img
                          src={iconUrl}
                          alt={`${item.name} icon`}
                          width={24}
                          height={24}
                          style={styles.icon}
                        />
                      </td>
                      {/* Column: Item Name */}
                      <td style={{ ...styles.tableCell, whiteSpace: 'nowrap' }}>
                        <a href={`${itemBasePath}${item.id.toString()}`}>
                          {item.name}
                        </a>
                        {isRowLoading ? (
                          <span style={styles.visuallyHidden}>
                            Loading row data
                          </span>
                        ) : null}
                      </td>
                      {/* Column Group: Your Listings (Subtable Container) */}
                      <td
                        colSpan={4}
                        style={{
                          ...styles.tableCell,
                          ...SUBTABLE_LEFT_DIVIDER,
                          ...SUBTABLE_RIGHT_DIVIDER,
                          padding: 0,
                        }}
                      >
                        <table
                          style={{
                            width: 'max-content',
                            borderCollapse: 'collapse',
                          }}
                        >
                          <colgroup>
                            <col style={{ width: '4rem' }} />
                            <col
                              style={{ width: listingQuantityColumnWidth }}
                            />
                            <col style={{ width: listingPriceColumnWidth }} />
                            <col
                              style={{ width: listingRetainerColumnWidth }}
                            />
                          </colgroup>
                          <tbody>
                            {listingRows.length === 0 && !isRowLoading ? (
                              <tr>
                                {/* Column: Your Listings Empty State */}
                                <td
                                  colSpan={4}
                                  style={{
                                    ...styles.tableCellCenter,
                                    padding: '0.25rem',
                                    borderBottom: 'none',
                                  }}
                                >
                                  <span
                                    style={{
                                      color: '#64748b',
                                      textDecoration: 'underline dotted',
                                      textDecorationColor: '#cbd5e1',
                                      textUnderlineOffset: '0.2rem',
                                      cursor: 'help',
                                    }}
                                    title="Universalis data may be out of date. Visit universalis.app/contribute to help update market data."
                                  >
                                    No listings found for your retainers
                                  </span>
                                </td>
                              </tr>
                            ) : (
                              (listingRows.length === 0
                                ? [null]
                                : listingRows
                              ).map((listing, listingIndex, source) => {
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
                                const hasDivider =
                                  listingIndex < source.length - 1

                                return (
                                  <tr
                                    key={
                                      listing?.listingId ??
                                      `owned-${item.id.toString()}-${listingIndex.toString()}`
                                    }
                                  >
                                    {/* Column: Your Listing HQ */}
                                    <td
                                      style={{
                                        ...styles.tableCellCenter,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: listingRowPadding,
                                        paddingBottom: listingRowPadding,
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
                                        {listing === null && isRowLoading
                                          ? renderSkeleton('0.95rem')
                                          : formatQuality(
                                              listing?.quality ?? null,
                                            )}
                                      </span>
                                    </td>
                                    {/* Column: Your Listing Quantity */}
                                    <td
                                      style={{
                                        ...styles.tableCellRight,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: listingRowPadding,
                                        paddingBottom: listingRowPadding,
                                      }}
                                    >
                                      {listing === null
                                        ? isRowLoading
                                          ? renderSkeleton('2.4rem')
                                          : ''
                                        : formatQuantity(listing.quantity)}
                                    </td>
                                    {/* Column: Your Listing Price */}
                                    <td
                                      style={{
                                        ...styles.tableCellRight,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: listingRowPadding,
                                        paddingBottom: listingRowPadding,
                                      }}
                                    >
                                      {listing === null
                                        ? isRowLoading
                                          ? renderSkeleton('5.4rem')
                                          : ''
                                        : formatGil(listing.sellingPrice)}
                                    </td>
                                    {/* Column: Your Listing Retainer */}
                                    <td
                                      style={{
                                        ...styles.tableCell,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: listingRowPadding,
                                        paddingBottom: listingRowPadding,
                                      }}
                                    >
                                      {listing === null ? (
                                        isRowLoading ? (
                                          renderSkeleton('5rem')
                                        ) : (
                                          ''
                                        )
                                      ) : (
                                        <span style={styles.retainerCell}>
                                          {marketCity === undefined ? null : (
                                            <img
                                              src={toXivIconUrl(
                                                marketCity.iconId,
                                              )}
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
                                          <span>{listing.retainerName}</span>
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
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </td>
                      {/* Column Group: Competitor Listings (Subtable Container) */}
                      <td
                        colSpan={5}
                        style={{
                          ...styles.tableCell,
                          ...SUBTABLE_LEFT_DIVIDER,
                          ...SUBTABLE_RIGHT_DIVIDER,
                          padding: 0,
                        }}
                      >
                        <table
                          style={{
                            width: 'max-content',
                            borderCollapse: 'collapse',
                          }}
                        >
                          <colgroup>
                            <col style={{ width: '2.5rem' }} />
                            <col style={{ width: '4rem' }} />
                            <col
                              style={{ width: competitorQuantityColumnWidth }}
                            />
                            <col
                              style={{ width: competitorPriceColumnWidth }}
                            />
                            <col
                              style={{ width: competitorRetainerColumnWidth }}
                            />
                          </colgroup>
                          <tbody>
                            {competitorRows.length === 0 && !isRowLoading ? (
                              <tr>
                                {/* Column: Competitor Listings Empty State */}
                                <td
                                  colSpan={5}
                                  style={{
                                    ...styles.tableCellCenter,
                                    padding: '0.25rem',
                                    borderBottom: 'none',
                                    color: '#64748b',
                                  }}
                                >
                                  No competition on {selectedWorld}
                                </td>
                              </tr>
                            ) : (
                              (competitorRows.length === 0
                                ? [null]
                                : competitorRows
                              ).map((competitor, competitorIndex, source) => {
                                const competitorCity =
                                  competitor?.retainerCity !== undefined
                                    ? RETAINER_CITY_BY_ID[
                                        competitor.retainerCity
                                      ]
                                    : undefined
                                const hasDivider =
                                  competitorIndex < source.length - 1

                                return (
                                  <tr
                                    key={
                                      competitor?.listingId ??
                                      `competitor-${item.id.toString()}-${competitorIndex.toString()}`
                                    }
                                  >
                                    {/* Column: Competitor Details */}
                                    <td
                                      style={{
                                        ...styles.tableCellCenter,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: competitorRowPadding,
                                        paddingBottom: competitorRowPadding,
                                      }}
                                    >
                                      {competitor === null
                                        ? isRowLoading
                                          ? renderSkeleton('1.35rem', '1.35rem')
                                          : ''
                                        : (() => {
                                            const beatsByPrice =
                                              competitor.beatsByPrice
                                            const beatsByComparableTotal =
                                              competitor.beatsByComparableTotal
                                            const competitivenessSummary =
                                              (() => {
                                                if (
                                                  beatsByPrice &&
                                                  beatsByComparableTotal
                                                ) {
                                                  return '\u2757 More competitive in all respects'
                                                }
                                                if (
                                                  beatsByPrice ||
                                                  beatsByComparableTotal
                                                ) {
                                                  return '\u26A0\uFE0F More competitive in one respect'
                                                }

                                                return ''
                                              })()
                                            const reasonsSummary =
                                              competitor.reasons.join(' | ')
                                            const titleText =
                                              competitivenessSummary.length > 0
                                                ? `${competitivenessSummary}\n${reasonsSummary}`
                                                : reasonsSummary
                                            const ariaSummary =
                                              competitivenessSummary.length > 0
                                                ? `${competitivenessSummary}. `
                                                : ''

                                            return (
                                              <button
                                                type="button"
                                                style={competitorInfoStyle({
                                                  beatsByPrice,
                                                  beatsByComparableTotal,
                                                  allOneRespect:
                                                    allCompetitorsOneRespect,
                                                })}
                                                title={titleText}
                                                aria-label={`Competitor details: ${ariaSummary}${competitor.reasons.join(', ')}`}
                                              >
                                                i
                                              </button>
                                            )
                                          })()}
                                    </td>
                                    {/* Column: Competitor HQ */}
                                    <td
                                      style={{
                                        ...styles.tableCellCenter,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: competitorRowPadding,
                                        paddingBottom: competitorRowPadding,
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
                                        {competitor === null && isRowLoading
                                          ? renderSkeleton('0.95rem')
                                          : formatQuality(
                                              competitor?.quality ?? null,
                                            )}
                                      </span>
                                    </td>
                                    {/* Column: Competitor Quantity */}
                                    <td
                                      style={{
                                        ...styles.tableCellRight,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: competitorRowPadding,
                                        paddingBottom: competitorRowPadding,
                                      }}
                                    >
                                      {competitor === null
                                        ? isRowLoading
                                          ? renderSkeleton('2.4rem')
                                          : ''
                                        : formatQuantity(competitor.quantity)}
                                    </td>
                                    {/* Column: Competitor Price */}
                                    <td
                                      style={{
                                        ...styles.tableCellRight,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: competitorRowPadding,
                                        paddingBottom: competitorRowPadding,
                                      }}
                                    >
                                      {competitor === null
                                        ? isRowLoading
                                          ? renderSkeleton('5.4rem')
                                          : ''
                                        : formatGil(competitor.sellingPrice)}
                                    </td>
                                    {/* Column: Competitor Retainer */}
                                    <td
                                      style={{
                                        ...styles.tableCell,
                                        borderBottom: hasDivider
                                          ? '1px solid #e2e8f0'
                                          : 'none',
                                        paddingTop: competitorRowPadding,
                                        paddingBottom: competitorRowPadding,
                                      }}
                                    >
                                      {competitor === null ? (
                                        isRowLoading ? (
                                          renderSkeleton('5rem')
                                        ) : (
                                          ''
                                        )
                                      ) : (
                                        <span style={styles.retainerCell}>
                                          {competitorCity ===
                                          undefined ? null : (
                                            <img
                                              src={toXivIconUrl(
                                                competitorCity.iconId,
                                              )}
                                              alt={`${competitorCity.name} market icon`}
                                              title={competitorCity.name}
                                              width={16}
                                              height={16}
                                              style={styles.marketIcon}
                                            />
                                          )}
                                          <span>{competitor.retainerName}</span>
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </td>
                      {/* Column: Last Updated */}
                      <td style={styles.tableCellCenter}>
                        {isRowLoading
                          ? renderSkeleton('2.5rem', '1.35rem')
                          : (() => {
                              const oldestListingReviewAt =
                                state.oldestListingReviewAt
                              const ageMs =
                                oldestListingReviewAt === null
                                  ? null
                                  : Math.max(0, nowMs - oldestListingReviewAt)
                              const ageText =
                                oldestListingReviewAt === null
                                  ? 'Age unknown'
                                  : formatAgeTooltip(
                                      oldestListingReviewAt,
                                      nowMs,
                                    )
                              const hasTimestampWarning =
                                state.hasWorldTimestampDeltaWarning
                              const warningDelta = formatDuration(
                                state.maxWorldTimestampDeltaMs,
                              )
                              const warningText = hasTimestampWarning
                                ? `Warning: listing timestamps differ by up to ${warningDelta} inside at least one world (threshold: 1 minute).`
                                : ''

                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    refreshTrackedItem(item.id)
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.3rem',
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    color: 'inherit',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(event) => {
                                    showLiveTooltip(
                                      {
                                        kind: 'age',
                                        itemId: item.id,
                                      },
                                      event,
                                    )
                                  }}
                                  onMouseMove={(event) => {
                                    updateLiveTooltipPosition(event)
                                  }}
                                  onMouseLeave={() => {
                                    hideLiveTooltip()
                                  }}
                                  aria-label={`Refresh ${item.name} listing data`}
                                >
                                  <span
                                    role="img"
                                    aria-label={`Listing age: ${ageText}`}
                                    style={ageBadgeStyle(ageMs)}
                                  >
                                    {'\u23F1'}
                                  </span>
                                  {hasTimestampWarning ? (
                                    <span
                                      role="img"
                                      aria-label={warningText}
                                      style={styles.ageWarningIcon}
                                    >
                                      {'\u26A0'}
                                    </span>
                                  ) : null}
                                </button>
                              )
                            })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {liveTooltipTarget !== null && liveTooltipText.length > 0 ? (
        <div
          role="tooltip"
          style={{
            ...styles.liveTooltip,
            left: `${liveTooltipPosition.x.toString()}px`,
            top: `${liveTooltipPosition.y.toString()}px`,
          }}
        >
          {liveTooltipText}
        </div>
      ) : null}

      <p>
        Notifications: {permission}. The tracker only alerts on a transition
        from a non-Undercut tier to Undercut.
      </p>
    </section>
  )
}

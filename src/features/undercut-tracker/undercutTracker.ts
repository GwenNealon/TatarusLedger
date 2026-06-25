import type { MarketData } from '../../api/types.ts'
import type { NormalizedItem } from '../../data/types.ts'

export type ListingStatusTier =
  | 'DC Best'
  | 'World Best'
  | 'Competitive'
  | 'Undercut'

export type CompetitivenessSummary = 'all-respects' | 'one-respect' | 'none'

export interface UndercutItemState {
  itemId: number
  itemName: string
  listingCount: number
  ownedListings: {
    listingId?: string
    quality: 'HQ' | 'NQ'
    quantity: number
    sellingPrice: number
    totalCost: number
    retainerName: string
    retainerCity?: number
    lastReviewAt: number
  }[]
  competitorListings: {
    listingId?: string
    quality: 'HQ' | 'NQ'
    quantity: number
    sellingPrice: number
    totalCost: number
    retainerName: string
    retainerCity?: number
    lastReviewAt: number
    beatsByPrice: boolean
    beatsByComparableTotal: boolean
    competitivenessSummary: CompetitivenessSummary
    reasons: string[]
  }[]
  allCompetitorsOneRespect: boolean
  ownedQuantity: number
  ownedQuality: 'HQ' | 'NQ' | 'Mixed' | null
  lowestOwnedPrice: number | null
  lowestCompetitorPrice: number | null
  listingStatusTier: ListingStatusTier
  undercut: boolean
  oldestListingReviewAt: number | null
  maxWorldTimestampDeltaMs: number
  hasWorldTimestampDeltaWarning: boolean
  lastSyncedAt: number
}

export function parseWatchTokens(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

export function normalizeRetainerNames(input: string): string[] {
  return parseWatchTokens(input).map((name) => name.toLowerCase())
}

export function resolveWatchItems(
  items: NormalizedItem[],
  tokens: string[],
): { items: NormalizedItem[]; unresolvedTokens: string[] } {
  const resolved: NormalizedItem[] = []
  const unresolvedTokens: string[] = []
  const seen = new Set<number>()

  for (const token of tokens) {
    const parsedId = Number.parseInt(token, 10)
    const byId = Number.isSafeInteger(parsedId)
      ? items.find((item) => item.id === parsedId)
      : undefined
    const lowered = token.toLowerCase()
    const byName =
      byId ??
      items.find((item) => item.name.toLowerCase() === lowered) ??
      items.find((item) => item.name.toLowerCase().includes(lowered))

    if (byName === undefined) {
      unresolvedTokens.push(token)
      continue
    }

    if (seen.has(byName.id)) {
      continue
    }

    seen.add(byName.id)
    resolved.push(byName)
  }

  return { items: resolved, unresolvedTokens }
}

export function buildSubscriptionChannel(
  event: 'listings/add' | 'listings/remove' | 'sales/add',
  world: string,
  itemId: number,
): string {
  return `${event}{world=${world},item=${itemId.toString()}}`
}

export function appendUniqueTokens(existing: string, tokens: string[]): string {
  const nextTokens = new Set(parseWatchTokens(existing))

  for (const token of tokens) {
    nextTokens.add(token)
  }

  return [...nextTokens].join('\n')
}

function summarizeCompetitiveness(params: {
  beatsByPrice: boolean
  beatsByComparableTotal: boolean
}): CompetitivenessSummary {
  const { beatsByPrice, beatsByComparableTotal } = params
  if (beatsByPrice && beatsByComparableTotal) {
    return 'all-respects'
  }

  if (beatsByPrice || beatsByComparableTotal) {
    return 'one-respect'
  }

  return 'none'
}

export function deriveItemState(params: {
  marketData: MarketData
  itemName: string
  retainerNames: string[]
}): UndercutItemState {
  const { marketData, itemName, retainerNames } = params
  const ownedNames = new Set(retainerNames.map((name) => name.toLowerCase()))
  const seenListingKeys = new Set<string>()

  let lowestOwnedPrice: number | null = null
  let lowestCompetitorPrice: number | null = null
  let ownedQuantity = 0
  let hasOwnedHq = false
  let hasOwnedNq = false
  const ownedListings: UndercutItemState['ownedListings'] = []
  const ownedMarketListings: MarketData['listings'] = []
  const competitorMarketListings: MarketData['listings'] = []

  for (const listing of marketData.listings) {
    if (listing.listingId !== undefined) {
      if (seenListingKeys.has(listing.listingId)) {
        continue
      }
      seenListingKeys.add(listing.listingId)
    }

    const ownerName = listing.retainerName?.toLowerCase()
    const isOwned = ownerName !== undefined && ownedNames.has(ownerName)

    if (isOwned) {
      ownedQuantity += listing.quantity
      if (listing.hq) {
        hasOwnedHq = true
      } else {
        hasOwnedNq = true
      }
      ownedListings.push({
        listingId: listing.listingId,
        quality: listing.hq ? 'HQ' : 'NQ',
        quantity: listing.quantity,
        sellingPrice: listing.pricePerUnit,
        totalCost: listing.total,
        retainerName: listing.retainerName ?? '—',
        retainerCity: listing.retainerCity,
        lastReviewAt: listing.lastReviewTime.getTime(),
      })
      ownedMarketListings.push(listing)
      lowestOwnedPrice =
        lowestOwnedPrice === null
          ? listing.pricePerUnit
          : Math.min(lowestOwnedPrice, listing.pricePerUnit)
      continue
    }

    lowestCompetitorPrice =
      lowestCompetitorPrice === null
        ? listing.pricePerUnit
        : Math.min(lowestCompetitorPrice, listing.pricePerUnit)
    competitorMarketListings.push(listing)
  }

  const highestOwnedQuantity = ownedMarketListings.reduce(
    (highest, listing) => Math.max(highest, listing.quantity),
    0,
  )
  const highestOwnedTotal = ownedMarketListings.reduce(
    (highest, listing) => Math.max(highest, listing.total),
    0,
  )
  const toWorldKey = (
    listing: MarketData['listings'][number],
  ): string | null => {
    if (typeof listing.worldId === 'number') {
      return listing.worldId.toString()
    }

    return typeof listing.worldName === 'string' ? listing.worldName : null
  }
  const ownedWorldKeys = new Set(
    ownedMarketListings
      .map((listing) => toWorldKey(listing))
      .filter((worldKey): worldKey is string => worldKey !== null),
  )
  const competitorsOnOwnedWorlds = competitorMarketListings.filter(
    (listing) => {
      const worldKey = toWorldKey(listing)
      return worldKey !== null && ownedWorldKeys.has(worldKey)
    },
  )

  const candidateByKey = new Map<
    string,
    UndercutItemState['competitorListings'][number]
  >()
  const makeKey = (listing: MarketData['listings'][number]): string =>
    listing.listingId ??
    `${listing.retainerName ?? 'unknown'}:${listing.pricePerUnit.toString()}:${listing.quantity.toString()}:${listing.total.toString()}:${listing.worldId?.toString() ?? 'unknown'}`
  const toCandidate = (
    listing: MarketData['listings'][number],
    reason: string,
  ): void => {
    const key = makeKey(listing)
    const existing = candidateByKey.get(key)
    if (existing !== undefined) {
      if (!existing.reasons.includes(reason)) {
        existing.reasons.push(reason)
      }

      return
    }

    const beatsByPrice = ownedMarketListings.some(
      (ownedListing) => listing.pricePerUnit < ownedListing.pricePerUnit,
    )
    const beatsByComparableTotal = ownedMarketListings.some(
      (ownedListing) =>
        listing.quantity >= ownedListing.quantity &&
        listing.total < ownedListing.total,
    )

    candidateByKey.set(key, {
      listingId: listing.listingId,
      quality: listing.hq ? 'HQ' : 'NQ',
      quantity: listing.quantity,
      sellingPrice: listing.pricePerUnit,
      totalCost: listing.total,
      retainerName: listing.retainerName ?? '—',
      retainerCity: listing.retainerCity,
      lastReviewAt: listing.lastReviewTime.getTime(),
      beatsByPrice,
      beatsByComparableTotal,
      competitivenessSummary: summarizeCompetitiveness({
        beatsByPrice,
        beatsByComparableTotal,
      }),
      reasons: [reason],
    })
  }
  const byPrice = (
    left: MarketData['listings'][number],
    right: MarketData['listings'][number],
  ): number =>
    left.pricePerUnit - right.pricePerUnit ||
    right.lastReviewTime.getTime() - left.lastReviewTime.getTime()
  const byTotal = (
    left: MarketData['listings'][number],
    right: MarketData['listings'][number],
  ): number =>
    left.total - right.total ||
    left.pricePerUnit - right.pricePerUnit ||
    right.lastReviewTime.getTime() - left.lastReviewTime.getTime()
  const pick = (
    listings: MarketData['listings'],
    compare: (
      left: MarketData['listings'][number],
      right: MarketData['listings'][number],
    ) => number,
  ): MarketData['listings'][number] | undefined =>
    [...listings].sort(compare)[0]

  const lowestHq = pick(
    competitorMarketListings.filter((listing) => listing.hq),
    byPrice,
  )
  if (lowestHq !== undefined) {
    toCandidate(lowestHq, 'Lowest HQ')
  }

  const lowestPrice = pick(competitorMarketListings, byPrice)
  if (lowestPrice !== undefined) {
    toCandidate(lowestPrice, 'Lowest price')
  }

  if (highestOwnedQuantity > 0) {
    const lowestSmallerStack = pick(
      competitorMarketListings.filter(
        (listing) => listing.quantity < highestOwnedQuantity,
      ),
      byPrice,
    )
    if (lowestSmallerStack !== undefined) {
      toCandidate(lowestSmallerStack, 'Lowest smaller stack')
    }

    const lowestHqSmallerStack = pick(
      competitorMarketListings.filter(
        (listing) => listing.hq && listing.quantity < highestOwnedQuantity,
      ),
      byPrice,
    )
    if (lowestHqSmallerStack !== undefined) {
      toCandidate(lowestHqSmallerStack, 'Lowest HQ smaller stack')
    }
  }

  if (highestOwnedQuantity > 1 && highestOwnedTotal > 0) {
    const cheapestLowerTotal = pick(
      competitorMarketListings.filter(
        (listing) => listing.total < highestOwnedTotal,
      ),
      byTotal,
    )
    if (cheapestLowerTotal !== undefined) {
      toCandidate(cheapestLowerTotal, 'Cheaper total than your highest stack')
    }
  }

  const reasonWeight: Record<string, number> = {
    'Lowest price': 6,
    'Lowest HQ': 5,
    'Lowest smaller stack': 4,
    'Lowest HQ smaller stack': 3,
    'Cheaper total than your highest stack': 3,
  }
  const competitorListings = [...candidateByKey.values()].sort(
    (left, right) => {
      const leftScore = left.reasons.reduce(
        (score, reason) => score + (reasonWeight[reason] ?? 0),
        0,
      )
      const rightScore = right.reasons.reduce(
        (score, reason) => score + (reasonWeight[reason] ?? 0),
        0,
      )

      return (
        rightScore - leftScore ||
        left.sellingPrice - right.sellingPrice ||
        right.lastReviewAt - left.lastReviewAt
      )
    },
  )
  const allCompetitorsOneRespect =
    competitorListings.length > 0 &&
    competitorListings.every(
      (competitor) => competitor.competitivenessSummary === 'one-respect',
    )

  let oldestListingReviewAt: number | null = null
  const worldTimestampBounds = new Map<string, { min: number; max: number }>()

  for (const listing of marketData.listings) {
    const reviewedAt = listing.lastReviewTime.getTime()
    oldestListingReviewAt =
      oldestListingReviewAt === null
        ? reviewedAt
        : Math.min(oldestListingReviewAt, reviewedAt)

    const worldKey =
      listing.worldId?.toString() ?? listing.worldName ?? 'unknown-world'
    const existingBounds = worldTimestampBounds.get(worldKey)
    if (existingBounds === undefined) {
      worldTimestampBounds.set(worldKey, { min: reviewedAt, max: reviewedAt })
      continue
    }

    existingBounds.min = Math.min(existingBounds.min, reviewedAt)
    existingBounds.max = Math.max(existingBounds.max, reviewedAt)
  }

  const maxWorldTimestampDeltaMs = [...worldTimestampBounds.values()].reduce(
    (maxDelta, bounds) => Math.max(maxDelta, bounds.max - bounds.min),
    0,
  )
  const hasWorldTimestampDeltaWarning = maxWorldTimestampDeltaMs > 60_000
  const scopedCompetitorListings =
    ownedWorldKeys.size > 0
      ? competitorsOnOwnedWorlds
      : competitorMarketListings
  const lowestComparableCompetitorTotal = pick(
    competitorMarketListings.filter(
      (listing) => listing.quantity >= highestOwnedQuantity,
    ),
    byTotal,
  )?.total
  const lowestComparableScopedCompetitorTotal = pick(
    scopedCompetitorListings.filter(
      (listing) => listing.quantity >= highestOwnedQuantity,
    ),
    byTotal,
  )?.total
  const lowestComparableWorldCompetitorTotal = pick(
    competitorsOnOwnedWorlds.filter(
      (listing) => listing.quantity >= highestOwnedQuantity,
    ),
    byTotal,
  )?.total
  const lowestScopedCompetitorPrice = pick(
    scopedCompetitorListings,
    byPrice,
  )?.pricePerUnit
  const lowestWorldCompetitorPrice = pick(
    competitorsOnOwnedWorlds,
    byPrice,
  )?.pricePerUnit
  const scopedBestByPrice =
    lowestOwnedPrice !== null &&
    (lowestScopedCompetitorPrice === undefined ||
      lowestOwnedPrice <= lowestScopedCompetitorPrice)
  const scopedBestByComparableTotal =
    highestOwnedQuantity <= 0 ||
    highestOwnedTotal <= 0 ||
    lowestComparableScopedCompetitorTotal === undefined ||
    highestOwnedTotal <= lowestComparableScopedCompetitorTotal
  const undercut = !scopedBestByPrice && !scopedBestByComparableTotal
  const dcBestByPrice =
    lowestOwnedPrice !== null &&
    (lowestCompetitorPrice === null ||
      lowestOwnedPrice <= lowestCompetitorPrice)
  const dcBestByComparableTotal =
    highestOwnedQuantity <= 0 ||
    highestOwnedTotal <= 0 ||
    lowestComparableCompetitorTotal === undefined ||
    highestOwnedTotal <= lowestComparableCompetitorTotal
  const isDcBest = !undercut && dcBestByPrice && dcBestByComparableTotal
  const worldBestByPrice =
    lowestOwnedPrice !== null &&
    (lowestWorldCompetitorPrice === undefined ||
      lowestOwnedPrice <= lowestWorldCompetitorPrice)
  const worldBestByComparableTotal =
    highestOwnedQuantity <= 0 ||
    highestOwnedTotal <= 0 ||
    lowestComparableWorldCompetitorTotal === undefined ||
    highestOwnedTotal <= lowestComparableWorldCompetitorTotal
  const isWorldBest =
    !undercut &&
    !isDcBest &&
    ownedWorldKeys.size > 0 &&
    worldBestByPrice &&
    worldBestByComparableTotal
  const listingStatusTier: ListingStatusTier = undercut
    ? 'Undercut'
    : isDcBest
      ? 'DC Best'
      : isWorldBest
        ? 'World Best'
        : 'Competitive'

  return {
    itemId: marketData.itemId,
    itemName,
    listingCount: marketData.listings.length,
    ownedListings,
    competitorListings,
    allCompetitorsOneRespect,
    ownedQuantity,
    ownedQuality:
      hasOwnedHq && hasOwnedNq
        ? 'Mixed'
        : hasOwnedHq
          ? 'HQ'
          : hasOwnedNq
            ? 'NQ'
            : null,
    lowestOwnedPrice,
    lowestCompetitorPrice,
    listingStatusTier,
    undercut,
    oldestListingReviewAt,
    maxWorldTimestampDeltaMs,
    hasWorldTimestampDeltaWarning,
    lastSyncedAt: Date.now(),
  }
}

export function discoverOwnedItemTokens(params: {
  marketData: MarketData[]
  retainerNames: string[]
}): string[] {
  const { marketData, retainerNames } = params
  const ownedNames = new Set(retainerNames.map((name) => name.toLowerCase()))

  return marketData.flatMap((data) =>
    data.listings.some((listing) => {
      const ownerName = listing.retainerName?.toLowerCase()
      return ownerName !== undefined && ownedNames.has(ownerName)
    })
      ? [data.itemId.toString()]
      : [],
  )
}

import type { MarketData } from '../../api/types.ts'
import type { NormalizedItem } from '../../data/types.ts'

export type ListingStatusTier =
  | 'DC Best'
  | 'World Best'
  | 'Competitive'
  | 'Undercut'

export type CompetitiveNiche =
  | 'Lowest price per unit overall'
  | 'Lowest price per unit HQ'
  | 'Lowest total price for quantity'
  | 'Lowest total price for HQ quantity'

const NICHE_ORDER: CompetitiveNiche[] = [
  'Lowest price per unit overall',
  'Lowest price per unit HQ',
  'Lowest total price for quantity',
  'Lowest total price for HQ quantity',
]

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
    niches: CompetitiveNiche[]
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
    niches: CompetitiveNiche[]
  }[]
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

export function deriveItemState(params: {
  marketData: MarketData
  itemName: string
  retainerNames: string[]
}): UndercutItemState {
  const { marketData, itemName, retainerNames } = params
  const ownedNames = new Set(retainerNames.map((name) => name.toLowerCase()))
  const seenListingKeys = new Set<string>()
  const listingDedupeKey = (listing: MarketData['listings'][number]): string =>
    listing.listingId ??
    [
      listing.worldId?.toString() ?? listing.worldName ?? 'unknown-world',
      listing.retainerName ?? 'unknown-retainer',
      listing.retainerCity?.toString() ?? 'unknown-city',
      listing.hq ? 'hq' : 'nq',
      listing.quantity.toString(),
      listing.pricePerUnit.toString(),
      listing.total.toString(),
    ].join('|')

  let lowestOwnedPrice: number | null = null
  let lowestCompetitorPrice: number | null = null
  let ownedQuantity = 0
  let hasOwnedHq = false
  let hasOwnedNq = false
  const ownedMarketListings: MarketData['listings'] = []
  const competitorMarketListings: MarketData['listings'] = []
  const allMarketListings: MarketData['listings'] = []

  for (const listing of marketData.listings) {
    const dedupeKey = listingDedupeKey(listing)
    if (seenListingKeys.has(dedupeKey)) {
      continue
    }
    seenListingKeys.add(dedupeKey)

    const ownerName = listing.retainerName?.toLowerCase()
    const isOwned = ownerName !== undefined && ownedNames.has(ownerName)
    allMarketListings.push(listing)

    if (isOwned) {
      ownedQuantity += listing.quantity
      if (listing.hq) {
        hasOwnedHq = true
      } else {
        hasOwnedNq = true
      }
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

  const lowestPricePerUnitOverall = pick(
    allMarketListings,
    byPrice,
  )?.pricePerUnit
  const lowestPricePerUnitHq = pick(
    allMarketListings.filter((listing) => listing.hq),
    byPrice,
  )?.pricePerUnit
  const uniqueQuantities = [
    ...new Set(allMarketListings.map((l) => l.quantity)),
  ]
  const lowestTotalByQuantity = new Map<number, number>()
  const lowestHqTotalByQuantity = new Map<number, number>()

  for (const targetQuantity of uniqueQuantities) {
    const lowestTotal = pick(
      allMarketListings.filter((listing) => listing.quantity >= targetQuantity),
      byTotal,
    )?.total
    if (lowestTotal !== undefined) {
      lowestTotalByQuantity.set(targetQuantity, lowestTotal)
    }

    const lowestHqTotal = pick(
      allMarketListings.filter(
        (listing) => listing.hq && listing.quantity >= targetQuantity,
      ),
      byTotal,
    )?.total
    if (lowestHqTotal !== undefined) {
      lowestHqTotalByQuantity.set(targetQuantity, lowestHqTotal)
    }
  }

  const deriveNiches = (
    listing: MarketData['listings'][number],
  ): CompetitiveNiche[] => {
    if (
      lowestPricePerUnitOverall !== undefined &&
      listing.pricePerUnit === lowestPricePerUnitOverall
    ) {
      // ponytail: #1 short-circuits all other categories by request.
      return ['Lowest price per unit overall']
    }

    const niches: CompetitiveNiche[] = []

    if (
      listing.hq &&
      lowestPricePerUnitHq !== undefined &&
      listing.pricePerUnit === lowestPricePerUnitHq
    ) {
      niches.push('Lowest price per unit HQ')
      // ponytail: HQ unit-price winner should not also carry the general quantity-total label.
      return niches
    }

    const lowestTotalForQuantity = lowestTotalByQuantity.get(listing.quantity)
    if (
      lowestTotalForQuantity !== undefined &&
      listing.total === lowestTotalForQuantity
    ) {
      niches.push('Lowest total price for quantity')
    }

    if (
      niches.includes('Lowest price per unit HQ') ||
      niches.includes('Lowest total price for quantity')
    ) {
      // ponytail: #2 or #3 short-circuits #4 by request.
      return niches
    }

    if (listing.hq) {
      const lowestHqTotalForQuantity = lowestHqTotalByQuantity.get(
        listing.quantity,
      )
      if (
        lowestHqTotalForQuantity !== undefined &&
        listing.total === lowestHqTotalForQuantity
      ) {
        niches.push('Lowest total price for HQ quantity')
      }
    }

    return niches
  }

  const toDerivedListing = (
    listing: MarketData['listings'][number],
  ): UndercutItemState['ownedListings'][number] => ({
    listingId: listing.listingId,
    quality: listing.hq ? 'HQ' : 'NQ',
    quantity: listing.quantity,
    sellingPrice: listing.pricePerUnit,
    totalCost: listing.total,
    retainerName: listing.retainerName ?? '—',
    retainerCity: listing.retainerCity,
    lastReviewAt: listing.lastReviewTime.getTime(),
    niches: deriveNiches(listing),
  })

  const reduceByNiche = (
    listings: (UndercutItemState['ownedListings'][number] & {
      isOwned: boolean
    })[],
  ): (UndercutItemState['ownedListings'][number] & { isOwned: boolean })[] => {
    const winnerByNicheAndOwnership = new Map<
      `${CompetitiveNiche}|owned` | `${CompetitiveNiche}|competitor`,
      (typeof listings)[number]
    >()
    const compareForNiche = (
      left: (typeof listings)[number],
      right: (typeof listings)[number],
      niche: CompetitiveNiche,
    ): number => {
      if (
        niche === 'Lowest total price for quantity' ||
        niche === 'Lowest total price for HQ quantity'
      ) {
        return (
          left.totalCost - right.totalCost ||
          left.sellingPrice - right.sellingPrice ||
          right.lastReviewAt - left.lastReviewAt
        )
      }

      return (
        left.sellingPrice - right.sellingPrice ||
        left.totalCost - right.totalCost ||
        right.lastReviewAt - left.lastReviewAt
      )
    }

    for (const niche of NICHE_ORDER) {
      const ownedCandidates = listings.filter(
        (listing) => listing.isOwned && listing.niches.includes(niche),
      )
      if (ownedCandidates.length > 0) {
        const winner = [...ownedCandidates].sort((left, right) =>
          compareForNiche(left, right, niche),
        )[0]
        winnerByNicheAndOwnership.set(`${niche}|owned`, winner)
      }

      const competitorCandidates = listings.filter(
        (listing) => !listing.isOwned && listing.niches.includes(niche),
      )
      if (competitorCandidates.length > 0) {
        const winner = [...competitorCandidates].sort((left, right) =>
          compareForNiche(left, right, niche),
        )[0]
        winnerByNicheAndOwnership.set(`${niche}|competitor`, winner)
      }
    }

    const assignedNichesByListing = new Map<
      (typeof listings)[number],
      CompetitiveNiche[]
    >()
    for (const [key, winner] of winnerByNicheAndOwnership.entries()) {
      const niche = key.split('|')[0] as CompetitiveNiche
      const assigned = assignedNichesByListing.get(winner)
      if (assigned === undefined) {
        assignedNichesByListing.set(winner, [niche])
      } else {
        assigned.push(niche)
      }
    }

    return listings.flatMap((listing) => {
      if (listing.niches.length === 0) {
        return [listing]
      }

      const assignedNiches = assignedNichesByListing.get(listing)
      if (assignedNiches === undefined || assignedNiches.length === 0) {
        return []
      }

      return [{ ...listing, niches: assignedNiches }]
    })
  }

  const reducedListings = reduceByNiche([
    ...ownedMarketListings.map((listing) => ({
      ...toDerivedListing(listing),
      isOwned: true,
    })),
    ...competitorMarketListings.map((listing) => ({
      ...toDerivedListing(listing),
      isOwned: false,
    })),
  ])

  const stripOwnership = (
    listing: UndercutItemState['ownedListings'][number] & { isOwned: boolean },
  ): UndercutItemState['ownedListings'][number] => ({
    listingId: listing.listingId,
    quality: listing.quality,
    quantity: listing.quantity,
    sellingPrice: listing.sellingPrice,
    totalCost: listing.totalCost,
    retainerName: listing.retainerName,
    retainerCity: listing.retainerCity,
    lastReviewAt: listing.lastReviewAt,
    niches: listing.niches,
  })

  const ownedListings: UndercutItemState['ownedListings'] = reducedListings
    .filter((listing) => listing.isOwned)
    .map(stripOwnership)
  const rawCompetitorListings: UndercutItemState['competitorListings'] =
    reducedListings.filter((listing) => !listing.isOwned).map(stripOwnership)
  const competitorListingsByMarketShape = new Map<
    string,
    UndercutItemState['competitorListings'][number]
  >()

  for (const listing of rawCompetitorListings) {
    const shapeKey = [
      listing.quality,
      listing.quantity.toString(),
      listing.sellingPrice.toString(),
    ].join('|')
    const existing = competitorListingsByMarketShape.get(shapeKey)

    if (existing === undefined) {
      competitorListingsByMarketShape.set(shapeKey, listing)
      continue
    }

    const mergedNiches = [...new Set([...existing.niches, ...listing.niches])]
    const preferred =
      listing.niches.length > existing.niches.length ? listing : existing
    competitorListingsByMarketShape.set(shapeKey, {
      ...preferred,
      niches: mergedNiches,
    })
  }

  const competitorListings = [...competitorListingsByMarketShape.values()]
  const nicheCompetitorListings = competitorListings.filter(
    (listing) => listing.niches.length > 0,
  )
  const hasCompetitiveNicheCompetitor = nicheCompetitorListings.length > 0
  const baseEffectiveCompetitorListings = hasCompetitiveNicheCompetitor
    ? nicheCompetitorListings
    : [...competitorListings]
        .sort(
          (left, right) =>
            left.sellingPrice - right.sellingPrice ||
            left.totalCost - right.totalCost ||
            right.lastReviewAt - left.lastReviewAt,
        )
        .slice(0, 1)
  const ownedHasLowestHqUnitPrice = ownedListings.some(
    (listing) =>
      listing.quality === 'HQ' &&
      lowestPricePerUnitHq !== undefined &&
      listing.sellingPrice === lowestPricePerUnitHq,
  )
  const lowestHqUnitPriceCompetitor = [...competitorListings]
    .filter((listing) => listing.quality === 'HQ')
    .sort(
      (left, right) =>
        left.sellingPrice - right.sellingPrice ||
        left.totalCost - right.totalCost ||
        right.lastReviewAt - left.lastReviewAt,
    )
    .at(0)
  const effectiveCompetitorListings =
    ownedHasLowestHqUnitPrice && lowestHqUnitPriceCompetitor !== undefined
      ? [
          ...baseEffectiveCompetitorListings,
          ...(baseEffectiveCompetitorListings.includes(
            lowestHqUnitPriceCompetitor,
          )
            ? []
            : [lowestHqUnitPriceCompetitor]),
        ]
      : baseEffectiveCompetitorListings

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
    competitorListings: effectiveCompetitorListings,
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

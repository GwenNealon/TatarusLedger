import type { MarketData } from '../../api/types.ts'
import type { NormalizedItem } from '../../data/types.ts'

export interface UndercutItemState {
  itemId: number
  itemName: string
  listingCount: number
  ownedQuantity: number
  ownedQuality: 'HQ' | 'NQ' | 'Mixed' | null
  lowestOwnedPrice: number | null
  lowestCompetitorPrice: number | null
  undercut: boolean
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

  let lowestOwnedPrice: number | null = null
  let lowestCompetitorPrice: number | null = null
  let ownedQuantity = 0
  let hasOwnedHq = false
  let hasOwnedNq = false

  for (const listing of marketData.listings) {
    const ownerName = listing.retainerName?.toLowerCase()
    const isOwned = ownerName !== undefined && ownedNames.has(ownerName)

    if (isOwned) {
      ownedQuantity += listing.quantity
      if (listing.hq) {
        hasOwnedHq = true
      } else {
        hasOwnedNq = true
      }
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
  }

  return {
    itemId: marketData.itemId,
    itemName,
    listingCount: marketData.listings.length,
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
    undercut:
      lowestOwnedPrice !== null &&
      lowestCompetitorPrice !== null &&
      lowestCompetitorPrice < lowestOwnedPrice,
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

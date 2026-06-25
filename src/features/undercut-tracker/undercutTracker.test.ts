import { describe, expect, it } from 'vitest'

import type { MarketData } from '../../api/types.ts'
import type { NormalizedItem } from '../../data/types.ts'
import {
  buildSubscriptionChannel,
  deriveItemState,
  normalizeRetainerNames,
  parseWatchTokens,
  resolveWatchItems,
} from './undercutTracker.ts'

const ITEMS: NormalizedItem[] = [
  { id: 1, name: 'Alpha', iconId: 1, levelItem: 1, rarity: 1, uiCategory: 1 },
  { id: 2, name: 'Beta', iconId: 2, levelItem: 1, rarity: 1, uiCategory: 1 },
]

function makeMarketData(listings: MarketData['listings']): MarketData {
  return { itemId: 1, listings, sales: [] }
}

describe('parseWatchTokens', () => {
  it('splits newline and comma separated values', () => {
    expect(parseWatchTokens('Alpha, Beta\nGamma')).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ])
  })
})

describe('normalizeRetainerNames', () => {
  it('normalizes names to lowercase', () => {
    expect(normalizeRetainerNames('TATARU\nMiqo')).toEqual(['tataru', 'miqo'])
  })
})

describe('resolveWatchItems', () => {
  it('resolves by id and name', () => {
    const result = resolveWatchItems(ITEMS, ['1', 'beta', 'missing'])

    expect(result.items.map((item) => item.id)).toEqual([1, 2])
    expect(result.unresolvedTokens).toEqual(['missing'])
  })
})

describe('buildSubscriptionChannel', () => {
  it('includes world and item filters', () => {
    expect(buildSubscriptionChannel('listings/add', 'Crystal', 1)).toBe(
      'listings/add{world=Crystal,item=1}',
    )
  })
})

describe('deriveItemState', () => {
  it('marks an item undercut when a competitor is cheaper', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          retainerCity: 1,
          hq: false,
          quantity: 1,
          total: 1_000,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: undefined,
          worldId: undefined,
          worldName: undefined,
        },
        {
          pricePerUnit: 900,
          retainerName: 'Other',
          retainerCity: 2,
          hq: false,
          quantity: 1,
          total: 900,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: undefined,
          worldId: undefined,
          worldName: undefined,
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.undercut).toBe(true)
    expect(state.listingStatusTier).toBe('Undercut')
    expect(state.lowestOwnedPrice).toBe(1_000)
    expect(state.lowestCompetitorPrice).toBe(900)
    expect(state.ownedQuantity).toBe(1)
    expect(state.ownedQuality).toBe('NQ')
    expect(state.ownedListings).toEqual([
      {
        listingId: undefined,
        quality: 'NQ',
        quantity: 1,
        sellingPrice: 1_000,
        totalCost: 1_000,
        retainerName: 'Owned',
        retainerCity: 1,
        lastReviewAt: state.ownedListings[0]?.lastReviewAt ?? 0,
      },
    ])
    expect(typeof state.ownedListings[0]?.lastReviewAt).toBe('number')
  })

  it('dedupes competitor listings and aggregates matching reasons', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          retainerCity: 1,
          hq: false,
          quantity: 10,
          total: 10_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 950,
          retainerName: 'Competitor A',
          retainerCity: 14,
          hq: true,
          quantity: 2,
          total: 1_900,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:10:00Z'),
          listingId: 'comp-a',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 980,
          retainerName: 'Competitor B',
          retainerCity: 3,
          hq: false,
          quantity: 20,
          total: 19_600,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:20:00Z'),
          listingId: 'comp-b',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    const competitorA = state.competitorListings.find(
      (listing) => listing.retainerName === 'Competitor A',
    )
    expect(competitorA).toBeDefined()
    expect(competitorA?.reasons).toEqual(
      expect.arrayContaining([
        'Lowest price',
        'Lowest HQ',
        'Lowest smaller stack',
        'Lowest HQ smaller stack',
        'Cheaper total than your highest stack',
      ]),
    )
    expect(competitorA?.beatsByPrice).toBe(true)
    expect(competitorA?.beatsByComparableTotal).toBe(false)
    expect(competitorA?.competitivenessSummary).toBe('one-respect')
    expect(state.allCompetitorsOneRespect).toBe(true)
    expect(state.oldestListingReviewAt).toBe(
      new Date('2026-06-21T12:00:00Z').getTime(),
    )
    expect(state.maxWorldTimestampDeltaMs).toBe(20 * 60 * 1_000)
    expect(state.hasWorldTimestampDeltaWarning).toBe(true)
  })

  it('skips cheaper-total rule when owned quantities are all one', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          hq: false,
          quantity: 1,
          total: 1_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 900,
          retainerName: 'Competitor',
          hq: false,
          quantity: 1,
          total: 900,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(
      state.competitorListings.some((listing) =>
        listing.reasons.includes('Cheaper total than your highest stack'),
      ),
    ).toBe(false)
  })

  it('marks quality as mixed when both HQ and NQ owned listings exist', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          hq: true,
          quantity: 1,
          total: 1_000,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: undefined,
          worldId: undefined,
          worldName: undefined,
        },
        {
          pricePerUnit: 1_100,
          retainerName: 'Owned',
          hq: false,
          quantity: 1,
          total: 1_100,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: undefined,
          worldId: undefined,
          worldName: undefined,
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.ownedQuality).toBe('Mixed')
  })

  it('marks DC best when owned listings are cheapest', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 800,
          retainerName: 'Owned',
          hq: false,
          quantity: 1,
          total: 800,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: undefined,
          worldId: undefined,
          worldName: undefined,
        },
        {
          pricePerUnit: 900,
          retainerName: 'Other',
          hq: false,
          quantity: 1,
          total: 900,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: undefined,
          worldId: undefined,
          worldName: undefined,
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.undercut).toBe(false)
    expect(state.listingStatusTier).toBe('DC Best')
  })

  it('marks world best when own world is cheapest but data center is not', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          hq: false,
          quantity: 10,
          total: 10_000,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_100,
          retainerName: 'World Competitor',
          hq: false,
          quantity: 10,
          total: 11_000,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: 'world-competitor',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 900,
          retainerName: 'DC Competitor',
          hq: false,
          quantity: 10,
          total: 9_000,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: 'dc-competitor',
          worldId: 74,
          worldName: 'Zalera',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.undercut).toBe(false)
    expect(state.listingStatusTier).toBe('World Best')
  })

  it('marks competitive when only one competitiveness metric loses', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          hq: false,
          quantity: 10,
          total: 10_000,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 900,
          retainerName: 'Fast Seller',
          hq: false,
          quantity: 5,
          total: 4_500,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: 'fast-seller',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_200,
          retainerName: 'Large Stack',
          hq: false,
          quantity: 10,
          total: 12_000,
          tax: 0,
          lastReviewTime: new Date(),
          listingId: 'large-stack',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.undercut).toBe(false)
    expect(state.listingStatusTier).toBe('Competitive')
  })

  it('dedupes duplicate owned listings with the same listing id', () => {
    const duplicatedOwnedListing: MarketData['listings'][number] = {
      pricePerUnit: 993,
      retainerName: 'Venasea',
      retainerCity: 14,
      hq: false,
      quantity: 40,
      total: 39_720,
      tax: 0,
      lastReviewTime: new Date('2026-06-21T17:35:43Z'),
      listingId: 'owned-dup-1',
      worldId: 34,
      worldName: 'Brynhildr',
    }

    const state = deriveItemState({
      marketData: makeMarketData([
        duplicatedOwnedListing,
        { ...duplicatedOwnedListing },
        {
          pricePerUnit: 950,
          retainerName: 'Competitor',
          retainerCity: 4,
          hq: false,
          quantity: 1,
          total: 950,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T17:36:43Z'),
          listingId: 'comp-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['venasea'],
    })

    expect(state.ownedListings).toHaveLength(1)
    expect(state.ownedQuantity).toBe(40)
  })

  it('computes competitor competitiveness summary and aggregate one-respect flag', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          hq: false,
          quantity: 10,
          total: 10_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 900,
          retainerName: 'Aggressive',
          hq: false,
          quantity: 10,
          total: 9_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'aggressive',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 950,
          retainerName: 'Small Stack',
          hq: false,
          quantity: 5,
          total: 4_750,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'small-stack',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    const byRetainer = new Map(
      state.competitorListings.map((listing) => [
        listing.retainerName,
        listing,
      ]),
    )
    const aggressive = byRetainer.get('Aggressive')
    const smallStack = byRetainer.get('Small Stack')

    expect(aggressive?.beatsByPrice).toBe(true)
    expect(aggressive?.beatsByComparableTotal).toBe(true)
    expect(aggressive?.competitivenessSummary).toBe('all-respects')

    expect(smallStack?.beatsByPrice).toBe(true)
    expect(smallStack?.beatsByComparableTotal).toBe(false)
    expect(smallStack?.competitivenessSummary).toBe('one-respect')

    expect(state.allCompetitorsOneRespect).toBe(false)
  })
})

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
        niches: [],
      },
    ])
    expect(typeof state.ownedListings[0]?.lastReviewAt).toBe('number')
  })

  it('assigns niche categories and applies short-circuit priority', () => {
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
    expect(competitorA?.niches).toEqual(['Lowest price per unit overall'])
    expect(state.oldestListingReviewAt).toBe(
      new Date('2026-06-21T12:00:00Z').getTime(),
    )
    expect(state.maxWorldTimestampDeltaMs).toBe(20 * 60 * 1_000)
    expect(state.hasWorldTimestampDeltaWarning).toBe(true)
  })

  it('skips HQ total niche when HQ price or total niche is already assigned', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 980,
          retainerName: 'Owned',
          hq: false,
          quantity: 2,
          total: 1_960,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 900,
          retainerName: 'Competitor HQ',
          hq: true,
          quantity: 2,
          total: 1_800,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 950,
          retainerName: 'Competitor HQ 2',
          hq: true,
          quantity: 2,
          total: 1_900,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'comp-2',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    const competitorHq = state.competitorListings.find(
      (listing) => listing.retainerName === 'Competitor HQ',
    )
    expect(competitorHq?.niches).toContain('Lowest price per unit overall')
    expect(competitorHq?.niches).not.toContain(
      'Lowest total price for HQ quantity',
    )
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

  it('keeps one representative listing per shared niche', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          hq: false,
          quantity: 5,
          total: 5_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_000,
          retainerName: 'Owned',
          hq: false,
          quantity: 5,
          total: 5_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'owned-2',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_100,
          retainerName: 'Competitor',
          hq: false,
          quantity: 5,
          total: 5_500,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'comp-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.ownedListings).toHaveLength(1)
    expect(state.ownedListings[0]?.niches).toContain(
      'Lowest price per unit overall',
    )
  })

  it('collapses competitor rows with matching quality, quantity, and price', () => {
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
          pricePerUnit: 1_300_000,
          retainerName: 'Competitor A',
          hq: false,
          quantity: 1,
          total: 1_300_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-a',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_300_000,
          retainerName: 'Competitor B',
          hq: false,
          quantity: 1,
          total: 1_300_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'comp-b',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.competitorListings).toHaveLength(1)
    expect(state.competitorListings[0]?.quantity).toBe(1)
    expect(state.competitorListings[0]?.sellingPrice).toBe(1_300_000)
  })

  it('shows only the single lowest-price competitor when no competitor has a niche', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 900,
          retainerName: 'Owned',
          hq: false,
          quantity: 1,
          total: 900,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 900,
          retainerName: 'Owned',
          hq: false,
          quantity: 2,
          total: 1_800,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:30Z'),
          listingId: 'owned-2',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_000,
          retainerName: 'Competitor A',
          hq: false,
          quantity: 1,
          total: 1_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-a',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_100,
          retainerName: 'Competitor B',
          hq: false,
          quantity: 2,
          total: 2_200,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'comp-b',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.competitorListings).toHaveLength(1)
    expect(state.competitorListings[0]?.sellingPrice).toBe(1_000)
    expect(state.competitorListings[0]?.niches).toEqual([])
  })

  it('shows only niche competitors when at least one niche competitor exists', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 900,
          retainerName: 'Owned',
          hq: false,
          quantity: 1,
          total: 900,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_000,
          retainerName: 'Niche Competitor',
          hq: false,
          quantity: 2,
          total: 2_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-a',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 1_300,
          retainerName: 'Non-Niche Competitor',
          hq: false,
          quantity: 1,
          total: 1_300,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'comp-b',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.competitorListings).toHaveLength(1)
    expect(state.competitorListings[0]?.retainerName).toBe('Niche Competitor')
    expect(state.competitorListings[0]?.niches.length).toBeGreaterThan(0)
  })

  it('allows owned and competitor listings to share the same niche', () => {
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
          pricePerUnit: 1_000,
          retainerName: 'Competitor Tie',
          hq: false,
          quantity: 1,
          total: 1_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-tie',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    expect(state.ownedListings[0]?.niches).toContain(
      'Lowest price per unit overall',
    )
    const tiedCompetitor = state.competitorListings.find(
      (listing) => listing.listingId === 'comp-tie',
    )
    expect(tiedCompetitor?.niches).toContain('Lowest price per unit overall')
  })

  it('keeps lowest HQ-unit competitor visible when owned listing holds HQ-unit niche', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 100,
          retainerName: 'Owned HQ',
          hq: true,
          quantity: 1,
          total: 100,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-hq',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 150,
          retainerName: 'Competitor NQ',
          hq: false,
          quantity: 1,
          total: 150,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-nq',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 200,
          retainerName: 'Competitor HQ',
          hq: true,
          quantity: 1,
          total: 200,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'comp-hq',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned hq'],
    })

    expect(state.ownedListings[0]?.quality).toBe('HQ')
    expect(
      state.competitorListings.some(
        (listing) => listing.listingId === 'comp-nq',
      ),
    ).toBe(true)
    expect(
      state.competitorListings.some(
        (listing) => listing.listingId === 'comp-hq',
      ),
    ).toBe(true)
  })

  it('does not mark a smaller quantity listing as lowest total when a larger stack is cheaper overall', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 40,
          retainerName: 'Owned',
          hq: false,
          quantity: 1,
          total: 40,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 60,
          retainerName: 'Owned',
          hq: false,
          quantity: 2,
          total: 120,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:30Z'),
          listingId: 'owned-2',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 500,
          retainerName: 'Competitor Single',
          hq: false,
          quantity: 1,
          total: 500,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-single',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 50,
          retainerName: 'Competitor Stack',
          hq: false,
          quantity: 2,
          total: 100,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'comp-stack',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned'],
    })

    const stack = state.competitorListings.find(
      (listing) => listing.retainerName === 'Competitor Stack',
    )

    expect(
      state.competitorListings.some(
        (listing) => listing.retainerName === 'Competitor Single',
      ),
    ).toBe(false)
    expect(stack?.niches).toContain('Lowest total price for quantity')
  })

  it('does not assign total-price-for-quantity when HQ unit-price niche is present', () => {
    const state = deriveItemState({
      marketData: makeMarketData([
        {
          pricePerUnit: 5_000,
          retainerName: 'Other Owned',
          hq: false,
          quantity: 1,
          total: 5_000,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:00:00Z'),
          listingId: 'owned-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 249,
          retainerName: 'Competitor',
          hq: false,
          quantity: 2,
          total: 499,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:01:00Z'),
          listingId: 'comp-1',
          worldId: 34,
          worldName: 'Brynhildr',
        },
        {
          pricePerUnit: 4_995,
          retainerName: 'Owned HQ',
          hq: true,
          quantity: 3,
          total: 14_985,
          tax: 0,
          lastReviewTime: new Date('2026-06-21T12:02:00Z'),
          listingId: 'owned-hq',
          worldId: 34,
          worldName: 'Brynhildr',
        },
      ]),
      itemName: 'Alpha',
      retainerNames: ['owned hq', 'other owned'],
    })

    const ownedHq = state.ownedListings.find(
      (listing) => listing.listingId === 'owned-hq',
    )
    expect(ownedHq?.niches).toContain('Lowest price per unit HQ')
    expect(ownedHq?.niches).not.toContain('Lowest total price for quantity')
  })
})

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
    expect(state.lowestOwnedPrice).toBe(1_000)
    expect(state.lowestCompetitorPrice).toBe(900)
  })

  it('stays competitive when owned listings are cheapest', () => {
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
  })
})

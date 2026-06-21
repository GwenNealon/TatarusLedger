/** Domain models. */

export interface Listing {
  listingId: string | undefined
  worldId: number | undefined
  worldName: string | undefined
  retainerCity?: number
  hq: boolean
  pricePerUnit: number
  quantity: number
  total: number
  tax: number
  retainerName: string | undefined
  lastReviewTime: Date
}

export interface Sale {
  worldId: number | undefined
  worldName: string | undefined
  hq: boolean
  pricePerUnit: number
  quantity: number
  timestamp: Date
  buyerName: string | undefined
}

export interface MarketData {
  itemId: number
  listings: Listing[]
  sales: Sale[]
}

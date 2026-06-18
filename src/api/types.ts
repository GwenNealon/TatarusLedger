/** Raw types from the Universalis API (v2). */

export interface RawListing {
  listingID: string
  hq: boolean
  pricePerUnit: number
  quantity: number
  total: number
  tax: number
  retainerName: string
  worldID: number
  worldName?: string
  lastReviewTime: number
}

export interface RawSale {
  hq: boolean
  pricePerUnit: number
  quantity: number
  timestamp: number
  buyerName: string
  worldID: number
  worldName?: string
}

export interface RawMarketResponse {
  itemID: number
  listings: RawListing[]
  recentHistory: RawSale[]
}

export interface RawMultiMarketResponse {
  itemIDs: number[]
  items: Record<string, RawMarketResponse>
}

export interface RawHistoryResponse {
  itemID: number
  entries: RawSale[]
}

export interface RawMultiHistoryResponse {
  itemIDs: number[]
  items: Record<string, RawHistoryResponse>
}

/** Domain models. */

export interface Listing {
  listingId: string
  worldId: number
  worldName: string | undefined
  hq: boolean
  pricePerUnit: number
  quantity: number
  total: number
  tax: number
  retainerName: string
  /** Unix millisecond timestamp for backend-safe comparisons. */
  lastReviewTime: number
}

export interface Sale {
  worldId: number
  worldName: string | undefined
  hq: boolean
  pricePerUnit: number
  quantity: number
  /** Unix millisecond timestamp for backend-safe comparisons. */
  timestamp: number
  buyerName: string
}

export interface MarketData {
  itemId: number
  listings: Listing[]
  sales: Sale[]
}

import type { components } from './universalis.swagger.v2.generated.ts'

/** Raw types from the Universalis API (v2), derived from the pinned spec. */
type SwaggerListing =
  components['schemas']['Universalis.Application.Views.V1.ListingView']
type SwaggerSale =
  components['schemas']['Universalis.Application.Views.V1.MinimizedSaleView']
type SwaggerMarketResponse =
  components['schemas']['Universalis.Application.Views.V1.CurrentlyShownView']
type SwaggerMultiMarketResponse =
  components['schemas']['Universalis.Application.Views.V2.CurrentlyShownMultiViewV2']
type SwaggerHistoryResponse =
  components['schemas']['Universalis.Application.Views.V1.HistoryView']
type SwaggerMultiHistoryResponse =
  components['schemas']['Universalis.Application.Views.V2.HistoryMultiViewV2']

export interface RawListing {
  listingID: SwaggerListing['listingID']
  hq: SwaggerListing['hq']
  pricePerUnit: SwaggerListing['pricePerUnit']
  quantity: SwaggerListing['quantity']
  total: SwaggerListing['total']
  tax: SwaggerListing['tax']
  retainerName: SwaggerListing['retainerName']
  worldID: SwaggerListing['worldID']
  worldName?: SwaggerListing['worldName']
  lastReviewTime: SwaggerListing['lastReviewTime']
}

export interface RawSale {
  hq: SwaggerSale['hq']
  pricePerUnit: SwaggerSale['pricePerUnit']
  quantity: SwaggerSale['quantity']
  timestamp: SwaggerSale['timestamp']
  buyerName?: SwaggerSale['buyerName']
  worldID?: SwaggerSale['worldID']
  worldName?: SwaggerSale['worldName']
}

export interface RawMarketResponse {
  itemID: SwaggerMarketResponse['itemID']
  listings?: RawListing[] | null
  recentHistory?: RawSale[] | null
}

export interface RawMultiMarketResponse {
  itemIDs?: SwaggerMultiMarketResponse['itemIDs']
  items?: Record<string, RawMarketResponse> | null
}

export interface RawHistoryResponse {
  itemID: SwaggerHistoryResponse['itemID']
  entries?: RawSale[] | null
}

export interface RawMultiHistoryResponse {
  itemIDs?: SwaggerMultiHistoryResponse['itemIDs']
  items?: Record<string, RawHistoryResponse> | null
}

/** Domain models. */

export interface Listing {
  listingId: string | undefined
  worldId: number | undefined
  worldName: string | undefined
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

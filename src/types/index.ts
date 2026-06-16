/** FFXIV item data from XIVAPI */
export interface XivItem {
  ID: number;
  Name: string;
  Icon: string;
  StackSize: number;
  /** 0 = tradable on the Market Board, 1 = untradable */
  IsUntradable: number;
  ItemSearchCategory: { ID: number; Name: string } | null;
}

/** A single active Market Board listing from Universalis */
export interface MarketListing {
  pricePerUnit: number;
  quantity: number;
  total: number;
  hq: boolean;
  worldName?: string;
  worldID?: number;
  retainerName: string;
  /** Unix timestamp (seconds) of the last time this listing was seen */
  lastReviewTime: number;
}

/** A completed Market Board sale from Universalis history */
export interface SaleHistory {
  pricePerUnit: number;
  quantity: number;
  hq: boolean;
  worldName?: string;
  worldID?: number;
  buyerName: string;
  /** Unix timestamp (seconds) of the sale */
  timestamp: number;
  onMannequin: boolean;
}

/** Universalis market data for a single item on a world/DC/region */
export interface MarketData {
  itemID: number;
  worldID?: number;
  worldName?: string;
  dcName?: string;
  regionName?: string;
  /** Unix timestamp (milliseconds) of last upload */
  lastUploadTime: number;
  listings: MarketListing[];
  recentHistory: SaleHistory[];
  currentAveragePrice: number;
  currentAveragePriceNQ: number;
  currentAveragePriceHQ: number;
  averagePrice: number;
  averagePriceNQ: number;
  averagePriceHQ: number;
  saleVelocity: number;
  saleVelocityNQ: number;
  saleVelocityHQ: number;
  minPrice: number;
  minPriceNQ: number;
  minPriceHQ: number;
  maxPrice: number;
  maxPriceNQ: number;
  maxPriceHQ: number;
}

/** Universalis response shape when querying multiple items at once */
export interface MultiItemMarketData {
  itemIDs: number[];
  items: Record<string, MarketData>;
  worldID?: number;
  worldName?: string;
  dcName?: string;
  regionName?: string;
  unresolvedItems: number[];
}

# Universalis API Reference

Source: https://universalis.app/docs/index.html

## Basics

- No authentication required.
- Base URL is `https://universalis.app/api/v2`.
- Market endpoints accept a world, data center, or region as `{worldDcRegion}`.
- `worldDcRegion` may be passed as a name or ID.
- Region names called out in the spec are `Japan`, `Europe`, `North-America`, `Oceania`, `China`, and `中国`.
- Item lookup endpoints accept up to 100 comma-separated item IDs per request.
- The API uses both seconds and milliseconds in time fields and query params; read each field carefully.

## Main Market Endpoints

- `GET /api/v2/{worldDcRegion}/{itemIds}`
  - Returns the current market-board view for each item: active listings, recent sale entries, price stats, sale velocity, upload times, and stack-size histograms.
  - Query params:
    - `listings`: number of listings to return per item. Default is all listings.
    - `entries`: number of recent sale entries to return per item. Default is 5.
    - `hq`: filter HQ vs NQ data. Omit for both.
    - `statsWithin`: stats window in milliseconds. Default is 7 days.
    - `entriesWithin`: recent-sale window in seconds. Negative values are ignored.
    - `fields`: comma-separated field projection. For batched requests, field paths are prefixed with `items.`.
  - Use this when you need raw listings or raw recent sales, not just summary prices.

- `GET /api/v2/aggregated/{worldDcRegion}/{itemIds}`
  - Returns a lighter summary view for each item using cached aggregate values.
  - Per item, data is split into `hq` and `nq`, with `averageSalePrice`, `dailySaleVelocity`, `medianListing`, `minListing`, and `recentPurchase`.
  - Most aggregate values are broken out at `world`, `dc`, and `region` scope, so one call can answer cross-scope pricing questions.
  - Response includes `failedItems` for IDs that could not be resolved.
  - The spec explicitly says this is preferred over the full current-data endpoint when you do not need individual listings or sales.

- `GET /api/v2/history/{worldDcRegion}/{itemIds}`
  - Returns historical sales only, without active listings.
  - Query params:
    - `entriesToReturn`: number of sale entries per item. Default is 1800, max is 99999.
    - `statsWithin`: stats window in milliseconds. Default is 7 days.
    - `entriesWithin`: history window in seconds, measured backward from `entriesUntil` or now. Default is 7 days.
    - `entriesUntil`: UNIX timestamp in seconds. Returns only entries before this time.
    - `minSalePrice`: inclusive minimum unit sale price.
    - `maxSalePrice`: inclusive maximum unit sale price.
  - Use this for historical trend analysis, filtered sale windows, or time-sliced backtesting.

## Discovery Endpoints

- `GET /api/v2/marketable`
  - Returns the full set of marketable item IDs.
  - Use this to filter out untradeable items before running market queries.

- `GET /api/v2/worlds`
  - Returns all supported worlds as `{ id, name }`.

- `GET /api/v2/data-centers`
  - Returns data centers as `{ name, region, worlds[] }`.
  - Use this to map a world to its DC and region without hardcoding game topology.

- `GET /api/v2/tax-rates?world=...`
  - Returns the current market tax rates for a world.
  - Data is described by the spec as coming from the Retainer Vocate in major cities.
  - Use this when net profit matters and listing tax can change the answer.

## Extra And Meta Endpoints

- `GET /api/v2/extra/content/{contentId}`
  - Returns a content object associated with a content ID.
  - The spec marks this endpoint as largely untested and potentially inconsistent.

- `GET /api/v2/extra/stats/most-recently-updated`
  - Query params: `world`, `dcName`, `entries`.
  - Returns the freshest updated items for a world or data center, including upload times.

- `GET /api/v2/extra/stats/least-recently-updated`
  - Query params: `world`, `dcName`, `entries`.
  - Returns the stalest updated items for a world or data center.

- `GET /api/v2/extra/stats/recently-updated`
  - Legacy endpoint returning recently updated item IDs only.
  - Does not say which worlds or data centers were updated.

- `GET /api/v2/extra/stats/upload-history`
  - Returns upload counts per day over the last 30 days.

- `GET /api/v2/extra/stats/uploader-upload-counts`
  - Returns total upload counts grouped by client application.

- `GET /api/v2/extra/stats/world-upload-counts`
  - Returns upload counts and proportions grouped by world.

- `GET /api/v2/lists/{listId}`
  - Returns a user list by UUID.
  - Payload includes list metadata plus `itemIDs`.

## Response Shape Notes

- Single-item market/history responses usually expose top-level item fields like `itemID`, `listings`, `recentHistory`, or `entries`.
- Batched market/history responses use an `items` map keyed by item ID string.
- Batched responses also include request-scope metadata such as `worldName`, `dcName`, `regionName`, `itemIDs`, and `unresolvedItems`.
- `unresolvedItems` is how the API reports bad or missing item IDs in batched requests instead of failing the whole request.
- Current-data responses include both raw records and summary fields like average prices, min/max prices, units for sale, units sold, and sale velocity.
- History responses include raw sale entries plus sale velocity and stack-size histograms.
- Aggregated responses do not include raw listings or raw sales; they provide rolled-up pricing and recent-purchase summaries.

## Status And Error Notes

- The spec documents `400` for invalid parameters on the main current-data and aggregated endpoints.
- The spec documents `404` when the requested world, data center, region, list, or single item is invalid.
- In batched item lookups, invalid item IDs are typically reported via `unresolvedItems` or `failedItems` instead of a top-level `404`.

## Practical Guidance

- Prefer batched item lookups over one request per item.
- Use `/aggregated/...` first for dashboards, rankings, and arbitrage scans; switch to `/{worldDcRegion}/{itemIds}` only when you need raw listing or recent-sale detail.
- Use `/history/...` when you need more than the default 5 recent sales or when you need time-bounded filtering.
- Do not assume every endpoint uses the same time unit; the spec mixes milliseconds and seconds.

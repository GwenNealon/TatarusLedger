# XIVAPI Reference

Source: https://v2.xivapi.com/docs

## Basics

- Base URL is `https://v2.xivapi.com/api`.
- The published v2 API surface is small and centered on three capability groups: sheet data, structured search, and game assets.
- Many endpoints accept an optional `version` query param so you can target a specific game-data snapshot instead of whatever `latest` points at.
- Sheet-style endpoints also accept `language`, `schema`, `fields`, and sometimes `transient`.

## API Surface

- `GET /version`
  - Lists the game-data versions understood by the API.
  - Response contains version keys and friendly names like patch numbers or `latest`.

- `GET /sheet`
  - Lists the known Excel sheets that can be read.
  - Use this when you need to discover the exact sheet name before querying it.

- `GET /sheet/{sheet}`
  - Reads one or more rows from a sheet.
  - This is the main bulk-read endpoint.

- `GET /sheet/{sheet}/{row}`
  - Reads a single row with the same filtering/projection options as the bulk endpoint.
  - Use this when you already know the row ID and want one object, not a page.

- `GET /search`
  - Executes a structured search query across one or more sheets.
  - Returns matching rows plus a cursor for pagination.

- `GET /asset`
  - Reads a raw game asset at a given path and converts it to a web-friendly format.
  - Supported output formats in the spec are `jpg`, `png`, and `webp`.

- `GET /asset/map/{territory}/{index}`
  - Composes and returns a map image for a territory/index pair.
  - Useful when you want map images without reconstructing them yourself from split source files.

## Sheet Endpoints

The sheet endpoints are the core of XIVAPI v2. They expose the game data tables directly.

- `sheet` path param: the sheet name, such as `Item`.
- `rows` on `GET /sheet/{sheet}`: comma-separated row IDs to fetch directly.
- `limit` on `GET /sheet/{sheet}`: maximum number of rows to return.
- `after` on `GET /sheet/{sheet}`: fetch rows after the given row specifier for pagination.
- `language`: default language for fields that do not specify one explicitly.
- `schema`: which schema definition to read the sheet with.
- `fields`: field projection string so you only fetch the columns you need.
- `transient`: projection string for transient row data when a sheet exposes it.

Important paging and selection rules:

- Do not combine `rows` and `after`; the spec says behavior is undefined.
- The standard page loop is `limit=N`, then send the last returned row to `after` on the next request.
- `GET /sheet/{sheet}/{row}` takes a row specifier directly in the path and skips list pagination.

Practical field-selection notes:

- The API is designed around field projection. Request the fields you need rather than entire rows.
- Raw scalar extraction is supported in field filters; this repo uses syntax like `Icon@as(raw)` and `LevelItem@as(raw)`.
- Related-sheet fields can be projected too; the docs describe sheet reads as returning rows and their related data.

## Search Endpoint

`GET /search` is the higher-level query API when you do not know row IDs ahead of time.

- `query`: the structured search query string.
- `sheets`: comma-separated list of sheets to search.
- `cursor`: continuation token from a previous search response.
- `limit`: maximum number of results to return.
- `language`, `schema`, `fields`, `transient`, `version`: same idea as the sheet endpoints.

Search behavior that matters:

- `query` is required unless you are continuing from a `cursor`.
- `sheets` is required unless you are continuing from a `cursor`.
- If `cursor` is present, it takes priority over `query`.
- The spec explicitly warns that URL special characters such as `+` must be escaped.
- Search results are returned in relevance order.

## Asset Endpoints

`GET /asset` is for arbitrary file-backed assets.

- `path`: game asset path, for example an icon texture path.
- `format`: target image format, one of `jpg`, `png`, or `webp`.
- `version`: optional game-data version selector.

`GET /asset/map/{territory}/{index}` is the map-specific helper.

- `territory`: a 4-character territory code like `s1d1`.
- `index`: a zero-padded map index like `00`.
- Response is a composed JPEG image.

## Response Shape Notes

- Sheet list responses return a `sheets` array with sheet names.
- Bulk sheet reads return a `rows` array; each row has `row_id` and `fields`.
- Single-row reads return one object with `row_id` and `fields`.
- Sheet and search responses include `schema` and `version` describing what schema/version the server actually used.
- Search responses return `results` plus an optional `next` cursor for continuation.
- Asset endpoints return binary image content, not JSON, when successful.

## Error And Status Notes

- Most endpoints document a default JSON error shape with `code` and `message`.
- Asset endpoints may return `304 Not Modified` in addition to `200`.
- The OpenAPI spec does not present a large status-code matrix per endpoint the way Universalis does; expect endpoint-specific error handling and inspect the JSON `code`/`message` body on failures.

## Practical Guidance

- Start with `/sheet` if you need to discover available tables.
- Use `/sheet/{sheet}/{row}` when you know the row ID; use `/sheet/{sheet}` with `rows` or `after` when you need batches.
- Use `fields` aggressively. XIVAPI is much more useful when you treat it as a projection API instead of fetching whole rows.
- Use `/search` when you need lookup by text or conditions rather than known row IDs.
- Use `/asset` or `/asset/map/...` for icons and maps instead of hardcoding third-party image URLs when you need API-backed assets.
- In this repo specifically, XIVAPI is mainly used for item metadata fallback and item-index generation, but the API itself is broader than that.

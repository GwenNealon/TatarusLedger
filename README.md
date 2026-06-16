# TatarusLedger

A FFXIV Market Board tool for cross-world arbitrage, profitability analysis, and crafting optimisation.

## Development Roadmap

| Version | Focus |
|---------|-------|
| **v0.1** | Data foundation: Universalis API, XIVAPI item data, caching, CI |
| v0.2 | Basic arbitrage, item reports, MB tax, cross-world hop costs |
| v0.3 | Velocity/demand analysis, competition scoring, fraud filtering |
| v0.4 | Settings: time costs, world hop limits, job-level gating |
| v0.5 | Crafting/gathering shopping lists, recipe resolution, snapshots |
| v1.0 | Discovery: historical-data item suggestions, watchlist/alerts |

## Data layer (`src/`)

```
src/
  types/         TypeScript interfaces (XivItem, MarketData, …)
  cache/         TTL cache backed by localStorage / MemoryStorage
  api/
    universalis  Universalis v2 client — marketable items & MB data
    xivapi       XIVAPI client — item data
```

## Available Scripts

### `npm start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm test`

Runs the test suite. All data-layer modules have unit tests.

### `npm run build`

Builds the app for production to the `build/` folder.

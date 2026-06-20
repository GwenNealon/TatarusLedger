# Copilot Instructions for Tataru's Ledger

## Project Overview

Tataru's Ledger is a **TypeScript + React** single-page web application that uses data from the [Universalis API](https://universalis.app/docs/index.html) to surface profitable crafting, gathering, and market board arbitrage opportunities in the MMORPG **Final Fantasy XIV**.

The project is early-stage: the current `src/App.tsx` renders an official landing page while core features are built out inside the `src/` directory.

---

## Repository Layout

```
TatarusLedger/                   ← repo root; ALL frontend code lives here
  README.md
  package.json
  package-lock.json
  index.html
  vite.config.ts
  eslint.config.js
  tsconfig.json / tsconfig.app.json / tsconfig.node.json
  public/
    favicon.svg
  src/
    main.tsx                     ← React entry point
    App.tsx                      ← root component (official landing page)
```

**All `npm` commands are run from the repo root.**

---

## Tech Stack

| Layer           | Tool / Version                                                       |
| --------------- | -------------------------------------------------------------------- |
| UI framework    | React 19 (StrictMode)                                                |
| Language        | TypeScript ~6.0                                                      |
| Bundler         | Vite 8                                                               |
| Compiler plugin | `babel-plugin-react-compiler` via `@rolldown/plugin-babel`           |
| Linter          | ESLint 10 with `typescript-eslint` (strict + stylistic type-checked) |

---

## Development Commands

Run all commands from the **repo root**:

```bash
npm run dev        # start Vite dev server (hot module reload)
npm run build      # tsc -b && vite build  (full type-check + production bundle)
npm run api:spec:update # refresh Universalis snapshot + regenerate API types
npm run api:spec:check  # verify structural snapshot parity + generated types are current
npm run lint       # ESLint over all .ts/.tsx files
npm run preview    # serve the production build locally
```

**Validation is done via `format:check`, `lint`, `typecheck`, `test`, and `build`.**

Before committing changes, always verify with:

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build
```

### PR Suggestion Quality Gate (Required)

When preparing or suggesting PR-ready changes, Copilot must treat this as a hard gate:

1. Run:
   - `npm run format:check`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
2. Only provide PR suggestions that pass all commands above.
3. If any command fails, do **not** present the change as PR-ready. Fix the issue first, then re-run validation.
4. In PR suggestions, clearly state that validation was run and passed.

### PR Description Maintenance (Required)

When working on a branch that already has an open pull request:

1. Review the existing PR description before or while making changes.
2. Update the PR description so it accurately reflects the latest scope, implementation details, and validation status.
3. Ensure the PR description calls out any meaningful behavior changes, follow-up work, or known limitations introduced by the latest commit(s).

---

## TypeScript Conventions

The TypeScript config (`tsconfig.app.json`) enforces strict checks. Key rules to follow:

- **`noUnusedLocals` / `noUnusedParameters`** – every declared variable and parameter must be used. Prefix intentionally-unused parameters with `_` if needed.
- **`verbatimModuleSyntax: true`** – use `import type` for type-only imports (e.g., `import type { Foo } from './types'`). Mixing value and type imports in the same statement is fine only when at least one import is a value.
- **`erasableSyntaxOnly: true`** – avoid TypeScript-only syntax that cannot be erased (e.g., no `const enum`, no decorators without `experimentalDecorators`).
- **`noFallthroughCasesInSwitch`** – every `case` block must end with `break`, `return`, or `throw`.
- Target is **ES2023**; modern JavaScript syntax (optional chaining, nullish coalescing, `Array.at()`, etc.) is encouraged.
- **`jsx: "react-jsx"`** – no need to import React for JSX.

---

## ESLint Configuration

ESLint config is in `eslint.config.js` and applies to all `.ts` / `.tsx` files. Active rule sets:

- `@eslint/js` recommended
- `typescript-eslint` **strictTypeChecked** + **stylisticTypeChecked** – these are stricter than the default recommended presets. Type information is used for linting, so the tsconfig paths are wired in.
- `eslint-plugin-react-hooks` recommended – enforces Rules of Hooks.
- `eslint-plugin-react-refresh` (vite preset) – warns about non-component exports from `.tsx` files that would break HMR.

Because `typescript-eslint` strict+stylistic is enabled, expect rules like:

- Prefer `interface` over `type` aliases for object shapes.
- No unnecessary type assertions.
- Consistent type exports.

Run `npm run lint` after any changes to catch issues early.

---

## React Compiler

The project uses the **React Compiler** (`babel-plugin-react-compiler`) via `@rolldown/plugin-babel`. This means:

- **Do not add manual `useMemo`, `useCallback`, or `React.memo` calls** – the compiler handles memoization automatically.
- Code must strictly follow the [Rules of React](https://react.dev/reference/rules): components and hooks must be pure, side effects only in `useEffect`, no mutation of props or state during render.
- If the compiler cannot optimize a component it will silently skip it; writing clean, pure components maximises compiler benefit.

---

## Universalis API

The app consumes the [Universalis REST API](https://universalis.app/docs/index.html) (no authentication required). Key endpoints:

- `GET /api/v2/{worldDcRegion}/{itemIds}` – current market board listings and recent history for one or more item IDs in a world, data-centre, or region.
- `GET /api/v2/history/{worldDcRegion}/{itemIds}` – sale history only.
- `GET /api/v2/marketable` – list of all marketable item IDs.
- `GET /api/v2/worlds` – list of all worlds.
- `GET /api/v2/data-centers` – list of all data centres and their worlds.

Item names and metadata (not provided by Universalis) come from the community XIVAPI (`https://v2.xivapi.com/api/1/`) or the static Lodestone game data. Prefer fetching only what is needed; Universalis supports batching multiple item IDs in a single request (comma-separated).

### Spec Snapshot Workflow

See [README.md](../README.md#universalis-spec-workflow) for the canonical workflow and rationale.

---

## Domain Notes (FFXIV)

- **Gil** is the in-game currency.
- A **world** is a single game server (e.g., Balmung); worlds are grouped into **data centres** (e.g., Crystal), which are grouped into **regions** (e.g., North America).
- **Market board** = auction-house equivalent. Universalis aggregates listings across all worlds.
- Profitable opportunities include: crafting items and selling above material cost, buying on one world and selling on another (cross-world arbitrage), or identifying items with thin supply and high demand.
- Item IDs are integers; they are stable across patches.

---

## Errors and Workarounds

_None recorded yet. Document here any recurring errors (e.g., API rate limits, TypeScript version quirks, Vite plugin incompatibilities) and how they were resolved, so future agents can skip the investigation step._

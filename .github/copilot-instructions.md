# Copilot Instructions for Tataru's Ledger

## Project Overview

Tataru's Ledger is a **TypeScript + React** single-page web application that uses data from the [Universalis API](https://universalis.app/docs/index.html) to surface profitable crafting, gathering, and market board arbitrage opportunities in the MMORPG **Final Fantasy XIV**.

The project is early-stage: the current `src/App.tsx` renders an official landing page while core features are built out inside the `src/` directory.

---

## Repository Layout

Keep this section updated when key folders/files move or responsibilities change.

```
TatarusLedger/                   ← repo root
	.github/
		apis/                        ← local API docs; source of truth before web lookup
		workflows/                   ← CI/CD + release automation
	README.md                      ← canonical workflow and project docs
	scripts/                       ← maintenance/data/spec update entrypoints
	public/
		data/                        ← checked-in static datasets consumed at runtime
	src/                           ← runtime application source
		api/                         ← Universalis client and generated/snapshotted API artifacts
		data/                        ← normalization/parsing utilities
		features/                    ← user-facing feature modules
```

**All `npm` commands are run from the repo root.**

---

## Tech Stack

| Layer           | Tool / Version                                                           |
| --------------- | ------------------------------------------------------------------------ |
| UI framework    | React 19 (StrictMode)                                                    |
| Language        | TypeScript `~6.0.2` (see `package.json` for the exact installed version) |
| Bundler         | Vite `^8.0.12` (see `package.json` for the exact installed version)      |
| Compiler plugin | `babel-plugin-react-compiler` via `@rolldown/plugin-babel`               |
| Linter          | ESLint 10 with `typescript-eslint` (strict + stylistic type-checked)     |

---

## Development Commands

Run all commands from the **repo root**.

Build commands:

```bash
npm run dev
npm run build
npm run api:spec:update # refresh Universalis snapshot + regenerate API types
npm run api:spec:check  # verify structural snapshot parity + generated types are current
npm run lint
npm run preview
```

Validation commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
```

### PR Suggestion Quality Gate (Required)

When preparing or suggesting PR-ready changes, run all validation commands above in the local workspace where the change was made. If a command fails, attempt the following automated fixes and re-reun validations:

1. If `npm run format:check` fails, run `npm run format`, then re-run `npm run format:check`.
2. If `npm run lint` fails, run `npm run lint --fix`, then re-run `npm run lint`.
3. If `npm run typecheck` fails, fix the type errors, then re-run `npm run typecheck`.
4. If `npm run test` fails, fix the test errors, then re-run `npm run test`.

If any command fails after the automated fix, report the exact failure output, do **not** describe the change as PR-ready, and stop. Do not attempt further automated fixes unless the user explicitly asks for them.

### PR Description Maintenance (Required)

When working on a branch that already has an open pull request:

1. Review the existing PR description before or while making changes.
2. Update the PR description so it accurately reflects the latest scope, implementation details, and validation status.
3. Ensure the PR description calls out any meaningful behavior changes, follow-up work, or known limitations introduced by the latest commit(s).

---

## TypeScript Conventions

The TypeScript config (`tsconfig.app.json`) is strict. Follow these rules:

- Use every declared variable and parameter; prefix intentionally unused parameters with `_`.
- Use `import type` for type-only imports. For mixed imports, use inline type markers as the default style (`import { type Foo, bar } from './mod'`).
- Avoid non-erasable TypeScript syntax (for example `const enum`, decorators without `experimentalDecorators`).
- Do not allow switch fallthrough; each `case` must end with `break`, `return`, or `throw`.
- Use the React JSX transform (`jsx: react-jsx`); do not add React imports only for JSX.

---

## ESLint Configuration

ESLint config is in `eslint.config.js` and applies to all `.ts` / `.tsx` files.

- `@eslint/js` recommended
- `typescript-eslint` **strictTypeChecked** + **stylisticTypeChecked**
- `eslint-plugin-react-hooks` recommended – enforces Rules of Hooks.
- `eslint-plugin-react-refresh` (vite preset) – warns about non-component exports from `.tsx` files that would break HMR.

Linting is type-aware (wired to the project tsconfig), so lint can fail even when TypeScript compile succeeds.

Run `npm run lint` after any change.

---

## React Compiler

The project uses the **React Compiler** (`babel-plugin-react-compiler`) via `@rolldown/plugin-babel`. This means:

- **Do not add manual `useMemo`, `useCallback`, or `React.memo` calls** – the compiler handles memoization automatically.
- Code must strictly follow the [Rules of React](https://react.dev/reference/rules): components and hooks must be pure, side effects only in `useEffect`, no mutation of props or state during render.
- If the compiler cannot optimize a component it will silently skip it; writing clean, pure components maximises compiler benefit.

---

## External API

The app consumes Universalis and XIVAPI.

Use local API docs as source of truth before web lookup:

- `.github/apis/universalis.md`
- `.github/apis/xivapi.md`

### Spec Snapshot Workflow

See the README section "Universalis Spec Workflow" for the canonical workflow and rationale.

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

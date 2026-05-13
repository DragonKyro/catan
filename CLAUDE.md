# CLAUDE.md

Context for Claude working in this repo.

## What this is

A personal Catan clone with expansion support, hosted on GitHub Pages, played privately with friends. Built because colonist.io paywalls the expansions.

## Tech stack (locked)

TypeScript, Vite, React, hand-rolled SVG for the board, `honeycomb-grid` for hex math, Trystero for WebRTC peer-to-peer multiplayer, Zustand for state, Vitest for tests. No backend — GitHub Pages is static-only.

## Architecture

Three layers, separated by directory:

- **`src/game/`** — pure TypeScript game logic. No React, no DOM, no network imports. All state mutations go through `applyAction(state, action) => state`. Deterministic. Unit-tested.
- **`src/net/`** — Trystero wrapper. Broadcasts actions to peers, applies remote actions, handles room create/join and mid-game rejoin via state snapshot.
- **`src/ui/`** — React components + SVG board. Reads state from `src/store`, dispatches actions via `src/net`.

A Zustand store (`src/store/`) holds the canonical `GameState` shared across all peers, plus UI-only state.

## Expansion model

Each rule set lives as a self-contained module in `src/game/modules/`: base game, Seafarers, Cities & Knights, Traders & Barbarians, Explorers & Pirates. Modules contribute action handlers, initial-state extensions, and (optionally) board generation. The engine composes the active modules at game start.

**No `if (expansion === 'cities')` conditionals scattered through the code.** If you find yourself wanting one, add a module hook instead.

## Multiplayer model

- Full state replication: every peer holds the full `GameState`.
- Actions (not state diffs) are broadcast over the wire.
- Randomness (dice, dev card draws) is decided by the acting player and included in the action payload, so all peers reduce to the same state.
- Rejoin: a returning player reconnects with their persistent UUID; any peer can re-send the state snapshot.
- No anti-cheat — friends-only.

## Non-goals (do not implement)

- Persistent game saves between sessions
- User accounts, matchmaking, lobby browser
- Anti-cheat / verifiable randomness
- Monetization, ads, telemetry
- Server-side anything

## Conventions

- Strict TypeScript. No `any` unless genuinely necessary.
- Co-locate tests next to the code: `engine.ts` and `engine.test.ts` side by side.
- The game logic layer must not import from `src/ui`, `src/net`, or `src/store`.
- The net layer may import from `src/game` but not `src/ui`.
- Path alias: `@/` → `src/`.

## Commands

- `npm run dev` — local dev server at http://localhost:5173/catan/
- `npm run build` — production build (`tsc` typecheck then `vite build`)
- `npm run test` — Vitest watch
- `npm run test:run` — Vitest single run
- `npm run typecheck` — `tsc` (no emit)

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to `main`. The Vite `base` is `/catan/` to match the repo name. If the repo is renamed, update `base` in `vite.config.ts`.

## Where to start next

Phase 0 (scaffold) is complete. Phase 1 — game logic — starts in `src/game/types.ts` (define real `GameState`, `Action`, `Board`) and `src/game/modules/base.ts` (to be created).

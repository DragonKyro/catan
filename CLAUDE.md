# CLAUDE.md

Context for Claude working in this repo.

## What this is

A personal Catan clone with expansion support, hosted on GitHub Pages, played privately with friends. Built because colonist.io paywalls the expansions.

## Tech stack (locked)

TypeScript, Vite, React, hand-rolled SVG for the board, `honeycomb-grid` for hex math, Trystero for WebRTC peer-to-peer multiplayer, Zustand for state, Vitest for tests. No backend — GitHub Pages is static-only.

## Architecture

Four layers, separated by directory:

- **`src/game/`** — pure TypeScript game logic. No React, no DOM, no network imports. All state mutations go through `applyAction(state, action) => state`. Deterministic. Unit-tested.
- **`src/ai/`** — pure heuristic AI. Exports `chooseAction(state, playerId) => Action | null` and `shouldAcceptTrade`. No React or store imports — same purity contract as `src/game/`.
- **`src/net/`** — Trystero/torrent wrapper. Typed channels for hello/lobby/start/action/snapshot/chat, persistent UUID via localStorage, short room codes. Consumed only by `networkStore`.
- **`src/ui/`** — React components + SVG board. Reads state from `src/store`, dispatches actions via the store, hosts the `AIDriver` component that runs AI moves.

Two Zustand stores under `src/store/`:
- `gameStore` — `GameState` + UI mode + dialogs + pendingRobberHex + handoffPending. Exposes `dispatch(action)` (broadcasts) and `applyLocal(action)` (silent, used by network receivers).
- `networkStore` — connection state, role (solo/host/guest/spectator), lobby, chat, online peer tracking. Registers with `gameStore` via `registerBroadcastHandler` to avoid circular imports.

## Expansion model

Each rule set lives as a self-contained module in `src/game/modules/`: base game, Seafarers, Cities & Knights, Traders & Barbarians, Explorers & Pirates. Modules contribute action handlers, initial-state extensions, and (optionally) board generation. The engine composes the active modules at game start.

**No `if (expansion === 'cities')` conditionals scattered through the code.** If you find yourself wanting one, add a module hook instead.

## Multiplayer model

- **Trystero `/torrent`** for WebRTC signaling (BitTorrent trackers). No backend. App ID `catan-friends-v1`; room code doubles as the password for E2E encryption.
- Trystero `peerId` is volatile (Math.random). Stable identity is a `localStorage` UUID (`catan.uuid`), exchanged via the `hello` channel.
- Full state replication: every peer holds the full `GameState`.
- Actions (not state diffs) are broadcast as `{ action, byUuid }` envelopes; receivers verify the UUID owns the action's player seat.
- Randomness (dice, dev card draws) is decided by the acting player and included in the action payload, so all peers reduce to the same state.
- **Lobby** is host-authoritative: host owns `LobbyState`, broadcasts it on changes. Host clicks Start → broadcasts the initial `GameState` via `start`.
- **Rejoin / spectator**: when a peer joins mid-game, the host responds with `snap` (gameState + chat + seatUuids). Newcomer's role: UUID matches a seat → guest; otherwise spectator (read-only).
- **Disconnect**: pause indefinitely. UI shows offline dot + `ConnectionStatusOverlay`. No auto-skip.
- **AI in online**: only the host runs `AIDriver` (`role === 'host' || role === 'solo'`). If host drops, AIs freeze.
- **Chat**: in-memory in `networkStore.chat`, not part of `GameState`. System messages auto-generated on joins/leaves/game-start.
- No anti-cheat — friends-only.

## Trading model

- Bank/port trades (4:1 / 3:1 / 2:1) via `bankTrade` action.
- Player-to-player: open broadcast. `proposeTrade` creates a single `pendingTrade` slot in state; any opponent with the receive-side resources can `acceptTrade` (first acceptor wins). Proposer can `cancelTrade`. Engine auto-cancels on `endTurn`.
- AI auto-evaluates pending trades via `shouldAcceptTrade` (hand-value delta + need-bonus, threshold 0.5).
- `tradesProposedThisTurn` field bounds AI to one proposal per turn (humans unlimited).

## AI model

- Pure heuristic, stateless across turns. Defined in `src/ai/`.
- `chooseAction(state, playerId)` returns the next action or null (meaning "end turn"). The React `AIDriver` component schedules this with ~450 ms delays for visibility.
- Priority tree: city > settlement > devCard > road (only if it opens a vertex score ≥ 4.5) > bank trade > player trade > endTurn.
- Resource weights: ore/wheat 1.3, brick/wood 1.1, sheep 0.9. Tunable in `src/ai/value.ts`.
- One competent difficulty level. No state in the AI; no memory between turns.

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

## Roadmap

- [x] Phase 0 — Project scaffold
- [x] Phase 1 — Game logic engine
- [x] Phase 2 — Hot-seat UI
- [x] Phase 3 — AI + player-to-player trading
- [x] Phase 4 — Online multiplayer + in-game chat
- [ ] Phase 5 — Seafarers expansion
- [ ] Phase 6 — Cities & Knights expansion
- [ ] Phase 7 — Traders & Barbarians expansion
- [ ] Phase 8 — Explorers & Pirates expansion
- [ ] Phase 9 — *Rivals for Catan* (2-player card-game variant)
- [ ] Phase 10 — Rivals: Era of Gold
- [ ] Phase 11 — Rivals: Era of Turmoil
- [ ] Phase 12 — Rivals: Era of Progress
- [ ] Phase 13 — Rivals: Era of Barbarians
- [ ] Phase 14 — Rivals: Era of Merchants

## Where to start next

Phases 0–4 complete. Next is the first expansion module in `src/game/modules/` — start with Seafarers (smallest delta from base). The action union and engine dispatcher are extensible; new actions plug in via a new entry in `modules/base.ts` and (when an expansion lands) a new `RuleModule` file alongside it.

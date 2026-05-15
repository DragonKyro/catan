# CLAUDE.md

Context for Claude working in this repo.

## What this is

A personal Catan clone with expansion support, hosted on GitHub Pages, played privately with friends. Built because colonist.io paywalls the expansions.

## Tech stack (locked)

TypeScript, Vite, React, hand-rolled SVG for the board, `honeycomb-grid` for hex math, Trystero for WebRTC peer-to-peer multiplayer, Zustand for state, Vitest for tests. No backend — GitHub Pages is static-only.

## Architecture

Five layers, separated by directory:

- **`src/game/`** — pure TypeScript game logic. No React, no DOM, no network imports. All state mutations go through `applyAction(state, action) => state`. Deterministic. Unit-tested.
- **`src/ai/`** — pure heuristic AI. Exports `chooseAction(state, playerId) => Action | null`, `shouldAcceptTrade`, `tryCounterTrade`. No React or store imports — same purity contract as `src/game/`.
- **`src/net/`** — Trystero/torrent wrapper. Typed channels for hello/lobby/start/action/snapshot/chat, persistent UUID via localStorage, short room codes. Consumed only by `networkStore`.
- **`src/ui/`** — React components + SVG board. Reads state from `src/store`, dispatches actions via the store, hosts the `AIDriver` component that runs AI moves.
- **`src/rulebook/`** — self-contained rulebook (TSX topics + inline SVG diagrams), rendered either as a full screen from the main menu or inside an overlay via the in-game `?` button.

Three Zustand stores under `src/store/`:
- `gameStore` — `GameState` + UI mode + dialogs + pendingRobberHex + handoffPending. Exposes `dispatch(action)` (broadcasts) and `applyLocal(action)` (silent, used by network receivers).
- `networkStore` — connection state, role (solo/host/guest/spectator), lobby, chat, online peer tracking. Registers with `gameStore` via `registerBroadcastHandler` to avoid circular imports.
- `logStore` — game-event log + per-step timeline snapshots (VP / hand size / cumulative resources gained per player). Populated as a side effect of every successful `dispatch`/`applyLocal`. Lives outside `GameState` so the engine stays deterministic; each peer derives its own log from the actions it sees, so multiplayer needs no extra wire traffic.

## Expansion model

Each rule set lives as a self-contained module in `src/game/modules/`: base game, Seafarers, Cities & Knights, Traders & Barbarians, Explorers & Pirates. Modules contribute action handlers, initial-state extensions, and (optionally) board generation. The engine composes the active modules at game start.

**No `if (expansion === 'cities')` conditionals scattered through the code.** If you find yourself wanting one, add a module hook instead.

## Multiplayer model

- **Trystero `/torrent`** for WebRTC signaling (BitTorrent trackers). No backend. App ID `catan-friends-v1`; room code doubles as the password for E2E encryption.
- Trystero `peerId` is volatile (Math.random). Stable identity is a `localStorage` UUID (`catan.uuid`), exchanged via the `hello` channel.
  - **Local testing escape hatch:** appending `?fresh` to the URL switches identity storage to `sessionStorage` so two windows in the same incognito session (which share `localStorage`) don't collide on the same UUID.
- Full state replication: every peer holds the full `GameState`.
- Actions (not state diffs) are broadcast as `{ action, byUuid }` envelopes; receivers verify the UUID owns the action's player seat.
- Randomness (dice, dev card draws) is decided by the acting player and included in the action payload, so all peers reduce to the same state.
- **Lobby** is host-authoritative: host owns `LobbyState`, broadcasts it on changes. Host clicks Start → broadcasts the initial `GameState` via `start`. Min seats = 3 (Catan official rules); engine still tolerates 2 for tests.
- **Rejoin / spectator**: when a peer joins mid-game, the host responds with `snap` (gameState + chat + seatUuids). Newcomer's role: UUID matches a seat → guest; otherwise spectator (read-only).
- **Disconnect**: pause indefinitely. UI shows offline dot + `ConnectionStatusOverlay`. Multiple peers can map to one UUID (testing); we only emit "disconnected" once the last peer for that UUID leaves.
- **AI in online**: only the host runs `AIDriver` (`role === 'host' || role === 'solo'`). If host drops, AIs freeze.
- **Chat**: in-memory in `networkStore.chat`, not part of `GameState`. System messages auto-generated on joins/leaves/game-start.
- No anti-cheat — friends-only.

## Trading model

- Bank/port trades (4:1 / 3:1 / 2:1) via `bankTrade { give, receive, count? }`. `count` defaults to 1; the engine validates `rate * count` available and `count` available in the bank, so a 3× port trade is one action.
- Player-to-player: open broadcast. `proposeTrade` creates a single `pendingTrade` slot in state; any opponent with the receive-side resources can `acceptTrade` (first acceptor wins). The proposer can `cancelTrade`. Non-proposers can `rejectTrade` (visible on the banner) or `counterTrade` (replaces the pending trade, swapping perspectives). The active turn player may also `cancelTrade` to walk away from a counter. Engine auto-cancels on `endTurn`.
- AI evaluates pending trades via `shouldAcceptTrade` (threshold ~0). If it wouldn't accept, `tryCounterTrade` searches edit-distance-1 tweaks for a counter both sides would tolerate. Otherwise it `rejectTrade`s.
- `AI_PROPOSER_WAIT_MS` (10 s) and a 2.2 s stagger between AI evaluators give the human time to react to an AI offer.
- `tradesProposedThisTurn` bounds AI to 2 proposals per turn (humans unlimited). Counters don't count against the cap.

## AI model

- Pure heuristic, stateless across turns. Defined in `src/ai/`.
- `chooseAction(state, playerId)` returns the next action or null (meaning "end turn"). The React `AIDriver` component schedules this with ~450 ms delays for visibility, and ~10 s for the AI's own pending trades so humans can react.
- Priority tree: city > settlement > devCard > road > bank trade > player trade > endTurn.
- **Road gate**: AI only builds a road when it has zero open settlement vertices reachable through its current road network — otherwise it saves wood/brick for the settlement. Prevents the "road spam, never settles" failure mode.
- **Bank trade aggression**: AI bank-trades whenever it has a clear goal need *or* its hand size ≥ 7 (avoid 7-out losses). The give-side picks the resource with the most "spare" (above goal needs); the receive-side prefers shortfall on the current goal, otherwise the highest-weighted resource we're shortest on.
- Resource weights: ore/wheat 1.3, brick/wood 1.1, sheep 0.9. Tunable in `src/ai/value.ts`.
- One competent difficulty level. No state in the AI; no memory between turns.

## UI conventions

- **Layout**: GameView is a CSS grid — board (top-left), bottom strip (bottom-left, holds `HandPanel` + `ActionBar`), side panel (right, full height, holds `SidePanelTabs` + `OpponentPanel` + `BankPanel`). The right pane's shape is intentionally stable across turns so attention stays on the board.
- **HandPanel viewing rule**: always shows the device-bound human's hand, not the acting player's. In solo this is the last-acknowledged handoff player (falling back to the first non-AI seat); in online it's the local seat. AI hands are never shown — opponents' info lives in `OpponentPanel`.
- **Active turn indicator**: there is no PhaseBanner. Whose turn it is is conveyed by (a) the highlighted row in `OpponentPanel` (`.opp-acting`) when an opponent is acting, and (b) the presence of action buttons in `ActionBar` at the bottom when it's your turn.
- **Docked dialogs (`DialogShell variant="docked"`)** are the default for action prompts (trade, discard, year-of-plenty, monopoly, robber steal). They render in overlay containers inside the board:
  - **Trade overlay (`.gameview-trade-overlay`)** at top-center of the board holds `PendingTradeBanner`, `PlayerTradeDialog`, and `BankTradeDialog`.
  - **Dialog overlay (`.gameview-dialog-overlay`)** at bottom-center of the board (just above the bottom strip) holds the other one-off dialogs.
  - Each container neutralizes the `.dialog-dock` absolute positioning so its child renders in place.
- Use `variant="modal"` for screens that should block (GameOver, rulebook overlay).
- **Player colors** come from `src/ui/shared/playerColors.ts` — `PLAYER_COLORS`, `PLAYER_COLOR_HEX`, `playerColorVar(c)`. Don't duplicate the `PLAYER_COLOR_CSS` map inline; reuse the helper.
- **Game log**: `LogPanel` reads from `logStore.entries`. Steal entries deliberately omit the stolen resource (private info). Trade offers, rejections, cancellations, and per-roll resource gains are NOT logged — only completed trades and the roll itself. This keeps the log focused on outcomes.
- **Match graph**: `MatchGraph` reads `logStore.timeline` (per-step VP / hand size / cumulative resources earned) and `logStore.stats` (dice roll counts, cumulative resources put into circulation by the bank). Tabbed: per-player line charts plus two game-wide bar charts. Embedded in `GameOverDialog`.

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
- `createGame` shuffles `playerOrder` with the seeded RNG by default so signup order doesn't confer a first-player advantage. Tests that depend on `p0` starting pass `randomizeTurnOrder: false`.

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
- [ ] Phase 5 — Base game 5–6 player extension
- [ ] Phase 6 — Seafarers expansion
- [ ] Phase 7 — Seafarers 5–6 player extension
- [ ] Phase 8 — Cities & Knights expansion
- [ ] Phase 9 — Cities & Knights 5–6 player extension
- [ ] Phase 10 — Traders & Barbarians expansion
- [ ] Phase 11 — Traders & Barbarians 5–6 player extension
- [ ] Phase 12 — Explorers & Pirates expansion
- [ ] Phase 13 — Explorers & Pirates 5–6 player extension
- [ ] Phase 14 — *Rivals for Catan* (2-player card-game variant)
- [ ] Phase 15 — Rivals: Era of Gold
- [ ] Phase 16 — Rivals: Era of Turmoil
- [ ] Phase 17 — Rivals: Era of Progress
- [ ] Phase 18 — Rivals: Era of Barbarians
- [ ] Phase 19 — Rivals: Era of Merchants

## Where to start next

Phases 0–4 complete. Next is the first expansion module in `src/game/modules/` — start with Seafarers (smallest delta from base). The action union and engine dispatcher are extensible; new actions plug in via a new entry in `modules/base.ts` and (when an expansion lands) a new `RuleModule` file alongside it.

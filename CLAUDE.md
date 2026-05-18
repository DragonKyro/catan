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
- `gameStore` — `GameState` + UI mode + dialogs + pendingRobberHex + handoffPending + `lastActionSnapshot` (game+logStore pair captured for the last reversible action). Exposes `dispatch(action)` (broadcasts) and `applyLocal(action)` (silent, used by network receivers). `undo()` restores both `game` and `logStore` from the snapshot; solo/hot-seat only, fires only on the last `buildRoad` / `buildSettlement` / `buildCity` / `buyDevCard` / `bankTrade`.
- `networkStore` — connection state, role (solo/host/guest/spectator), lobby, chat, online peer tracking. Registers with `gameStore` via `registerBroadcastHandler` to avoid circular imports.
- `logStore` — game-event log + per-step timeline snapshots (per-player VP / handTotal / gainedTotal / gainedByResource / knightsPlayed / longestRoadLength / tradesCount / tradesGiven / tradesReceived, plus `turnNumber`), match stats (roll counts + resourcesInCirculation), and the full `actions: Action[]` + initial `GameState` so the end-game replay can rebuild any historical step. Populated as a side effect of every successful `dispatch`/`applyLocal`. Exposes `snapshot()`/`restore()` so `gameStore.undo()` can keep the two stores in sync. Lives outside `GameState` so the engine stays deterministic; each peer derives its own log from the actions it sees, so multiplayer needs no extra wire traffic. Turn numbering is revolution-based: a turn ticks over only when the table cycles back to the first player in `playerOrder`. For 5+ players the paired-player rule means two seats act per paired turn, but only the second `endTurn` advances `turnHolderIndex`, so the counter still ticks once per paired turn rather than per acting seat.

## Expansion model

Each rule set lives as a self-contained module in `src/game/modules/`: base game, Seafarers, Cities & Knights, Traders & Barbarians, Explorers & Pirates. Modules contribute action handlers, initial-state extensions, and (optionally) board generation. The engine composes the active modules at game start.

**No `if (expansion === 'cities')` conditionals scattered through the code.** If you find yourself wanting one, add a module hook instead.

## Board scenario system

Modular layout types live in `src/game/board/scenarioTypes.ts` (`ScenarioPosition`, `ScenarioPortAnchor`, `ScenarioPools`, `ScenarioLayout`), shared materializer in `src/game/board/layoutMaterializer.ts`, and assembly helper in `src/game/board/scenarioAssembly.ts`. Both Seafarers and base-game scenarios feed through these.

- **Base scenarios** (`src/game/modules/base/scenarios/`): the colonist.io-style Fun Maps. `BaseScenario` records each declare optional `layout3p` / `layout4p` / `layout5_6p` plus optional volcano metadata. `Standard` is the sentinel — no layout, falls through to the legacy hardcoded `generateBoard()` so the default new-game flow is bit-for-bit unchanged.
- **Seafarers scenarios** (`src/game/modules/seafarers/board/scenarios/`): the 9 official scenarios. Same modular layout machinery + Seafarers-specific fields (`fogHexes`, `tribeTokens`, `pirateFleet`, `clothHexes`).
- **createGame routing**: if Seafarers is on → `generateSeafarersBoard`; else if `baseScenarioId !== 'standard'` → `generateBaseScenarioBoard`; else → legacy `generateBoard`.

`ScenarioPosition` extensions: `fixedTerrain` pins terrain (Black Forest's fixed wood); `forceToken` joins a desert position to the token pool (Volcano's desert-with-a-number); `fixedToken` pins an exact number on a position (Volcano pinned to 6). `ScenarioLayout.tokenConstraints.allow6_8Adjacent` relaxes the no-adjacent-reds retry (Black Forest).

## Base-game Fun Maps

The colonist.io-style maps live as `BaseScenario` entries; pick from the **Base map** dropdown on the New Game screen.

- **Gold Rush** — 2 gold fields (3 at 5-6p) mixed into the terrain pool. Uses the existing Seafarers-engine gold flow (settlement adjacent to gold = pick any resource on production).
- **Volcano** — center hex is a fixed desert with a pinned 6 token. Setup blocks placement on volcano-adjacent vertices. When the volcano's number rolls, `maybeEruptVolcano` in `src/game/actions/dice.ts` picks a random occupied adjacent corner using seeded `state.rngState` and destroys/downgrades the building inline (no separate action — peers reduce identically). Log entry: `volcanoEruption` with 🌋 prefix, derived in `logStore.record` by diffing settlement/city counts on volcano corners. AI gets a `-3.5` penalty for volcano-adjacent vertices in `vertexScore`. UI: `src/ui/game/base/VolcanoMarker.tsx`.
- **Black Forest** — 5 fixed-wood interior hexes; `tokenConstraints.allow6_8Adjacent: true` so a dense red cluster can land anywhere.
- **Diamond / Gear / Lakes / Pond / Twirl** — pure shape variants (16-hex rhombus, 13-hex gear, 3 interior lakes, 1 center sea, 21-hex spiral). No new mechanics — the engine handles interior sea hexes for free (the distance rule across narrow lakes already works via the hex graph adjacency).

Seafarers wrapper pattern: `src/game/modules/seafarers/actions/` contains thin wrappers around the base `buildSettlement` / `placeInitialSettlement` / `buildRoad` / `placeInitialRoad` handlers. The wrappers call the base, then run scenario-specific post-build hooks (`claimIslandChips`, `claimTribeTokens`, `revealAdjacentFog`). `buildShip`, `moveShip`, `buildWonder`, `attackPirateFleet`, `chooseGoldResource`, robber/pirate-choice, and `movePirate` are Seafarers-native handlers without a base counterpart. The dispatcher in `src/game/modules/seafarers/index.ts` routes only those action types — everything else falls through to the base module.

## Seafarers scenario mechanics

Every official scenario has its rulebook headline mechanic wired up. Mechanics are configured per-scenario via fields on `Scenario` (see `src/game/modules/seafarers/board/types.ts`); the engine reads optional `state` fields the generator populates from the scenario.

- **Heading for New Shores / New World / Four Islands** — outer-island chips (`state.islandChips`). First settler on a non-main island earns the chip VP. Four Islands sets `startingPlacementZone: 'anyIsland'` so first settlements aren't restricted to the main island.
- **Through the Desert** — `desertIsBoundary: true` makes `identifyIslands` treat desert hexes as boundaries; the far side becomes a separate outer island and earns a chip.
- **Fog Island** — `fogHexes` populate `state.unrevealedFogHexes`. `revealAdjacentFog(state, hexIds, playerId)` in `seafarers/actions/fog.ts` fires from every build wrapper; resource hexes grant +1 from the bank, gold hexes stack picks into `goldChoiceState` (with `returnTo` honoured so setup-round-2 fog gold still drops back into the setup road step), desert/sea reveal silently. The helper is the single source of truth — all four build paths call it.
- **The Forgotten Tribe** — `tribeTokens` produce `state.tribeTokens` claimed via the settlement wrapper. Three effect types: `devCard` (draws from `devCardDeck` into `boughtThisTurn`), `victoryPoint` (visible +1 via `calculateTribeTokenVp`), `commercialHarbor` (`player.commercialHarbors++`, floors bank trade rate at 2:1 — see `getBankTradeRate` in `actions/trade.ts`).
- **Pirate Islands** — `pirateFleet` becomes `state.pirateFleet` (hexId + strength + maxStrength + defeatedBy). New action `attackPirateFleet`: requires an adjacent ship, capped at once per turn via `state.attackedPirateThisTurn` (cleared on `endTurn`). On strength → 0 the player earns +2 VP via `calculatePirateFleetVp`. Independent of the regular movable pirate token (`board.pirateHex`).
- **Cloth for Catan** — `clothHexes` produce `state.clothHexes`. The dice handler (`actions/dice.ts`) diverts production: rolling a cloth hex's number grants `player.cloth` instead of the listed terrain's resource (1 per settle, 2 per city). `calculateClothVp = floor(cloth / 2)`.
- **The Wonders of Catan** — `state.wonders` seeded at level 0 for every entry in `WONDERS` catalogue (`src/game/modules/seafarers/wonders/catalogue.ts`). New action `buildWonder` validates phase, current player, prereq (`prereqMet(state, playerId)`), cost, claim status, and max level. **Completing a wonder is an instant win** — the handler sets `winner` + `phase: 'gameOver'` directly, bypassing the normal VP check.

Each scenario also carries `defaultVpToWin` (3-4p) and optional `defaultVpToWin5_6` (5-6p larger board). `createGame`'s VP target precedence: explicit override > scenario default > player-count default.

## Scenario tracker UI

`src/ui/panels/ScenarioPanel.tsx` is a single component that renders all active scenario state: chip claims, fog revealed/total, tribe tokens with type+claimer, wonder levels+claimer, pirate-fleet strength+defeater, per-player cloth counts. `hasScenarioTracker(game)` returns true iff any of these are populated; `SidePanelTabs` uses it to decide whether to render the "Scenario" tab alongside Log/Chat. Player badges in `HandPanel` and `OpponentPanel` also show `🏝 +N` (chip VP) and `🧵 N` (cloth) when nonzero. Board-level markers live in `src/ui/game/seafarers/`: `TribeTokenMarker`, `PirateFleetMarker`, `ClothHexMarker`, plus the existing `PirateMarker` and `Ship`. `HexTile` accepts a `foggy` prop that hides the terrain motif and number token under a cloud.

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
- Priority tree: city > settlement > devCard > road > favorable player trade (2:1) > bank trade > generic player trade > endTurn. Favorable player trade fires before bank to prefer mutually-good 2:1 swaps over throwing cards to the bank.
- **Win plans (`src/ai/winPaths.ts`)**: six encoded 10-VP templates (cityArmy, cityRoad, cityBothBonuses, sprawlRoad, sprawlBoth, maxBuild). `chooseWinPlan` scores each by `estResourceCost + productionMismatch` and returns the cheapest reachable plan; the rest of the AI consults `gap.newSettlementsNeeded` etc. to pick thresholds.
- **Threat model (`src/ai/threats.ts`)**: `assessThreats(state)` flags each opponent as `closeToWin` (within 2 VP), `closeToLargestArmy` (knights ≥ max(currentLA, 2)), `closeToLongestRoad` (road length ≥ 4), and records the resources that advance their next VP step (`dangerousResources`). Consumed by trade scoring (refuse swaps that hand a threat the win), robber placement, and steal-target selection.
- **Trade hygiene**: `tradeResourcesThisTurn` on `GameState` logs which resources each player has given/received via completed trades this turn. The AI uses it to skip reverse trades (don't give what you just received) and roundabout trades (don't receive then immediately re-give). Cleared on real turn advance.
- **Dev-card gate**: AI skips a dev card if it could instead settle now, finish a settle with one more resource, or unlock a settle spot with one road. Dev cards are slow VP; expansion compounds.
- **Road gate**: builds only when (a) no reachable open settle spot AND target endpoint scores `≥ ROAD_TARGET_THRESHOLD` (default 4.5, dropped to 3.5 when the active win plan needs more settlements), or (b) pursuing Longest Road (within 2 of claim length — threshold drops to 1.5). Contested-endpoint penalty (-2 per enemy road touching the target vertex) keeps the AI from racing into spots opponents can settle first.
- **Bank trade aggression**: bank-trades only when (1) we have a concrete build goal AND a specific shortfall, or (2) hand size ≥ 8 (next 7 would force a discard). The give-side picks a resource we have spare (above goal needs); receive-side prefers shortfall on the active goal.
- Resource weights: ore/wheat 1.3, brick/wood 1.1, sheep 0.9. Tunable in `src/ai/value.ts`. Gold weighted 1.6 (above any single resource — reflects the choice-of-resource on production) plus a flat +1 per gold hex bonus in `vertexScore` (smooths bad-luck spells).
- Port valuation: 2:1 of a resource we produce here = 3.5, of a resource we produce elsewhere = 2.5, of one we don't produce = 1.2; generic 3:1 = 1.5.
- **Outer-island bonus**: `vertexScore` adds `chip.vp * 3` per unclaimed-outer-island chip the vertex touches. A 2-VP chip = +6 score (comparable to a strong missing-resource bonus); enough to pull the AI off the main island when ships open the path.
- **Ship building** (`src/ai/seafarers/ships.ts`): Seafarers-only step in the priority tree between settlement and road. `tryBuildShip` scores each buildable ship edge by the destination vertex's `vertexScore` (which already bakes in chip + gold) plus a +1.5 connector bonus for ships one hop from an unclaimed chip, plus a +6.0 fleet-attack bonus when the edge would put us adjacent to the alive pirate fleet for the first time. Same loop/dead-end/threshold gating as the road heuristic.
- **Scenario-aware vertex scoring** (`src/ai/value.ts`): `vertexScore` also adds bonuses for (a) unclaimed Forgotten Tribe tokens at adjacent hexes (`victoryPoint` +3.0, `commercialHarbor` +2.5, `devCard` +1.5), (b) unrevealed fog hexes (+1.0 each — one-shot free resource on reveal), and (c) cloth-producing hexes (replaces the underlying resource value with `pips × 0.7 + 1.5` because cloth converts directly to VP). This is what makes the AI prefer a vertex on a Cloth/Tribe/Fog island over a vanilla one of equal pips.
- **Pirate Islands action** (`src/ai/seafarers/pirateFleet.ts`): `tryAttackPirateFleet` fires at priority 0.5 (after dev-card play, before any resource-spending step). Costs nothing, +2 VP on the killing blow, capped at once per turn by the engine. The ship heuristic already routes ships toward the fleet hex.
- **Wonders of Catan action** (`src/ai/seafarers/wonders.ts`): `tryBuildWonder` runs in two passes — instant-win-only at priority 0.75 (before city, since completing a wonder wins immediately) and any-level at priority 3.5 (between road and dev card). Picks a wonder we already meet the prereq for and can afford; favors the one with the most levels already built (commitment), then the most affordable from current hand, then the one fewest opponents could race us on.
- One competent difficulty level. No state in the AI; no memory between turns (per-turn trade history lives on `GameState`, not the AI).

## UI conventions

- **Layout**: GameView is a CSS grid — board (top-left), bottom strip (bottom-left, holds `HandPanel` + `ActionBar`), side panel (right, full height, holds `SidePanelTabs` + `OpponentPanel` + `BankPanel`). The right pane's shape is intentionally stable across turns so attention stays on the board.
- **Board rendering**: `BoardSVG` is a pure presentational component that takes `game: GameState` as a prop (plus an optional `overlay`). Live play uses `Board.tsx` (a thin wrapper that reads from the store and adds `<PlacementOverlay />`); the end-game replay reuses `BoardSVG` directly with a reconstructed historical state. Sub-components (`HexTile`, `Settlement`, `City`, `Road`, `Ship`, `PortMarker`, `Robber`, `PirateMarker`) take their `BoardState` via prop rather than via `useGameStore`, so they're agnostic to whether they're rendering live or historical state.
- **HandPanel viewing rule**: always shows the device-bound human's hand, not the acting player's. In solo this is the last-acknowledged handoff player (falling back to the first non-AI seat); in online it's the local seat. AI hands are never shown — opponents' info lives in `OpponentPanel`. All-AI games are an exception: with no human seat, HandPanel shows the *acting* AI's hand (so spectators can follow).
- **OpponentPanel ordering**: iterates `game.playerOrder`, not `game.players`. Seat-join order is meaningless during play; turn order is what matters at-a-glance.
- **Active turn indicator**: there is no PhaseBanner. Whose turn it is is conveyed by (a) the highlighted row in `OpponentPanel` (`.opp-acting`) when an opponent is acting, and (b) the presence of action buttons in `ActionBar` at the bottom when it's your turn.
- **ActionBar extras**: shows a `↶ Undo` button (solo/hot-seat, only when `lastActionSnapshot` is set), a `Costs` button that opens the `CostCheatsheet` popover, and hover tooltips on each build button with the resource cost. For 5+ players the paired-player rule applies: when the acting seat is Player 2 (third seat to Player 1's left), the trade button collapses to a 🏦 Bank trade entry — player-to-player trades are gated off at the engine level.
- **Hover ghost (build mode)**: `PlacementOverlay` lifts hover state for vertices / edges. The hovered ghost layers a faint full-shape silhouette (`SETTLEMENT_PATH_D` / `CITY_PATH_D` / road line) in the acting player's color underneath the dashed validity outline.
- **Docked dialogs (`DialogShell variant="docked"`)** are the default for action prompts (trade, discard, year-of-plenty, monopoly, robber steal). They render in overlay containers inside the board:
  - **Trade overlay (`.gameview-trade-overlay`)** at top-center of the board holds `PendingTradeBanner`, `PlayerTradeDialog`, and `BankTradeDialog`.
  - **Dialog overlay (`.gameview-dialog-overlay`)** at bottom-center of the board (just above the bottom strip) holds the other one-off dialogs.
  - Each container neutralizes the `.dialog-dock` absolute positioning so its child renders in place.
- Use `variant="modal"` for screens that should block (GameOver, rulebook overlay).
- **Player colors** come from `src/ui/shared/playerColors.ts` — `PLAYER_COLORS`, `PLAYER_COLOR_HEX`, `playerColorVar(c)`. Don't duplicate the `PLAYER_COLOR_CSS` map inline; reuse the helper. There are 10 colors; the new-game seat editor (`NewGame.tsx`) lets each seat pick one independently. Conflict resolution: if seat X picks the color seat Y already has, seat Y swaps to X's old color so all seats remain unique without any disable-locking dance.
- **Clocks**: `GameClock` (top of the board, runs from game start) shows total wall-clock time; `TurnTimer` shows the active player's countdown when `settings.turnTimerSec > 0`. When the per-turn timer hits zero the UI auto-finishes any committed sub-phase (discard / robber move / etc.) using AI defaults, then dispatches `endTurn`. AI seats ignore the timer — they pace themselves via `AIDriver` (~450 ms per micro-step; ~10 s on the AI's own pending trade so a human can respond).
- **Game log**: `LogPanel` reads from `logStore.entries`. Steal entries deliberately omit the stolen resource (private info). Trade offers, rejections, cancellations, and per-roll resource gains are NOT logged — only completed trades and the roll itself. Revolution-based turn markers (`── Turn N ──`) tick over when the table cycles back to the first player in `playerOrder`. For 5+p paired turns the P1→P2 hand-off doesn't increment the counter; only the P2→next-P1 transition does. Auto-scroll only fires when the user is already at the bottom (`wasAtBottomRef`); chat has the same behavior.
- **Match graph**: `MatchGraph` reads `logStore.timeline` (per-step `vp`, `handTotal`, `gainedTotal`, `gainedByResource`, `knightsPlayed`, `longestRoadLength`, `tradesCount`, `tradesGiven`/`tradesReceived`, plus `turnNumber`) and `logStore.stats` (roll counts, resourcesInCirculation). Tabbed line charts (VP, resources earned, hand, knights, longest road, trades count, trade efficiency, by-player, by-resource) plus two game-wide bar charts (dice frequency, circulation). X-axis is labeled in turn numbers (thinned to ~10 labels); hover snaps to the nearest timeline step and shows an x-unified crosshair + tooltip including `Turn N · step M`. Embedded in `GameOverDialog`, which also offers a `Replay` tab.
- **Replay**: `Replay.tsx` plays the finished game forward. It steps through a filtered list of *board-changing* actions (builds, ships, robber/pirate moves, dev-card plays) while reconstructing `replayState` from the full action list, so resources/VPs stay correct even though rolls / trades / end-turns aren't stops on the slider.

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
- [x] Phase 5 — Base game 5–6 player extension
- [x] Phase 5b — Base game 7–8 player extension (unofficial; 37-hex board, scaled bank + dev deck, VP target stays at 10)
- [x] Phase 6 — Seafarers expansion (9 official scenarios, each with rulebook headline mechanic wired up — see "Seafarers scenario mechanics" above)
- [x] Phase 7 — Seafarers 5–6 player extension (all 9 scenarios ship a `layout5_6p` matching the 5-6p rulebook's component counts; per-scenario `defaultVpToWin5_6` applies when player count ≥ 5. The rulebook's "Six Islands" scenario is implemented as Four Islands' 5-6p geometry — same scenario id, geometry swaps based on player count. All 5-6p layouts fit the radius-4 hex disk (61 hexes total). Visual position verification against [docs/.scenario-renders/seafarers-56-*.png] is still pending; pool counts match rulebook exactly)
- [x] Phase 7c — Base-game colonist.io Fun Maps (Gold Rush, Volcano, Black Forest, Diamond, Gear, Lakes, Pond, Twirl). Selectable from a base-map dropdown alongside Standard. Gold Rush + Pond ship 5-6p; the rest are 3-4p only. Volcano implements full eruption rules (setup-block on volcano-adjacent vertices, inline destruction on the volcano's number roll, AI penalty, rulebook entry). Rulebook now has a search bar.
- [ ] Phase 7b — Seafarers 7–8 player extension (no official version exists; would need per-scenario 7–8 boards. Currently the engine rejects Seafarers + >6 players via `createGame`. Re-evaluate after Phase 7)
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

Phases 0–7 and 5b complete; all 9 Seafarers scenarios support 3–6 players. The 5-6p geometries are approximations of the rulebook layouts (positions are roughly correct, component counts match exactly); a useful follow-up is visual verification against `docs/.scenario-renders/seafarers-56-*.png` and tightening hex positions to match the diagrams.

Two smaller follow-ups worth doing soon:
- **Phase 7b — Seafarers 7–8 player extension**: no official version exists. The engine currently rejects Seafarers + >6 players via `createGame`. Would need per-scenario 7–8 boards.

Then **Phase 8 — Cities & Knights** as a new module under `src/game/modules/`. The action union and engine dispatcher are already extensible; new actions plug in via a new entry in their module file alongside the existing `seafarers/` and `base/` modules.

## Token distribution rule

Every layout's number tokens are **symmetric around 7**: `count(N) == count(14-N)`. This mirrors dice symmetry (P(2) = P(12), P(3) = P(11), etc.). For odd-total layouts where strict symmetry is impossible, the smallest possible asymmetry (1) is placed on the rarest pair (2/12 or 3/11) so the most-common 6/8 stay balanced.

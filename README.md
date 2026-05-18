# Catan

A web-based clone of *Settlers of Catan* with expansion support, built for private play with friends.

The popular online version (colonist.io) paywalls the expansions; this is a free reimplementation hosted on GitHub Pages.

**🎲 Play it:** https://dragonkyro.github.io/catan/

## Features

### Playable today

**Base game** — 3–8 players. 3–6 official; 7–8 is an unofficial extension modeled on colonist.io's: 37-hex board, scaled bank (24 per resource) and dev deck (35 cards), 2022 paired-player turn rule across all 5+ player counts.

**Fun Maps** — eight colonist.io-style base-game variants, selectable from a **Base map** dropdown on the new-game screen:

- **Gold Rush** — two or three gold fields mixed into the terrain pool; settlements next to one pick any resource on every production roll
- **Volcano** — center hex is a volcano (pinned to roll a 6); when its number comes up, one random adjacent settlement is destroyed and any adjacent city downgrades to a settlement. Setup placement next to the volcano is forbidden
- **Black Forest** — five fixed-position forest (wood) hexes anchor the middle; the usual no-adjacent-reds rule is relaxed so a dense 6/8 cluster can land anywhere
- **Diamond** — 16-hex rhombus shape; smaller and tighter than standard
- **Gear** — 13-hex gear with six "teeth" sticking out around a 7-hex core; one port per tooth
- **Lakes** — standard outline with three interior lakes that roads have to route around
- **Pond** — single sea hex dead-center
- **Twirl** — 21-hex spiral; standard hexagon with a two-hex tail twisting off one corner

Gold Rush and Pond ship 5–6 player layouts in addition to 3–4; the rest are 3–4 player only for now.

**Seafarers expansion** — 9 official scenarios, every one with its rulebook headline mechanic wired up:

- **Heading for New Shores** — main island + outer islands with gold hexes and settlement-bonus chips
- **Four Islands** — no main island; ships from turn one; starting settlements legal anywhere
- **Through the Desert** — desert hexes act as island boundaries, so settling past the desert earns an outer-island chip
- **New World** — random map for variety
- **Fog Island** — outer hexes start hidden under fog; revealed (and rewarded) by adjacent builds
- **The Forgotten Tribe** — outer islets carry one-shot tokens: dev cards, +VP, and commercial harbors (2:1 any resource)
- **Pirate Islands** — an enemy fleet on a sea hex you attack with adjacent ships; killing-blow earns +2 VP
- **Cloth for Catan** — designated hexes produce cloth tokens instead of resources; 2 cloth = 1 VP
- **The Wonders of Catan** — 5 prerequisite-gated wonders with 4 levels each; **first to finish any wonder wins immediately** regardless of VP

### Notable mechanics

- **Online multiplayer with no backend.** WebRTC peer-to-peer over Trystero (BitTorrent-tracker signaling). Create a room, share a 4-character code, friends join. Full state replication; randomness baked into actions so all peers reduce to the same state. Drop out and rejoin mid-game with the same code — your seat is preserved via `localStorage` UUID. Late joiners without a saved UUID become read-only spectators.
- **End-of-game match graph.** Tabbed line charts (VP, resources earned per-player and per-resource, hand size, knights, longest road, trade count, trade efficiency) and bar charts (dice frequency, cumulative bank circulation). Hover snaps to the nearest timeline step with an x-unified crosshair; x-axis is labeled in turn numbers.
- **End-of-game replay.** Scrub through your finished game step by step, or auto-play at 0.5×–4×. Slider stops only on board-changing actions; rolls and trades fold in but skip.
- **Heuristic AI with encoded win plans.** Six 10-VP templates (city+army, sprawl+road, etc.); AI scores each by resource cost + production mismatch and picks the cheapest reachable plan. Threat model flags opponents close to win, longest road, or largest army, and refuses trades that hand them the resource they need. In Seafarers it values outer-island chip VP, weights gold above any single resource, and builds ships toward unclaimed chips.
- **Scenario progress tracker.** When a Seafarers scenario has live state (chips, fog, tribe tokens, wonder levels, pirate fleet, cloth), a "Scenario" side tab appears with everything-at-a-glance. Player badges in the hand/opponent panels mirror it (`🏝 +N`, `🧵 N`, `X/N VP`).
- **Pass-device hot-seat.** In local games with multiple humans, an explicit handoff screen hides resource hands and unplayed dev cards between turns. AI hands stay face-down (counts visible, types hidden).
- **Self-contained rulebook with search.** Paginated by topic with inline SVG diagrams; per-scenario explainers cover the actual implemented mechanic for each Seafarers scenario and base-game Fun Map, including its win target. A search box filters topics by title and body text in real time so you can find a specific rule without scrolling.

### Testing online multiplayer locally

Two browser windows in the same incognito session share `localStorage`, which gives them the same identity UUID and breaks seat assignment. Append `?fresh` to the URL of each test window to force a per-tab UUID via `sessionStorage` instead.

## Tech stack

- **TypeScript** + **Vite** + **React**
- **SVG** for the board (hand-rolled, no Canvas)
- **honeycomb-grid** for hex math
- **Zustand** for state management
- **Vitest** for tests
- **Trystero** (BitTorrent-tracker signaling) for WebRTC peer-to-peer multiplayer

## Local development

```sh
npm install
npm run dev        # http://localhost:5173/catan/
npm run test       # Vitest watch mode
npm run test:run   # Vitest single run
npm run build      # Production build to dist/
npm run typecheck
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages.

## Roadmap

- [x] Phase 0 — Project scaffold
- [x] Phase 1 — Game logic engine (base rules, tests)
- [x] Phase 2 — Hot-seat UI (SVG board, panels, dialogs)
- [x] Phase 3 — AI opponents + player-to-player trading
- [x] Phase 4 — Online multiplayer (Trystero peer-to-peer) + in-game chat
- [x] Phase 5 — Base game 5–6 player extension
- [x] Phase 5b — Base game 7–8 player extension (unofficial; 37-hex board, scaled bank + dev deck, VP target stays at 10)
- [x] Phase 6 — Seafarers expansion (9 official scenarios, each with its rulebook headline mechanic — see Features)
- [x] Phase 7 — Seafarers 5–6 player extension (all 9 scenarios have a `layout5_6p` matching the 5-6 player rulebook's component counts; the rulebook's "Six Islands" scenario is implemented as Four Islands' 5-6p geometry. Hex positions are approximate, pending visual verification against [docs/.scenario-renders/seafarers-56-*.png])
- [x] Phase 7c — Base-game colonist.io Fun Maps: Gold Rush, Volcano, Black Forest, Diamond, Gear, Lakes, Pond, Twirl. Selectable from a base-map dropdown alongside Standard. Volcano implements full eruption rules (setup block, inline destruction on roll, AI penalty, dedicated rulebook entry). Gold Rush and Pond ship 5-6p layouts; the rest are 3-4p
- [ ] Phase 7b — Seafarers 7–8 player extension (no official version exists; engine currently rejects Seafarers + >6 players. Revisit after Phase 7)
- [ ] Phase 8 — Cities & Knights expansion
- [ ] Phase 9 — Cities & Knights 5–6 player extension
- [ ] Phase 10 — Traders & Barbarians expansion
- [ ] Phase 11 — Traders & Barbarians 5–6 player extension
- [ ] Phase 12 — Explorers & Pirates expansion
- [ ] Phase 13 — Explorers & Pirates 5–6 player extension
- [ ] Phase 14 — *Rivals for Catan* (2-player card-game variant)
- [ ] Phase 15 — Rivals expansion: Era of Gold
- [ ] Phase 16 — Rivals expansion: Era of Turmoil
- [ ] Phase 17 — Rivals expansion: Era of Progress
- [ ] Phase 18 — Rivals expansion: Era of Barbarians
- [ ] Phase 19 — Rivals expansion: Era of Merchants

**Beyond the expansion roadmap:**
- Post-game AI analysis — highlight likely misplays from the action log (held wood+brick instead of building; bank-traded into a 7-out; settled on a sub-optimal vertex)

**Fun map ideas (not yet implemented):**

*Shape-only variants (cheap to ship — just position arrays):*

- [ ] Crescent / Moon — C-shaped board with no center hex; inside-curve vertices become premium
- [ ] Continental Divide — long narrow board with a desert/mountain spine; crossing the divide is expensive but cuts trade distance
- [ ] Hourglass / Bottleneck — two clusters joined by a 1–2 hex bridge; chokepoint warfare
- [ ] Single-Resource Regions — 5 small islands (or zones), each producing exactly one resource; trade isn't optional
- [ ] Pinwheel — 4 short spokes of 2–3 hexes radiating from a center hex; tight, fast games
- [ ] Cross / Plus — 4 arms; territorial control by arm
- [ ] Y-shape — 3 elongated arms; port-rich, encourages naval play with Seafarers

*Resource-themed mechanics:*

**Water / sea:**

- [ ] Tides — half the tokens are "high tide" (produce on odd turns), other half "low tide" (even turns); forces a balanced mix of both
- [ ] Whirlpool / Maelstrom — designated sea hex; ships ending a turn adjacent get pulled in and destroyed (with Seafarers); without ships, blocks port adjacency
- [ ] Tidal Wave — on a rare roll, one coastal settlement (chosen by RNG) is destroyed; cities downgrade

**Desert:**

- [ ] Wandering Desert / Sandstorm — desert shifts to an adjacent hex on certain rolls; predictable but unavoidable
- [ ] Oasis — desert ring around a fertile center; one "oasis" hex inside the ring acts as a 2:1 port for any resource

**Wood (forests, logging, wildlife):**

- [ ] Forest Fire — designated wood hex stops producing for N rolls after a pinned trigger; cascades if two burn at once
- [ ] Logging Camp — wood hex yields +1 wood for its first 5 rolls, then permanently becomes a desert (clear-cut); race to plant on it early
- [ ] Old-Growth Forest — designated wood hex worth +1 VP to whoever first settles adjacent (Forgotten-Tribe-style chip restricted to wood theme)
- [ ] Regrowth / Sapling — clear-cut wood-hexes-turned-desert (from Logging Camp or Forest Fire) regrow back into wood hexes after N rolls; cycle continues
- [ ] Sawmill — adjacent settlement gets a passive 2 wood → 1 of anything trade once per turn; wood becomes a soft currency
- [ ] Druid's Grove — designated wood hex blocks the robber from ever sitting on it; one "safe" production hex
- [ ] Charcoal Pit — settlement adjacent to BOTH a wood and an ore hex gets +1 of either per roll
- [ ] Treeline — wood hexes can't be upgraded to cities (only settlements); forces sprawl over densification
- [ ] Deer Migration — wildlife token moves through wood hexes each turn; settlement adjacent at the right moment gets a free wood

**Ore (mountains, caves, mines):**

- [ ] Avalanche — Volcano's sibling: ore hex destroys/downgrades a random adjacent building on its pinned roll
- [ ] Mountain Pass — contiguous ore ridge acts as a wall; roads can't cross between ore-hex edges except through 1–2 marked "pass" edges
- [ ] Cave / Tunnel Network — designated ore hexes are connected by hidden tunnels; a road on a tunnel edge gives a free road on a far-side ore hex
- [ ] Cave-in — on every 7 roll (in addition to the robber), one ore hex stops producing for 3 rolls
- [ ] Mountain Echo — when an ore hex rolls, ALL ore-adjacent settlers also get +1 ore (resonance); massive city-build buff
- [ ] Gold Vein — designated ore hex doubles as a gold field 1-in-3 rolls (seeded RNG); commit-with-variance

**Sheep (pasture, wildlife):**

- [ ] Wolves — wolf token sits on a sheep hex and disables production; moves on pinned rolls or via a new shepherd mini-action
- [ ] Migration / Flock Rotation — sheep hexes rotate which one is "currently grazed" each turn; only the active sheep hex produces (double); others produce nothing
- [ ] Sheep Market / Festival — designated festival hex lets adjacent settlers spend 1 sheep for 1 of anything, once per turn; sheep becomes soft currency
- [ ] Wool Boom — sheep hexes produce 2 instead of 1 on a pinned trigger roll; compensates sheep's natural weakness without changing the rest of the game
- [ ] Plague — if any player ends turn holding >6 sheep, they discard half; encourages sheep throughput, punishes hoarders

**Brick (clay, kilns, quarries):**

- [ ] Quarry — designated brick hex gives adjacent settlers +1 brick on its first N rolls, then depletes into a desert
- [ ] Kiln — designated brick hex acts as a passive 2 brick → 1 anything trade post; brick becomes a currency hex
- [ ] Brickworks — settlements adjacent to a brickworks hex pay 1 less brick on all road builds; Longest Road buff
- [ ] Mudslide — on a pinned roll, one brick hex floods and produces nothing for the next 4 rolls; roads adjacent can't be built that turn
- [ ] Adobe — settlements on brick hexes are immune to robber/knight steals; brick hexes become safe-haven properties

**Wheat (farms, weather):**

- [ ] Drought — at game start, one "drought roll" is chosen (e.g., 4 or 5); on that roll, ALL wheat hexes are blocked for one turn
- [ ] Locust Swarm — locust token disables one wheat hex at a time, moving clockwise on even rolls in a predictable patrol pattern
- [ ] Harvest Festival — every 8 turns, the player with the most wheat-adjacent settlements gets +1 VP (caps at +3 over a game)
- [ ] Granary — designated wheat hex with a granary token; adjacent player can stockpile up to 3 wheat that doesn't count toward 7-discard limits
- [ ] Crop Rotation — wheat hexes have hidden secondary terrains and flip every 5 turns (e.g., wheat ↔ sheep)
- [ ] Vineyard Upgrade — players can spend 2 wheat + 1 ore at any wheat hex they're adjacent to, permanently upgrading it to produce 2 wheat per roll

*General / cross-resource mechanics:*

- [ ] Earthquake — on every roll of a pinned number, two random tokens swap via seeded RNG; production geography becomes unstable
- [ ] Bandit Camp — second robber-like figure that fires on the dice's *unrolled* number (if you roll 5, camp activates on a different hex)
- [ ] Sacred Path / Trade Routes — specific 3-edge paths printed on the board grant +1 VP to whoever fully owns them with their roads
- [ ] Treasure Hunt — face-down VP tokens on a few hexes; first settler reveals and keeps (Forgotten-Tribe-but-only-VP)
- [ ] Reverse Robber / Trade Winds — on rolls of 2 or 12, a random player gets a free resource or 2:1 trade
- [ ] Seasons — game cycles through Spring/Summer/Fall/Winter every N turns; each season disables one resource's hexes; forces production diversity
- [ ] Tornado — permanent moving robber-like marker that hops to a random hex each turn; doesn't steal, just blocks production
- [ ] Trade Caravan — NPC marker that walks the perimeter each turn; settlement adjacent that turn gets a free 2:1 (any → any) trade
- [ ] Civilizations — each player draws a hidden civilization card at game start with a small permanent bias (e.g., free 2:1 sheep port, or +1 wheat per wheat hex); asymmetric starts

## Scope

Intentionally **not** included: accounts, matchmaking, monetization, anti-cheat, persistent saves. Friends-only project — none of that pays for itself at this scale.

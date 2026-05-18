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

## Scope

Intentionally **not** included: accounts, matchmaking, monetization, anti-cheat, persistent saves. Friends-only project — none of that pays for itself at this scale.

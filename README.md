# Catan

A web-based clone of *Settlers of Catan* with expansion support, built for private play with friends.

The popular online version (colonist.io) paywalls the expansions; this is a free reimplementation hosted on GitHub Pages.

## Status

Fully playable: local hot-seat against AI **and** online multiplayer over WebRTC, with in-game chat. Base game complete. Expansions are next.

## Tech stack

- **TypeScript** + **Vite** + **React**
- **SVG** for the board (hand-rolled, no Canvas)
- **honeycomb-grid** for hex math
- **Zustand** for state management
- **Vitest** for tests
- **Trystero** (BitTorrent-tracker signaling) for WebRTC peer-to-peer multiplayer

## How it works

The game runs entirely in the browser as a static site. The engine is a pure
TypeScript reducer (`applyAction(state, action) => state`) so a game is just
a sequence of typed actions.

- **Local hot-seat**: any mix of human and AI players on one device. A pass-device screen between human turns hides hidden info (resource hand, unplayed dev cards). In solo+AI games the AI's hand stays face-down (counts visible, types hidden).
- **Online multiplayer**: WebRTC peer-to-peer, no backend. Create a room → share a 4-character code → friends join. Host runs any AI seats. Full state replication via action broadcast.
- **AI**: a fast heuristic player. Plays setup, builds, robs, trades — accepts player offers liberally, makes counter-offers within an edit distance of the original ask, and uses bank/port trades aggressively to avoid hoarding.
- **Trading**: bank trades (4:1 / 3:1 / 2:1 by port, batchable in one action), and open-broadcast player trades with counter/reject/walk-away flow.
- **Game log**: every dice roll, build, trade, steal (without revealing the stolen resource), and dev-card play streams into a scrollable log shared by all peers (derived independently from received actions).
- **End-of-game match graph**: line chart of VP / total resources produced / hand size over time for every player.
- **Customization**: 10 distinct player colors selectable per seat; turn order shuffled at game start so signup order doesn't matter.
- **Rulebook**: paginated by topic with inline diagrams, reachable from the main menu and from a `?` button on the board.
- **Rejoin**: drop out and rejoin mid-game with the same room code — your seat is preserved via a `localStorage` UUID.
- **Spectators**: anyone joining mid-game without a matching saved UUID becomes a read-only spectator (board + chat, no actions).
- **Chat**: in-game text chat (tabbed alongside the game log), plus system messages for joins/leaves/game-start.

### Testing online multiplayer locally

Two browser windows in the same incognito session share `localStorage`, which gives them the same identity UUID and breaks the seat assignment. Append `?fresh` to the URL of each test window to force a per-tab UUID via `sessionStorage` instead.

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
- [ ] Phase 15 — Rivals expansion: Era of Gold
- [ ] Phase 16 — Rivals expansion: Era of Turmoil
- [ ] Phase 17 — Rivals expansion: Era of Progress
- [ ] Phase 18 — Rivals expansion: Era of Barbarians
- [ ] Phase 19 — Rivals expansion: Era of Merchants

## Scope

Intentionally **not** included: accounts, matchmaking, monetization, anti-cheat, persistent saves. Friends-only project — none of that pays for itself at this scale.

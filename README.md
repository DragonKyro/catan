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

- **Local hot-seat**: any mix of human and AI players on one device. A pass-device screen between human turns hides hidden info (resource hand, unplayed dev cards).
- **Online multiplayer**: WebRTC peer-to-peer, no backend. Create a room → share a 4-character code → friends join. Host runs any AI seats. Full state replication via action broadcast.
- **AI**: a fast heuristic player. Plays setup, builds, robs, trades — and can both accept and propose player-to-player trades.
- **Trading**: bank trades (4:1 / 3:1 / 2:1 by port), and open-broadcast player trades.
- **Rejoin**: drop out and rejoin mid-game with the same room code — your seat is preserved via a `localStorage` UUID.
- **Spectators**: anyone joining mid-game without a matching saved UUID becomes a read-only spectator (board + chat, no actions).
- **Chat**: in-game text chat, plus system messages for joins/leaves/game-start.

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
- [ ] Phase 5 — Seafarers expansion
- [ ] Phase 6 — Cities & Knights expansion
- [ ] Phase 7 — Traders & Barbarians expansion
- [ ] Phase 8 — Explorers & Pirates expansion
- [ ] Phase 9 — *Rivals for Catan* (2-player card-game variant)
- [ ] Phase 10 — Rivals expansion: Era of Gold
- [ ] Phase 11 — Rivals expansion: Era of Turmoil
- [ ] Phase 12 — Rivals expansion: Era of Progress
- [ ] Phase 13 — Rivals expansion: Era of Barbarians
- [ ] Phase 14 — Rivals expansion: Era of Merchants

## Scope

Intentionally **not** included: accounts, matchmaking, monetization, anti-cheat, persistent saves. Friends-only project — none of that pays for itself at this scale.

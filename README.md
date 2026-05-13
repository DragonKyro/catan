# Catan

A web-based clone of *Settlers of Catan* with expansion support, built for private play with friends.

The popular online version (colonist.io) paywalls the expansions; this is a free reimplementation hosted on GitHub Pages.

## Tech stack

- **TypeScript** + **Vite** + **React**
- **SVG** for the board (hand-rolled, no Canvas)
- **honeycomb-grid** for hex math
- **Trystero** for WebRTC peer-to-peer multiplayer (no backend)
- **Zustand** for state management
- **Vitest** for tests

## How multiplayer works

The app is fully static — no server. Multiplayer uses WebRTC: peers find each other via a room code through Trystero's decentralized signaling, then game state is replicated on every peer. Actions are broadcast over the wire; full state snapshots are exchanged when a player joins or rejoins.

Players can drop out and rejoin mid-game using the same room code — any other peer can re-sync their state.

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
- [ ] Phase 1 — Game logic (base game rules engine + tests)
- [ ] Phase 2 — Single-player UI (hot-seat playable)
- [ ] Phase 3 — Multiplayer (Trystero + replicated state)
- [ ] Phase 4 — First expansion (Seafarers)
- [ ] Phase 5 — Cities & Knights, Traders & Barbarians, Explorers & Pirates

## Scope

Intentionally **not** included: accounts, matchmaking, monetization, anti-cheat, persistent saves. Friends-only project — none of that pays for itself at this scale.

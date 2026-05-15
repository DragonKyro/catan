# Catan

A web-based clone of *Settlers of Catan* with expansion support, built for private play with friends.

The popular online version (colonist.io) paywalls the expansions; this is a free reimplementation hosted on GitHub Pages.

**🎲 Play it:** https://dragonkyro.github.io/catan/

### Planned

- Post-game AI analysis: highlight likely misplays from the action log (held wood+brick instead of building; bank-traded into a 7-out; settled on a sub-optimal vertex)
- 7-8 player Catan support (expansion beyond the official 5–6 player board)

## Status

Fully playable: local hot-seat against AI **and** online multiplayer over WebRTC, with in-game chat. Base game (3–6 players) complete. Seafarers expansion playable with 9 official scenarios. Other expansions are next.

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

- **Local hot-seat**: any mix of human and AI players on one device, 3–6 seats. A pass-device screen between human turns hides hidden info (resource hand, unplayed dev cards). In solo+AI games the AI's hand stays face-down (counts visible, types hidden).
- **5–6 player expansion**: opt into the larger 30-hex board with a Special Build Phase between turns, letting non-turn-holders build (no trades or dev plays) before the next real turn.
- **Online multiplayer**: WebRTC peer-to-peer, no backend. Create a room → share a 4-character code → friends join. Host runs any AI seats. Full state replication via action broadcast.
- **AI**: a fast heuristic player. Plays setup, builds, robs, trades. Uses encoded 10-VP win-plan templates to decide what to invest in, threat-assesses opponents (leaders, LA/LR race, win-imminent) when trading, robbing, or denying resources, and avoids reverse / roundabout trades within a turn.
- **Trading**: bank trades (4:1 / 3:1 / 2:1 by port, batchable in one action), and open-broadcast player trades with counter/reject/walk-away flow.
- **Layout**: hand and action buttons live at the bottom of the screen (always your own hand, even on an AI's turn); the right pane shows opponents in turn order (active player highlighted), bank, and a log/chat tabs panel. The right pane stays the same shape every turn.
- **Cost cheatsheet**: cost popover in the action bar plus hover tooltips on each build button.
- **Undo (solo/hot-seat)**: revert your last reversible action (road / settlement / city / dev-card buy / bank trade) before doing anything else. Disabled online.
- **Hover ghost**: in build mode, the hovered vertex/edge previews a faint silhouette of the actual settlement / city / road in your color.
- **Game log**: dice rolls, builds, completed trades, steals (without revealing the stolen resource), discards, dev-card plays, and revolution-based turn markers stream into a scrollable log shared by all peers. Offers and rejections aren't logged — only outcomes.
- **End-of-game match graph**: tabbed line and bar charts with x-unified hover crosshair and turn-numbered x-axis — VP, resources earned (totals, by player, by resource), hand size, knights played, longest road, trades count, trade efficiency, dice-roll frequency, and cumulative resources put into circulation by the bank.
- **End-of-game replay**: scrub through your finished game step by step, or auto-play it back at 0.5×–4×. Only board-changing actions step the slider; rolls / trades / end-turns are folded in but skipped.
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
- [x] Phase 5 — Base game 5–6 player extension
- [x] Phase 6 — Seafarers expansion (9 official scenarios)
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

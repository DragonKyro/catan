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

**Seafarers expansion** — 9 official scenarios, following the 2025 rulebook (setup, extra rules, win condition and VP target):

- **Heading for New Shores** (14 VP) — main island + small islands; +2 VP for *your* first settlement on each small island
- **The Four Islands / The Six Islands** (13 VP) — start on one or two islands; +2 VP per other island you settle
- **The Fog Islands** (12 VP) — unexplored spaces are discovered by roads/ships next to them; land pays a resource
- **Through the Desert** (14 VP) — the desert cuts off a strip that counts as an unexplored region (+2 VP)
- **The Forgotten Tribe** (13 VP) — ships pick up the tribe's VP tokens, dev cards and ports from island edges; settlements only on numbered hexes
- **Cloth for Catan** (14 VP) — three starting settlements; ship routes to villages trade cloth (2 cloth = 1 VP); the game also ends when 5 villages run dry
- **The Pirate Islands** (fortress + 10 VP) — a pirate fleet circles the board attacking buildings; build warships and one line of ships west to recapture your pirate fortress
- **The Wonders of Catan** — claim one of the rulebook's wonders and build its 4 levels; finish it, or reach 10 VP with the highest level, to win
- **New World** (12 VP) — open map; +1 VP per island you didn't start on

**Cities & Knights expansion** — 3–6 players, following the 2025 rulebook (13 VP): a city as your second starting piece, commodities (paper / cloth / coin) from cities, the event die (barbarian ship or a progress-card draw on the red die), the barbarian track and attacks (defended by active knights, pillaging the weakest defenders' cities), knights (recruit, activate, promote, move, displace, chase the robber), city walls, the three city improvement tracks with their level-3 abilities and metropolises, the merchant, and all 54 progress cards. The robber waits beside the track until the first attack. Play it on a random board, a shape Fun Map, or the rulebook's fixed **first-game board**. 5–6 players use the 5–6 board and paired turns.

**Traders & Barbarians expansion** (3–6 players, 2025 rulebooks; 5–6 players use the T&B 5–6 boards and paired turns, see below):

- **Rivers of Catan** (10 VP) — two fixed river tiles run from the mountains to the swamps; seven bridge sites where roads can't go. Bridges (2 brick + 1 lumber) pay 3 gold, roads and settlements on a river tile 1 gold. Spend 2 gold for any card (twice a turn), buy gold at your bank rate, trade with it. The richest player alone is Wealthiest (+1 VP); everyone tied for the least gold is Poor (−2 VP). The 2 shares the 12's hex
- **Fishing on Catan** (10 VP, 11 with the old boot) — the lake (fishes on 2, 3, 11, 12) sits somewhere in the inner ring and six fishing grounds fill the coastal notches. Spend fish to remove the robber (2), steal (3), take a card (4), build a free road (5) or take a development card (7); hold at most 7 tokens; pass the old boot to anyone with at least your VP
- **Merchant Trains** (12 VP) — the watering hole replaces the desert; build a settlement or city to collect a wagon, then everyone bids wool / wheat (public, clockwise) for where it goes. Trains leave the watering hole's three start corners, run nose to tail, never branch and merge where their fronts meet. A wagon on a road is an extra road for the Longest Route; a building between two wagons is worth +1 VP
- **Barbarian Attack** (12 VP, 2025 rulebook) — every building lands 3 barbarians on the coast (dice rolled for you, shown in the log); 3 on a hex conquer it and the buildings touching only conquered hexes stop counting. Buy the scenario's development cards (Capture, Knighthood, Swift Knight, Treason) to raise knights, move them at the end of your turn (3 edges, 5 for a wheat), and drive the barbarians off: every 2 prisoners = 1 VP. Second starting placement is a city; no robber — a 7 steals from anyone.
- **Traders & Barbarians** (13 VP) — the quarry, the castle and the glassworks sit on three corners of the island with interior paths to a centre plaza. At the end of your turn your wagon moves along the edges (2 MP, 1 on your road, 1 + 1 gold toll on a rival's, +2 past a barbarian; a wheat buys +2), delivers a token the location buys (1 VP + gold) and picks up the next. Upgrade the wagon (more MP, drive barbarians off on a die roll, more gold; level 5 = +1 VP). The scenario's own 25 cards: Knights move one of the three barbarians standing on edges and rob the road it lands on, Road Building, Swift Journey (a second wagon move), VP. 2s and 12s are re-rolled; 5 gold to start; second placement is a city; no robber or Longest Road.

**Traders & Barbarians 5–6** (2025 T&B 5–6 rulebook) — all four scenarios at 5 or 6 players on the CATAN 5–6 island with its eleven printed harbors, same win targets. Paired turns: Player 1 rolls and takes a whole turn (scenario End of Turn phase included), then Player 2 (third seat to the left) takes an Action phase — supply trades only — and their own End of Turn phase (a Merchant Trains voting round as the active player, Barbarian Attack knight moves + expel; coins and fish as normal). Rivers adds a third river (mountains → pasture → pasture, ten bridge sites, no 2-on-12); Fishing has two lakes (2 / 3 / 11 / 12 and 4 / 10), eight fishing grounds and 44 fish tokens; Merchant Trains two watering holes (six starts) and 33 wagons; Barbarian Attack two castles, two deserts, two coastal 5s and 9s (both get the barbarian) and 48 barbarians.

**Traders & Barbarians variants** — work with any game (base, Seafarers, T&B scenarios), ticked on the New Game screen:

- **Friendly Robber** — the robber can't go to a hex with a building of a player who has only 2 VPs (desert fallback, and no stealing from them)
- **Strongest Ports** — the first player with 3 VPs in buildings on harbors takes a 2 VP tile; someone with more takes it over (+1 VP target)
- **Catan Event Cards** — a 37-card event deck (numbers on the dice odds, New Year 6th from the bottom) replaces the dice: each turn flips a card, resolves its event (Plentiful Year, Earthquake, Good Neighbors, Robber Attacks, …), then produces for its number

### Notable mechanics

- **Online multiplayer with no backend.** WebRTC peer-to-peer over Trystero (Nostr-relay signaling — works on cellular and corporate networks where BitTorrent trackers are blocked). Create a room, share a 4-character code, friends join. Full state replication; randomness baked into actions so all peers reduce to the same state. Drop out and rejoin mid-game with the same code — your seat is preserved via `localStorage` UUID. Late joiners without a saved UUID become read-only spectators.
- **End-of-game match graph.** Tabbed line charts (VP, resources earned per-player and per-resource, hand size, knights, longest road, trade count, trade efficiency) and bar charts (dice frequency, cumulative bank circulation). Hover snaps to the nearest timeline step with an x-unified crosshair; x-axis is labeled in turn numbers.
- **End-of-game replay.** Scrub through your finished game step by step, or auto-play at 0.5×–4×. Slider stops only on board-changing actions; rolls and trades fold in but skip.
- **Heuristic AI with encoded win plans.** Six 10-VP templates (city+army, sprawl+road, etc.); AI scores each by resource cost + production mismatch and picks the cheapest reachable plan. Threat model flags opponents close to win, longest road, or largest army, and refuses trades that hand them the resource they need. In Seafarers it values the island bonuses it can still earn, weights gold above any single resource, looks a few ship-steps ahead to cross open sea, moves ships, and plays each scenario's mechanic (tribe pickups, cloth routes, the pirate-fortress line, wonders).
- **Scenario progress tracker.** When a Seafarers scenario has live state (island bonuses, fog, tribe gifts, wonders, pirate fortresses, cloth), a "Scenario" side tab appears with everything-at-a-glance, including how the scenario is won. Player badges in the hand/opponent panels mirror it (`🏝 +N`, `🧵 N`, `X/N VP`).
- **Pass-device hot-seat.** In local games with multiple humans, an explicit handoff screen hides resource hands and unplayed dev cards between turns. AI hands stay face-down (counts visible, types hidden).
- **Self-contained rulebook with search.** Paginated by topic with inline SVG diagrams; per-scenario explainers cover the actual implemented mechanic for each Seafarers scenario and base-game Fun Map, including its win target. A search box filters topics by title and body text in real time so you can find a specific rule without scrolling.

### Testing online multiplayer locally

Two browser windows in the same incognito session share `localStorage`, which gives them the same identity UUID and breaks seat assignment. Append `?fresh` to the URL of each test window to force a per-tab UUID via `sessionStorage` instead.

### Connection logic (and why it used to be flaky)

The multiplayer used to work only intermittently — particularly between phones on cellular. Three things were wrong, all fixed now:

1. **Wrong transport.** The previous build used `trystero/torrent`, which discovers peers via BitTorrent trackers and DHT. Most mobile carriers and many home routers block or rate-limit BitTorrent traffic outright, so two phones on cellular usually never even saw each other. Replaced with `trystero/nostr`, which signals over WebSocket (port 443) to public Nostr relays. WebSocket on 443 passes through cellular, corporate proxies, hotel WiFi, etc. — basically anywhere HTTPS works.
2. **No real join timeout.** The old `joinRoom` had a 100 ms timer that did literally nothing, so a guest who couldn't reach the host sat on "Connecting…" forever. Now if no host answers in time the connection flips to an `error` state with a clear message and a Try Again button.
3. **Lobby/start channel race.** The `lobby` and `start` Trystero channels are independent, so on a slow link the guest could receive `start` before the final `lobby` broadcast. The seat→UUID map was pulled from `lobby` at start time, so a lost race left the map empty and every subsequent action got dropped with a silent `UUID/seat mismatch` warning — the game looked frozen. Fixed by embedding `seatUuids` directly in the `start` payload so it's race-proof.

Later, phones still sometimes couldn't find a room. Two more causes, also fixed:

4. **Relay subscriptions lost on reconnect.** Trystero 0.20 reconnected a dropped relay WebSocket but never re-sent the room subscription. Phones drop a page's sockets while it's in the background (e.g. the host switches to Messages to send the code), so the host came back able to announce but deaf: the guest found nobody and the host never saw them. Upgraded to `@trystero-p2p/nostr` 0.26, which resubscribes; the app also reconnects immediately when the page comes back to the foreground, and uses 8 relays instead of 5 (0.20's built-in relay list had gone stale).
5. **A failed join looked like an empty room.** While searching, the guest saw the lobby with its code and no players. Now it's a "Looking for room…" screen, and after 25 s a "Room ABCD not found" error that says whether this device reached the relays, whether any other device answered, and how long it waited. **Play online → Network test** checks a device's relays and NAT type and pairs two devices on a test code with live ping, for working out which side of a failing pairing is the problem.

If you're forking this for your own P2P project, the takeaway is: **prefer `trystero/nostr` (or `trystero/mqtt`) over `trystero/torrent`** for anything that needs to work on mobile, and **never let two channels race for invariants** — bundle the invariant into the payload that establishes it.

## Tech stack

- **TypeScript** + **Vite** + **React**
- **SVG** for the board (hand-rolled, no Canvas)
- **honeycomb-grid** for hex math
- **Zustand** for state management
- **Vitest** for tests
- **Trystero** (Nostr-relay signaling, WebSocket on port 443) for WebRTC peer-to-peer multiplayer

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
- [x] Phase 8 — Cities & Knights expansion (audited rule by rule against the 2025 rulebook: turn flow, barbarians, knights, improvements + metropolises, all 54 progress cards, commodity trading. Every action playable in the UI with drawn pieces (knights by strength, standing / lying; walls; metropolis gates; merchant; barbarian track). The rulebook's first-game board as a map. Heuristic AI plays the expansion: knights vs. the barbarians, improvements + metropolises, progress cards, commodity trades)
- [x] Phase 9 — Cities & Knights 5–6 player extension (5–6 board, paired turns — Player 2 may not trade with players — and 6 more of each commodity)
- [~] Phase 10 — Traders & Barbarians expansion (all 5 scenarios shipping: Rivers of Catan + Fishing on Catan + Merchant Trains + Barbarian Attack + the Traders & Barbarians scenario, plus the Friendly Robber, Strongest Ports and Catan Event Cards variants, which combine with any game. The Catan for Two variant is deferred; see Outstanding work)
- [x] Phase 11 — Traders & Barbarians 5–6 player extension (Rivers of Catan, Fishing on Catan, Merchant Trains and Barbarian Attack on their T&B 5–6 maps, with the paired-player turn — the Traders & Barbarians scenario stays 3–4)
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

### Outstanding work (audit, 2026-05)

Items uncovered by a full audit of the two in-progress expansions, in rough priority order:

**Cities & Knights (Phase 8):**

- [x] **AI support** — `src/ai/citiesAndKnights/` plays C&K: answers every C&K decision on or off its turn, defends against the barbarians (activates / promotes / recruits from the ship position and every seat's strength, holds back a city it can't defend), raises improvement tracks toward level 3 and the metropolises, plays each progress card by a simple rule, builds walls, chases the robber, and trades commodities with the bank and players. Seeded all-AI games finish at 3–6 players (`playCitiesAndKnights.test.ts`). Still simple: one difficulty, little knight-based blocking / displacement, no long-term plan beyond the next build.
- [x] **Rules audit + tests** — a test per rule (`rules2025.test.ts`, `knights.test.ts`, `improvementsTrade.test.ts`, `progressCards.test.ts`, `board/firstGame.test.ts`), covering the roll flow, draws, attacks, knights, metropolises, trading and every progress card.
- [x] **Progress-card dialogs** — every card with a follow-up (Intrigue, Espionage, Treason, Wedding, Commercial Harbor, Guild Dues, Merchant Fleet, Invention, Diplomacy, Taxation, monopolies, Smithing, Road Building, Engineering, Medicine, Alchemy) is playable from the cards dialog or the board, with component tests in `src/ui/dialogs/citiesAndKnights/`.
- [ ] **C&K + Seafarers** — the rulebook combination (ships as roads, pirate on the track, knights on sea intersections) isn't wired; `createGame` refuses it.
- [ ] **Gold Rush / Volcano with C&K** — the C&K roll has no gold pick or eruption step, so those two maps are refused under C&K.
- [ ] **Out of settlements on a pillage** — the rulebook turns the city on its side; here it becomes a 6th settlement.
- [ ] **Online lobby** — the online lobby doesn't offer C&K yet (hot-seat / vs. AI only).

**Traders & Barbarians (Phase 10):**

- [x] **Coins** — `spendGold` (2 gold → 1 resource, 2× per turn), `buyGold` at your bank rate, gold in player trades; Coins dialog + gold in the trade dialogs.
- [x] **Fish spend UI completeness** — all five spends in `SpendFishDialog` (the free road switches to board placement).
- [x] **Fish 7-token swap** — once per turn, a full hand may swap a token for a new draw (`fishSwap` phase).
- [x] **Smarter AI wagon voting** — the AI bids when steering the wagon is worth a VP / Longest Route to it (or keeps one from a rival), assigns its votes and places as chooser (`src/ai/traders/merchantTrains.ts`).
- [x] **Traders & Barbarians scenario** — commodity hexes with paths and plazas, wagons, barbarians on edges, the scenario's deck, AI that plans deliveries (`src/game/modules/traders/tradersBarbarians/`, `src/ai/traders/tradersBarbarians.ts`).
- [x] **Catan Event Cards variant** — 37-card deck replacing the dice, all 13 events (base-game versions).
- [ ] **Catan Event Cards with Cities & Knights** — the event die + red die alongside the card, and the C&K versions of Conflict / Epidemic / Good Neighbors / Helpful Neighbor / Tournament; `createGame` rejects the combination for now.
- [ ] **Catan Event Cards: the printed deck** — the rulebook doesn't list each card's number; the shipped deck follows the dice odds with Robber Attacks on the 7s (`variants/eventCards/deck.ts`). Swap in the real per-card table if it turns up.
- [ ] **Catan for Two variant** — neutral players for 2p; not implemented.

**Cross-cutting:**

- [x] **Replay slider action coverage** — C&K and T&B actions (knights, improvements, progress cards, walls, bridges, fish, wagons, barbarian cards and knights, event cards) are stops on the replay slider.

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

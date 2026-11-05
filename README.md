# Catan

A web-based clone of *Settlers of Catan* with expansion support, built for private play with friends.

The popular online version (colonist.io) paywalls the expansions; this is a free reimplementation hosted on GitHub Pages.

**🎲 Play it:** https://dragonkyro.github.io/catan/

## Features

### Playable today

**Base game** — 3–8 players. 3–6 official; 7–8 is an unofficial extension modeled on colonist.io's: 37-hex board, scaled bank (24 per resource) and dev deck (35 cards), 2022 paired-player turn rule across all 5+ player counts.

**Beginner set-up** — the rulebooks' "starting set-up for new players" (3–4 and 5–6): fixed board, harbors and starting settlements / roads, straight to the first roll. Pick **Beginner set-up (rulebook)** on the Base map dropdown.

**Fun Maps** — eight colonist.io-style base-game variants, selectable from a **Base map** dropdown on the new-game screen:

- **Gold Rush** — two or three gold fields mixed into the terrain pool; settlements next to one pick any resource on every production roll
- **Volcano** — center hex is a volcano (pinned to roll a 6); when its number comes up, one random adjacent settlement is destroyed and any adjacent city downgrades to a settlement. Setup placement next to the volcano is forbidden
- **Black Forest** — five fixed-position forest (wood) hexes anchor the middle; the usual no-adjacent-reds rule is relaxed so a dense 6/8 cluster can land anywhere
- **Diamond** — 16-hex rhombus shape; smaller and tighter than standard
- **Gear** — 13-hex gear with six "teeth" sticking out around a 7-hex core; one port per tooth
- **Lakes** — standard outline with three interior lakes that roads have to route around
- **Pond** — single sea hex dead-center
- **Twirl** — 21-hex spiral; standard hexagon with a two-hex tail twisting off one corner

All eight also play at 5–6 players: Gold Rush, Pond, Black Forest and Lakes (four lake hexes) on the 5–6 board; Diamond as a 25-hex rhombus, Gear with nine teeth around a 19-hex core, Twirl as a two-tailed spiral, Volcano on a 31-hex round island.

**Seafarers expansion** — 9 official scenarios, following the 2025 rulebook (setup, extra rules, win condition and VP target):

- **Heading for New Shores** (14 VP) — main island + small islands; +2 VP for *your* first settlement on each small island
- **The Four Islands / The Six Islands** (13 VP) — start on one or two islands; +2 VP per other island you settle
- **The Fog Islands** (12 VP) — unexplored spaces are discovered by roads/ships next to them; land pays a resource
- **Through the Desert** (14 VP) — the desert cuts off a strip that counts as an unexplored region (+2 VP)
- **The Forgotten Tribe** (13 VP) — ships pick up the tribe's VP tokens, dev cards and ports from island edges; settlements only on numbered hexes
- **Cloth for Catan** (14 VP) — three starting settlements; ship routes to villages trade cloth (2 cloth = 1 VP); the game also ends when 5 villages run dry
- **The Pirate Islands** (fortress + 10 VP) — a pirate fleet circles the board attacking buildings; build warships and one line of ships west to recapture your pirate fortress
- **The Wonders of Catan** — claim one of the rulebook's wonders and build its 4 levels; finish it, or reach 10 VP with the highest level, to win
- **New World** (12 VP) — a new random archipelago every game; +1 VP per island you didn't start on

**Cities & Knights expansion** — 3–6 players, following the 2025 rulebook (13 VP): a city as your second starting piece, commodities (paper / cloth / coin) from cities, the event die (barbarian ship or a progress-card draw on the red die), the barbarian track and attacks (defended by active knights, pillaging the weakest defenders' cities), knights (recruit, activate, promote, move, displace, chase the robber), city walls, the three city improvement tracks with their level-3 abilities and metropolises, the merchant, and all 54 progress cards. The robber waits beside the track until the first attack. Play it on a random board, a shape Fun Map, or the rulebook's fixed **first-game board**. 5–6 players use the 5–6 board and paired turns.

**Traders & Barbarians expansion** (3–6 players, 2025 rulebooks; 5–6 players use the T&B 5–6 boards and paired turns, see below):

- **Rivers of Catan** (10 VP) — two fixed river tiles run from the mountains to the swamps; seven bridge sites where roads can't go. Bridges (2 brick + 1 lumber) pay 3 gold, roads and settlements on a river tile 1 gold. Spend 2 gold for any card (twice a turn), buy gold at your bank rate, trade with it. The richest player alone is Wealthiest (+1 VP); everyone tied for the least gold is Poor (−2 VP). The 2 shares the 12's hex
- **Fishing on Catan** (10 VP, 11 with the old boot) — the lake (fishes on 2, 3, 11, 12) sits somewhere in the inner ring and six fishing grounds fill the coastal notches. Spend fish to remove the robber (2), steal (3), take a card (4), build a free road (5) or take a development card (7); hold at most 7 tokens; pass the old boot to anyone with at least your VP
- **Merchant Trains** (12 VP) — the watering hole replaces the desert; build a settlement or city to collect a wagon, then everyone bids wool / wheat (public, clockwise) for where it goes. Trains leave the watering hole's three start corners, run nose to tail, never branch and merge where their fronts meet. A wagon on a road is an extra road for the Longest Route; a building between two wagons is worth +1 VP
- **Barbarian Attack** (12 VP, 2025 rulebook) — every building lands 3 barbarians on the coast (dice rolled for you, shown in the log); 3 on a hex conquer it and the buildings touching only conquered hexes stop counting. Buy the scenario's development cards (Capture, Knighthood, Swift Knight, Treason) to raise knights, move them at the end of your turn (3 edges, 5 for a wheat), and drive the barbarians off: every 2 prisoners = 1 VP. Second starting placement is a city; no robber — a 7 steals from anyone.
- **Traders & Barbarians** (13 VP) — the quarry, the castle and the glassworks sit on three corners of the island with interior paths to a centre plaza. At the end of your turn your wagon moves along the edges (2 MP, 1 on your road, 1 + 1 gold toll on a rival's, +2 past a barbarian; a wheat buys +2), delivers a token the location buys (1 VP + gold) and picks up the next. Upgrade the wagon (more MP, drive barbarians off on a die roll, more gold; level 5 = +1 VP). The scenario's own 25 cards: Knights move one of the three barbarians standing on edges and rob the road it lands on, Road Building, Swift Journey (a second wagon move), VP. 2s and 12s are re-rolled; 5 gold to start; second placement is a city; no robber or Longest Road.

**Traders & Barbarians 5–6** (2025 T&B 5–6 rulebook) — all four scenarios at 5 or 6 players on the CATAN 5–6 island with its eleven printed harbors, same win targets. Paired turns: Player 1 rolls and takes a whole turn (scenario End of Turn phase included), then Player 2 (third seat to the left) takes an Action phase — supply trades only — and their own End of Turn phase (a Merchant Trains voting round as the active player, Barbarian Attack knight moves + expel; coins and fish as normal). Rivers adds a third river (mountains → pasture → pasture, ten bridge sites, no 2-on-12); Fishing has two lakes (2 / 3 / 11 / 12 and 4 / 10), eight fishing grounds and 44 fish tokens; Merchant Trains two watering holes (six starts) and 33 wagons; Barbarian Attack two castles, two deserts, two coastal 5s and 9s (both get the barbarian) and 48 barbarians.

**Explorers & Pirates expansion** — 3–4 players, the 2025 rulebook's complete **Explorers & Pirates** scenario (17 VP). Start on the western island with a harbor settlement, a settlement, a road and a ship carrying a settler; the parrot and goose seas to the east lie face down. Each turn: roll, build (roads, settlements, harbor settlements for 2 VP, ships, settlers, crews; trade 3:1 or for gold), then move your ships (4 edges, 6 for a wool). A ship touching a face-down hex turns it over: land with a fresh number, gold fields held by pirate lairs, spice farms, fish shoals. Settlers found settlements from a ship; three crews capture a lair (2 gold + track spaces; the hero gets one more) and its gold field then pays 2 gold per building; fish hauls (a die roll fills a shoal) and spice sacks (put a crew on the farm first — it also gives you Swift Voyage, Fast Gold or Pirate Bonus) go to the Council of Catan. Each mission track pays VP per space and a bonus tile to its leader. A 7 brings out your pirate ship: it robs ships on its hex and charges tribute to everyone sailing past; chase it away with a 6. Anyone who gets nothing on a roll takes 1 gold.

**Traders & Barbarians variants** — work with any game (Event Cards: all but Cities & Knights), ticked on the New Game screen:

- **Friendly Robber** — the robber can't go to a hex with a building of a player who has only 2 VPs (desert fallback, and no stealing from them)
- **Strongest Ports** — the first player with 3 VPs in buildings on harbors takes a 2 VP tile; someone with more takes it over (+1 VP target)
- **Catan Event Cards** — a 37-card event deck (numbers on the dice odds, New Year 6th from the bottom) replaces the dice: each turn flips a card, resolves its event (Plentiful Year, Earthquake, Good Neighbors, Robber Attacks, …), then produces for its number

### Notable mechanics

- **Online multiplayer, no sign-in.** Create a room, share the 4-character code (or the invite link), friends join, pick their colors, and play from their own devices: the base game on any map, any Seafarers scenario, Cities & Knights (any map it allows), any Traders & Barbarians scenario or Explorers & Pirates, with the Friendly Robber / Strongest Ports / Event Cards variants. The room lives in a Firebase Realtime Database: every move goes into an ordered, write-once log, so every device applies the same moves in the same order, and two players acting at the same moment (both accepting one trade) can't split the game. Your own moves show instantly; if someone else's lands first, yours is replayed on top or taken back. Drop out, reload, or lose signal and come back: the device replays the log and is back in its seat with the full history and the real game clock. Others joining mid-game spectate. Devices sign in anonymously behind the scenes, only so the security rules can tie writes to a device.
- **End-of-game match graph.** Tabbed line charts (VP, resources earned per-player and per-resource, hand size, knights, longest road, trade count, trade efficiency) and bar charts (dice frequency, cumulative bank circulation). Hover snaps to the nearest timeline step with an x-unified crosshair; x-axis is labeled in turn numbers.
- **End-of-game replay.** Scrub through your finished game step by step, or auto-play at 0.5×–4×. Slider stops only on board-changing actions; rolls and trades fold in but skip.
- **Heuristic AI with encoded win plans.** Six 10-VP templates (city+army, sprawl+road, etc.); AI scores each by resource cost + production mismatch and picks the cheapest reachable plan. Threat model flags opponents close to win, longest road, or largest army, and refuses trades that hand them the resource they need. In Seafarers it values the island bonuses it can still earn, weights gold above any single resource, looks a few ship-steps ahead to cross open sea, moves ships, and plays each scenario's mechanic (tribe pickups, cloth routes, the pirate-fortress line, wonders).
- **Scenario progress tracker.** When a Seafarers scenario has live state (island bonuses, fog, tribe gifts, wonders, pirate fortresses, cloth), a "Scenario" side tab appears with everything-at-a-glance, including how the scenario is won. Player badges in the hand/opponent panels mirror it (`🏝 +N`, `🧵 N`, `X/N VP`).
- **Pass-device hot-seat.** In local games with multiple humans, an explicit handoff screen hides resource hands and unplayed dev cards between turns. AI hands stay face-down (counts visible, types hidden).
- **Self-contained rulebook with search.** Paginated by topic with inline SVG diagrams; per-scenario explainers cover the actual implemented mechanic for each Seafarers scenario and base-game Fun Map, including its win target. A search box filters topics by title and body text in real time so you can find a specific rule without scrolling.

### Testing online multiplayer locally

Two browser windows in the same incognito session share storage, which gives them the same identity and breaks seat assignment. Append `?fresh` to the URL of each test window to give it its own identity (per-tab `sessionStorage`, including its anonymous sign-in).

`npm run test:run` covers online play against an in-memory server. To run the same flow against the real Firebase project: `FIREBASE_LIVE=1 npx vitest run src/store/networkStore.live.test.ts` (it prints the room codes it used; remove them with `firebase database:remove /rooms/<CODE>`).

### Why Firebase

Online play used to be peer-to-peer WebRTC (Trystero, signaling over BitTorrent trackers and then Nostr relays). It never worked reliably: carriers block trackers, relays come and go, phones drop their sockets in the background, and with STUN only (no TURN server), two devices behind strict NAT, the usual case on cellular, can find each other but never connect. Firebase's Realtime Database replaced it: one WebSocket on port 443 to Google's servers, which every network allows, plus server-side ordering, presence, and rejoin for free. It bills bytes and connections, not operations, so rooms stay small: the start record is the game's setup inputs (~0.4 KB) rather than the whole board, a move is ~100 bytes, a whole game ~60–100 KB, and a device closes its connection whenever it isn't in a room. Rooms clean themselves up: each time someone makes a room, their device deletes rooms more than a week old that nobody is connected to (the rules allow exactly that, and keep younger rooms' codes private), so storage stays bounded with no server code. The security rules are in `database.rules.json` (deploy with `firebase deploy --only database`).

## Tech stack

- **TypeScript** + **Vite** + **React**
- **SVG** for the board (hand-rolled, no Canvas)
- **honeycomb-grid** for hex math
- **Zustand** for state management
- **Vitest** for tests
- **Firebase Realtime Database** + anonymous Auth for online multiplayer (project `catan-33623`; no server code of our own)

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

One checklist, in build order: the app itself, then each game with its player extensions. `[x]` = done and playable, `[ ]` = still to do. Unfinished pieces of a finished game are listed under that game.

### 1. The app

- [x] Project scaffold (Vite, React, TypeScript, Vitest; GitHub Pages deploy)
- [x] Game engine (base rules, deterministic `applyAction`, tests)
- [x] Hot-seat UI (SVG board, panels, dialogs, phones and tablets)
- [x] Heuristic AI opponents + player-to-player trading
- [x] Trained-network AI levels (Easy / Normal / Hard) for the base game
- [x] Online multiplayer on Firebase Realtime Database: room codes and invite links, rejoin, spectators, in-game chat
- [x] Every rule set online: base game (any map), Seafarers, Cities & Knights, Traders & Barbarians, plus the T&B variants
- [x] End-of-game match graph + step-by-step replay
- [x] In-app rulebook with search
- [x] Map builder (custom maps) + scenario preview for checking boards against the rulebooks
- [ ] Post-game AI analysis — highlight likely misplays from the action log (held wood + brick instead of building; bank-traded into a 7-out; settled on a weak spot)

### 2. CATAN (base game)

- [x] 3–4 players
- [x] 5–6 player extension (CATAN 5–6 board and number tokens, paired-player turns)
- [x] 7–8 players (unofficial: 37-hex board, scaled bank and dev deck, VP target stays 10)
- [x] The rulebooks' beginner boards: "Beginner set-up (rulebook)" on the Base map list — the fixed board, harbors and starting pieces of the base (3–4) and 5–6 rulebooks; the game starts at the first roll (3 players drop Red; at 5 one color's settlements stay as inactive pieces)
- [x] Fun Maps (colonist.io-style) at 3–4 players: Gold Rush, Volcano, Black Forest, Diamond, Gear, Lakes, Pond, Twirl
- [x] Fun Maps at 5–6 players: all eight (Gold Rush, Pond, Black Forest, Lakes on the 5–6 board; a 25-hex Diamond, a 28-hex nine-tooth Gear, a 34-hex two-tailed Twirl and a 31-hex round Volcano island)
- [ ] Tighten the Diamond / Gear / Twirl hex positions (shapes are close, not exact)

### 3. Seafarers

- [x] 3–4 players: all 9 scenarios (2025 rulebook), plus alternate "… 2" maps of the first four
- [x] 5–6 player extension: all 9 scenarios (The Six Islands is The Four Islands' 5–6 map)
- [x] The 5–6 maps checked hex by hex against the 5–6 rulebook (Heading for New Shores, Six Islands, Fog Islands and Through the Desert re-transcribed; the other five matched apart from the frame's two sea points)
- [x] New World: a new random board every game (rulebook frame and components, separate islands, red-number swap, random harbors), 3–6 players
- [ ] 7–8 players — no official version; would need new boards per scenario (`createGame` refuses Seafarers above 6)

### 4. Cities & Knights

- [x] 3–4 players (2025 rulebook): knights, barbarians, commodities, city improvements + metropolises, all 54 progress cards, city walls, merchant; drawn pieces; heuristic AI; the rulebook's first-game board
- [x] 5–6 player extension (5–6 board, paired turns, extra commodities)
- [ ] Combined with Seafarers (ships as roads, pirate on the barbarian track, knights on sea intersections) — refused today
- [ ] Gold Rush and Volcano maps under C&K (the C&K roll has no gold pick or eruption step) — refused today
- [ ] Pillage when you're out of settlements: the rulebook turns the city on its side; here it becomes a 6th settlement

### 5. Traders & Barbarians

- [x] 3–4 players (2025 rulebook), all five scenarios: Rivers of Catan, Fishing on Catan, Merchant Trains, Barbarian Attack, Traders & Barbarians
- [x] Variants: Friendly Robber, Strongest Ports, Catan Event Cards — work with any game (Event Cards: all but Cities & Knights)
- [ ] Catan for Two variant (2 players + neutral pieces and trade tokens, with its per-scenario changes)
- [ ] Catan Event Cards with Cities & Knights (event die + red die alongside the card, the C&K versions of five events) — refused today
- [ ] Catan Event Cards' printed deck: the rulebook doesn't list each card's number, so the deck follows the dice odds with an assumed event mix
- [ ] The T&B scenarios combined with Seafarers (the rulebook allows it) — refused today
- [x] 5–6 player extension: Rivers of Catan, Fishing on Catan, Merchant Trains, Barbarian Attack on the T&B 5–6 maps
- [ ] 5–6 player extension: the Traders & Barbarians scenario (its 5–6 map is in the T&B 5–6 rulebook)

### 6. Explorers & Pirates

- [x] 3–4 players (2025 rulebook): the complete Explorers & Pirates scenario: exploration, harbor settlements, ships with settlers and crews, the Movement phase, the pirate ship, gold, the three missions (pirate lairs, fish, spices) with their tracks and bonus tiles, spice farm advantages; heuristic AI; online play
- [ ] The Mission Guide's four intro scenarios (Land Ho!, Pirate Lairs, Fish for Catan, Spices for Catan): the Mission Guide (book 2) isn't in `docs/`
- [ ] The pirate lair tokens' numbers aren't printed in the rulebook: assumed 3, 4, 5, 9, 10, 11
- [ ] 2-player variant (neutral harbor settlement + settlement)
- [ ] 5–6 player extension

### 7. Rivals for Catan (2-player card game)

- [ ] Base game
- [ ] Era of Gold
- [ ] Era of Turmoil
- [ ] Era of Progress
- [ ] Era of Barbarians
- [ ] Era of Merchants

### Fun Map ideas (optional backlog, not on the roadmap)

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

Intentionally **not** included: accounts or sign-in screens, matchmaking, monetization, anti-cheat, saved games. Friends-only project — none of that pays for itself at this scale.

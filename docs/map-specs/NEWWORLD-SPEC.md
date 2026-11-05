# New World — random board (Seafarers)

How the New World scenario deals a fresh board every game. Code:
`src/game/modules/seafarers/board/newWorldBoard.ts` (generator),
`src/game/modules/seafarers/board/scenarios/newWorld.ts` (scenario record),
tests in `newWorldBoard.test.ts` next to the generator and
`src/ai/seafarers/newWorld.sim.test.ts`.

## What the rulebook says

Seafarers (2025) p. 20, Seafarers 5–6 p. 12 ("Gather the hexes listed and
randomly place them within the frame. Then continue the setup as described in
Seafarers."):

1. Gather the listed hexes and place them face up at random in the frame.
   "Players may take this opportunity to agree to shift the setup of the hexes
   if they would like to change the number or size of islands."
2. Place the listed number discs at random on the land hexes. "If 2 red number
   discs end up on adjacent hexes, swap one of them with an adjacent black
   number hex so that all the red number discs are separated."
3. Players take turns placing a random port face up, on an edge between a land
   hex and a sea hex or between a land hex and the frame, at least one edge away
   from every other port.
4. The robber and the pirate go on the indicated locations — the picture puts
   both **on the frame**, beside the board (pirate on the west side, robber on
   the east), at both player counts.
5. Starting settlements on one island or two: those are your home islands.
   Your first settlement on each other island earns 1 VP (whoever else is
   already there). 12 VP wins.
6. Further options: "Gold fields should not receive red number discs."

Frame (counted from the pictures; pointy-top rows, top to bottom; axial
`(q, r)` with `x = q + r/2`):

| Players | Rows | Positions | Axial rows `r: q range` |
| --- | --- | --- | --- |
| 3–4 | 5, 6, 7, 6, 7, 6, 5 | 42 | −3: 0..4 · −2: −1..4 · −1: −2..4 · 0: −2..3 · 1: −3..3 · 2: −3..2 · 3: −3..1 |
| 5–6 | 8, 9, 10, 9, 10, 9, 8 | 63 | −3: −2..5 · −2: −3..5 · −1: −4..5 · 0: −4..4 · 1: −5..4 · 2: −5..3 · 3: −5..2 |

Components (the scenario tables):

| | Sea | Gold | Hills | Forest | Pasture | Fields | Mountains | Desert | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3–4 | 19 | – | 4 | 5 | 5 | 5 | 4 | – | 42 |
| 5–6 | 21 | 4 | 7 | 7 | 7 | 7 | 7 | 3 | 63 |

| Discs | 2 | 3 | 4 | 5 | 6 | 8 | 9 | 10 | 11 | 12 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3–4 | 1 | 3 | 3 | 3 | 2 | 2 | 3 | 3 | 2 | 1 | 23 |
| 5–6 | 2 | 3 | 4 | 5 | 5 | 5 | 5 | 4 | 4 | 2 | 39 |

Both disc sets are symmetric around 7 except one extra disc on the 3 / 11 pair
(3–4: three 3s, two 11s; 5–6: three 3s, four 11s) — the smallest asymmetry, on
a rare pair, as the project's token rule asks. Discs equal the producing land
hexes exactly (23; 42 land − 3 deserts = 39).

Harbors: 3–4 has 5 × 2:1 (one per resource) + 5 × 3:1; 5–6 has 6 × 2:1 + 5 ×
3:1 — the Seafarers 5–6 box adds one port token, a wool 2:1 (component list,
p. 1).

## The generator

All randomness comes from the seeded `rngState` that `createGame` threads
through `generateSeafarersBoard` (`Scenario.randomLayout`), so every device
in an online game deals the same board. It returns a fully pinned
`ScenarioLayout` (every hex has a fixed terrain and number, every harbor a
fixed type) that the shared assembler turns into the board; no other scenario
calls it or draws extra randomness.

1. **Shape (the "shift the setup" step).** A literal random deal of 23 land
   among 42 positions almost always makes one continent: in 20,000 simulated
   deals the largest island had a median of 19 of the 23 land hexes, and at
   5–6 players 49 % of deals were a single island. So the table's "shift the
   setup" option is done up front: draw an island count (3–4 players: 3, 4, 4
   or 5; 5–6: 4, 5, 5 or 6), put that many seeds at random at least 3 hexes
   apart, then grow the islands one hex at a time — the island furthest below
   a random share grows next, onto a free hex beside it (weighted by how many
   of its hexes that hex touches, squared, for compact islands) that touches
   no other island. Islands therefore never touch and every frame position
   left over is sea, so the 19 / 21 sea hexes come out exactly. A shape is
   kept when every island has 2–12 hexes (5–6: 3–20); otherwise it's redrawn
   (up to 80 tries; over 10,000 seeds at each size it never took more than 3
   at 3–4 players or 9 at 5–6). Results:
   3–4 players 3 / 4 / 5 islands about 25 / 52 / 23 % of the time; 5–6
   players 4 / 5 / 6 islands about 35 / 60 / 4 %. If the shape step ever
   failed it would fall back to the rulebook's plain deal.
2. **Terrain.** The land hexes (deserts included) are shuffled onto the land
   positions. A deal is redrawn if an island would have fewer than two
   producing hexes (5–6 only: a desert-heavy islet).
3. **Number discs.** Shuffled onto the producing land. Then the rulebook's
   swap: while a red disc (6 / 8) touches another red disc or sits on gold,
   it changes places with a black disc whose hex has no other red neighbour
   and isn't gold — an adjacent one when there is one (the rulebook's
   wording), otherwise any. Every swap removes a conflict and adds none.
4. **Harbors.** The harbor tokens are shuffled; each in turn goes on a random
   land / sea or land / frame edge that shares no corner with a harbor
   already placed (the rulebook's "at least one edge away"). Players choosing
   spots is replaced by a uniform random choice.
5. **Robber and pirate.** The robber starts off the board
   (`Scenario.robberStartsOffBoard` → `state.robberActive = false`; the engine
   already supports this for Fishing on Catan and Merchant Trains): nothing is
   blocked, and the first 7 or Knight puts it on any land hex. The engine has
   no off-board pirate (`board.pirateHex` undefined means "no pirate in this
   scenario"), so the pirate starts on the sea hex touching the fewest land
   hexes, preferring the rim of the frame, ties at random — the closest thing
   to the frame.

If any step can't finish (no separable disc deal, no open harbor edge), the
whole board is redealt (up to 40 times). Over 10,000 seeds at each size no
board was ever redealt and the plain-deal fallback never ran; a board takes
1–2 ms.

## Islands and the bonus

Islands are the connected land components (`identifyIslands`; deserts count
as land). `bonusOnEveryIsland` puts a 1 VP chip on every island, the largest
included; a player's starting settlements mark their home islands. Starting
settlements may go anywhere (`startingPlacementZone: 'anyIsland'`).

## Checking

- `npx vitest run src/game/modules/seafarers/board/newWorldBoard.test.ts` —
  frame, counts, discs, harbors, islands, chips over 200 seeds at each size.
- `node scripts/render-board.mjs seafarers:newWorld --players 4 --seed N
  --coords --out DIR` (dev server running) renders one deal; try several seeds
  at 3, 4, 5 and 6 players. 3 and 4 players share a deal for the same seed, as
  5 and 6 do.

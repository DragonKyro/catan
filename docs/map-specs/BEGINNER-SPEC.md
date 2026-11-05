# Beginner boards ("Starting Set-up for Beginners") — 3-4 and 5-6 players

The fixed boards the CATAN rulebooks print for a first game, with every
color's two settlements and two roads already on the map. Code:
`src/game/modules/base/scenarios/beginner.ts` (board + pieces),
`startingSetup.ts` (seating, placement, starting resources), wired in
`createGame`. Pinned by `beginner.test.ts` (every hex, harbor, settlement and
road by the hexes it touches) and `src/ai/beginner.sim.test.ts`.

Sources: `docs/catan base rules.pdf` p.2-3 (Illus. A), p.13 (Illus. R and the
"Starting Set-up for Beginners" almanac entry) and the back cover (p.16,
the largest print, used for measuring); `docs/catan 5-6 rules.pdf` p.4-5
("Starting Set-up for 5-6 New Players"). Measured from 300-2400 DPI PyMuPDF
crops.

## Conventions

Axial pointy-top coordinates, as everywhere else: hex centre
x = W·(q + r/2), y = 1.5·S·r. Corners clockwise from the north-east one:
0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N. Side d = the edge between corners d and
d + 1: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE. Neighbour across side d:
E (q+1, r), SE (q, r+1), SW (q-1, r+1), W (q-1, r), NW (q, r-1),
NE (q+1, r-1).

Measured grids: back cover at 300 DPI W ≈ 242 px, 1.5·S ≈ 209 px, origin
(0,0) at (805, 723) in the crop; 5-6 page at 500 DPI W ≈ 165 px,
1.5·S ≈ 141.7 px, origin at (627, 603). Every printed number disc sat within
a few px of its computed hex centre; every settlement / road end within
~10 px of its computed corner.

## Rule text

Base (p.13): assemble the frame and place the hexes "exactly as shown",
"Place 2 settlements and 2 roads of each color as shown. If only 3 are
playing, remove the red pieces. Each player receives the 3 resources from the
terrain hexes adjacent to their settlement marked by the white star." The
starting player then rolls; there are no placement rounds.

5-6 (p.4-5): "For your first 5-6 player game: Use the Starting Set-up for
5-6 New Players … give each player their starting resources from the
settlements marked with white stars." "For your first 5 player game: One
color remains inactive in the game. To determine which color, a player takes
1 road of each color … The remaining road is the inactive color. Leave that
color's settlements on the board as inactive settlements, but remove the
roads." The picture shows no robber; the experienced set-up says to put it
"on either of the desert hexes".

## 3-4 players

| r \ q | -2 | -1 | 0 | 1 | 2 |
|---|---|---|---|---|---|
| -2 | | | mountains 10 | pasture 2 | forest 9 |
| -1 | | fields 12 | hills 6 | pasture 4 | hills 10 |
| 0 | fields 9 | forest 11 | desert (robber) | forest 3 | mountains 8 |
| 1 | forest 8 | mountains 3 | fields 4 | pasture 5 | |
| 2 | hills 5 | fields 6 | pasture 11 | | |

Counts: 4 forest, 3 hills, 4 pasture, 4 fields, 3 mountains, 1 desert; the
18 standard discs. No two red discs touch.

Harbors (land hex, side, sea hex across, type) — each matched by the two
piers, which end on the two corners of that side:

| land hex | side | sea hex | type |
|---|---|---|---|
| (0,-2) mountains 10 | 4 NW | (0,-3) | 3:1 |
| (1,-2) pasture 2 | 5 NE | (2,-3) | 2:1 grain |
| (2,-1) hills 10 | 5 NE | (3,-2) | 2:1 ore |
| (2,0) mountains 8 | 0 E | (3,0) | 3:1 |
| (1,1) pasture 5 | 1 SE | (1,2) | 2:1 wool |
| (-1,2) fields 6 | 1 SE | (-1,3) | 3:1 |
| (-2,2) hills 5 | 2 SW | (-3,3) | 3:1 |
| (-2,1) forest 8 | 3 W | (-3,1) | 2:1 brick |
| (-1,-1) fields 12 | 3 W | (-2,-1) | 2:1 lumber |

The back cover's labels agree: "D" (only hills + mountains) is (2,-1)'s SE
corner, not a harbor; "E" (only pasture, "also at a wool harbor") is (1,1)'s
SE corner, an end of the wool harbor.

Pieces (settlement as the hexes it touches; road as the two hexes it lies
between; ★ = pays the starting resources):

| color | settlement 1 | road 1 | settlement 2 | road 2 | start hand |
|---|---|---|---|---|---|
| Red | (0,-2) (1,-2) (0,-1) "A" | (0,-1)/(1,-2) | ★ (-2,0) (-1,0) (-2,1) | (-1,0)/(-2,1) | grain, 2 lumber |
| Blue | ★ (-2,1) (-1,1) (-2,2) | (-1,1)/(-2,2) | (0,1) (1,1) (0,2) | (0,1)/(1,1) | lumber, ore, brick |
| Orange | (1,-1) (2,-1) (2,-2) "B" | (1,-1)/(2,-2) | ★ (-1,1) (0,1) (-1,2) | (0,1)/(-1,2) | ore, 2 grain |
| White | ★ (-1,-1) (0,-1) (-1,0) | (-1,-1)/(-1,0) | (1,0) (2,0) (1,1) "C" | (1,0)/(2,0) | grain, brick, lumber |

As corner / side refs: Red (0,-1)c5 + (0,-1)s5, (-1,0)c3 + (-1,0)s2;
Blue (-1,1)c3 + (-1,1)s2, (0,1)c1 + (0,1)s0; Orange (1,-1)c0 + (1,-1)s5,
(0,1)c3 + (0,1)s2; White (-1,0)c5 + (-1,0)s4, (1,0)c1 + (1,0)s0.

No starting settlement stands on a harbor. 3 players: Red's pieces are not
placed.

## 5-6 players

| r \ q | -3 | -2 | -1 | 0 | 1 | 2 |
|---|---|---|---|---|---|---|
| -3 | | | | hills 10 | pasture 6 | desert (robber) |
| -2 | | | hills 6 | fields 2 | mountains 9 | hills 11 |
| -1 | | forest 3 | mountains 11 | forest 5 | fields 10 | pasture 4 |
| 0 | desert | pasture 5 | fields 4 | mountains 6 | pasture 3 | fields 8 |
| 1 | forest 12 | mountains 10 | pasture 2 | hills 4 | forest 11 | |
| 2 | forest 8 | fields 3 | forest 9 | fields 5 | | |
| 3 | hills 9 | pasture 12 | mountains 8 | | | |

Counts: 6 forest, 5 hills, 6 pasture, 6 fields, 5 mountains, 2 deserts; 28
discs (two 2s, three each of 3-6 and 8-11, two 12s).

Harbors:

| land hex | side | sea hex | type |
|---|---|---|---|
| (0,-3) hills 10 | 4 NW | (0,-4) | 3:1 |
| (1,-3) pasture 6 | 5 NE | (2,-4) | 2:1 wool |
| (2,-2) hills 11 | 5 NE | (3,-3) | 3:1 |
| (2,0) fields 8 | 0 E | (3,0) | 3:1 |
| (1,1) forest 11 | 1 SE | (1,2) | 2:1 brick |
| (-1,3) mountains 8 | 0 E | (0,3) | 2:1 wool |
| (-2,3) pasture 12 | 1 SE | (-2,4) | 2:1 lumber |
| (-3,3) hills 9 | 2 SW | (-4,4) | 3:1 |
| (-3,2) forest 8 | 3 W | (-4,2) | 2:1 grain |
| (-3,0) desert | 2 SW | (-4,1) | 3:1 |
| (-2,-1) forest 3 | 3 W | (-3,-1) | 2:1 ore |

Icons were told apart against the base board's: wool = olive sheep with a
green fringe, ore = dark rock without green.

Pieces:

| color | settlement 1 | road 1 | settlement 2 | road 2 | start hand |
|---|---|---|---|---|---|
| Red | (-1,-2) (-2,-1) sea (-2,-2) | (-1,-2)/(-2,-1) | ★ (-1,0) (-2,0) (-2,1) | (-2,0)/(-2,1) | grain, wool, ore |
| Blue | ★ (0,0) (1,0) (0,1) | (0,0)/(1,0) | (2,0) (1,1) sea (2,1) | (2,0)/(1,1) | ore, wool, brick |
| Green | (0,-3) (1,-3) sea (1,-4) | (0,-3)/(1,-3) | ★ (-1,0) (-1,-1) (0,-1) | (-1,-1)/(0,-1) | grain, ore, lumber |
| White | (2,-2) (2,-1) sea (3,-2) | (2,-2)/(2,-1) | ★ (0,0) (0,-1) (1,-1) | (0,-1)/(1,-1) | ore, lumber, grain |
| Orange | ★ (0,0) (-1,0) (-1,1) | (-1,0)/(-1,1) | (-3,2) (-3,3) sea (-4,3) | (-3,2)/(-3,3) | ore, grain, wool |
| Brown | ★ (0,1) (-1,1) (-1,2) | (0,1)/(-1,2) | (0,2) (-1,3) sea (0,3) | (0,2)/(-1,3) | brick, wool, lumber |

The start hands match the three cards the page prints beside each color.
Brown's second settlement stands on the (-1,3) 2:1 wool harbor.

As corner / side refs: Red (-1,-2)c3 + (-1,-2)s2, (-1,0)c3 + (-2,0)s1;
Blue (0,0)c1 + (0,0)s0, (2,0)c2 + (2,0)s2; Green (0,-3)c0 + (0,-3)s0,
(-1,0)c5 + (-1,-1)s0; White (2,-2)c1 + (2,-2)s1, (0,0)c5 + (0,-1)s0;
Orange (0,0)c3 + (-1,0)s1, (-3,2)c2 + (-3,2)s1; Brown (0,1)c3 + (0,1)s2,
(0,2)c2 + (0,2)s2.

## Engine choices

- Seats → colors: a player whose chosen color is a slot's color takes that
  slot (Green = palette `forest`, Brown = `brown`); everyone else takes the
  free slots in turn order, in the order Red, Blue, Orange, White (3-4) /
  Red, Blue, Green, White, Orange, Brown (5-6).
- 5 players: the inactive color is drawn with the seeded RNG from the slots
  no player's color claimed. Its two settlements go to
  `GameState.inactiveSettlements`: they count for the distance rule, block
  roads and Longest Road through their corner, produce and score nothing,
  and are drawn as hatched grey settlements (`InactiveSettlements.tsx`).
- Robber at 5-6: the top desert (2,-3) (the picture shows none).
- The game starts in `rollOrPlayKnight` with the first player in turn order
  (the rulebook's "oldest player"); there is no setup phase.
- Not with Cities & Knights (its setup places a city; it has its own
  first-game board). Not offered to the trained networks
  (`supportsNeuralAi` is false off the standard map, and their card
  counter needs empty hands at game creation). T&B variants work.

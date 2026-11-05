# Seafarers 5-6 (2025 rulebook) — board specs A: Heading for New Shores, The Six Islands, The Fog Islands, Through the Desert

Transcribed from `docs/catan seafarers 5-6 rules.pdf`, pages 4-7 (the four "basic rules" scenarios).
The other four 5-6 maps are in `SEAFARERS56-SPEC-B.md`. Code:
`src/game/modules/seafarers/board/scenarios/` (`headingForNewShores.ts`, `fourIslands.ts` — The Six
Islands is Four Islands' 5-6 geometry —, `fogIsland.ts`, `throughTheDesert.ts`, the `LAYOUT_5_6P` blocks,
written as rows through `frame5_6.ts`); pinned by `fiveSix.a.test.ts` next to them.

## Method

Each map is one embedded raster image, extracted at its native resolution (page 4 xref 2300, 1474×1041 px;
p5 xref 2544, 1478×1044; p6 xref 3024, 1508×1508; p7 xref 3263, 1496×967). Calibration on those images
(pointy-top, hex (q,r) centre = (x0 + W·(q + r/2), y0 + 1.5·S·r)):

| Page | Scenario | W (px) | 1.5·S (px) | x0 | y0 |
|---|---|---|---|---|---|
| 4 | Heading for New Shores | 138 | 118 | 807 | 517 |
| 5 | The Six Islands | 138 | 118 | 809 | 518 |
| 6 | The Fog Islands | 128 | 110.5 | 815 | 760 |
| 7 | Through the Desert | 128 | 110.5 | 747 | 481 |

The axial grid drawn over each image with these numbers lines up with every hex boundary. Corners: 0 NE,
1 SE, 2 S, 3 SW, 4 NW, 5 N; edge d = between corners d and d+1 (0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE).
Neighbours: E (+1,0), W (-1,0), NE (+1,-1), NW (0,-1), SE (0,+1), SW (-1,+1).

Harbors: every sign is the 2025 tombstone shape (the "1x 2:1 port" component on p. 1 shows it), whose
flat base lies on the coastal edge and whose dome points away from it. Each sign's base was matched to
the hex edge under it on a zoomed crop with the grid and edge numbers drawn on; the base decides the
edge even where a sign sits over a notch between two coastal edges.

## The frame and the sea count

Same finding as SPEC-B: the 5-6 frame is an elongated hexagon whose middle row has a full sea hex at each
point, drawn with the same thin tile outline as every other sea hex (on Six Islands the pirate starts on
the west one). The component tables count 2 fewer sea hexes than the map shows on every one of these four
maps: the tables leave those two points out. The engine has them as ordinary sea hexes. Frame rows
(first q .. last q):

- 56-hex maps (Heading for New Shores, Six Islands, Fog Islands): r=-3: -2..4, r=-2: -3..4,
  r=-1: -4..4, r=0: -5..4, r=1: -5..3, r=2: -5..2, r=3: -5..1 (58 positions; points (-5,0) and (4,0)).
- 63-hex map (Through the Desert): r=-3: -2..5, r=-2: -3..5, r=-1: -4..5, r=0: -5..5, r=1: -5..4,
  r=2: -5..3, r=3: -5..2 (65 positions; points (-5,0) and (5,0)).

Table sea / map sea: Heading for New Shores 16 / 18, Six Islands 24 / 26, Fog Islands 14 face-up / 16,
Through the Desert 20 / 22. Every other count (land, number discs, harbors, the fog stack) matches the
table exactly. Nothing outside these rows is a hex: the r = ±4 bands and the slanted sides are frame.

Rows below list every frame position from west to east: `~` sea, `D` desert, `?` a random main-island
hex (Heading for New Shores), `f` a face-down fog hex (Fog Islands), `G` gold, `B` hills (brick),
`F` forest (wood), `P` pasture (sheep), `W` fields (wheat), `O` mountains (ore); a number is the printed
disc.

"6x 2:1 ports" (pp. 4, 5, 7): the five CATAN 2:1 harbors plus the Seafarers 5-6 one, which is a sheep
2:1 (p. 1 component picture; the Fog Islands map prints the same set: two sheep 2:1). So the random
harbor pool is brick, wood, sheep, sheep, wheat, ore 2:1 + 5 × 3:1.

## Heading for New Shores (p. 4)

"Set up the small islands as shown. The main island is created using the CATAN 5–6 Variable Setup rules,
randomly placing ports on the indicated locations. Then place the pirate on the indicated location."

| r | first q | hexes |
|---|---|---|
| -3 | -2 | G9 ~ ? ? ? ~ O6 |
| -2 | -3 | O11 ~ ? ? ? ? ~ ~ |
| -1 | -4 | P8 ~ ? ? ? ? ? ~ B12 |
| 0 | -5 | ~ ~ ? ? ? ? ? ? ~ ~ |
| 1 | -5 | B4 ~ ? ? ? ? ? ~ W3 |
| 2 | -5 | F2 ~ ? ? ? ? ~ ~ |
| 3 | -5 | G5 ~ ? ? ? ~ G10 |

- Main island = the CATAN 5-6 board shape (rows of 3-4-5-6-5-4-3, the 30 `?`). Its contents are the
  table minus the small islands: hills 5, forest 6, pasture 6, fields 6, mountains 5, desert 2 (exactly
  the CATAN + 5-6 hex set) and the 28 CATAN 5-6 discs (2, 12 × 2; 3-11 × 3), placed at random with no
  adjacent 6 / 8; robber on a desert.
- Small islands, fixed (the gold fields are the waterfall tiles): west (-2,-3) gold 9, (-3,-2) mountains
  11, (-4,-1) pasture 8; south-west (-5,1) hills 4, (-5,2) forest 2, (-5,3) gold 5; east (4,-3) mountains
  6, (4,-1) hills 12, (3,1) fields 3, (1,3) gold 10. Totals with the main island: gold 3, each resource 7,
  desert 2 (40 land); discs 2 × 3, 3-11 × 4, 12 × 3 (38) — the table.
- Pirate on (4,0), the east point of the frame.
- 11 harbors (random types), all on the main island: (1,-3) NE, (-1,-2) NW, (2,-2) NE, (-2,-1) W,
  (2,-1) E, (-3,0) SW, (2,0) SE, (0,2) E, (-3,2) SW, (-2,3) SW, (-1,3) SE.
- Dark-blue outlines ("Areas outlined in dark blue are the small islands", 3-4 rules p. 4): the two west
  islands are 3 connected hexes each, but each east outline wraps two single land hexes AND the sea hex
  between them — {(4,-3), (4,-2) sea, (4,-1)} and {(3,1), (2,2) sea, (1,3)}. Read literally the map has 4
  small islands; the engine's islands are connected land, so it sees 6 (each east hex its own island)
  and pays the 2 VP bonus up to 6 times instead of 4. Fixing that needs an island-grouping hook in the
  generator (not in this pass; see the report).
- 14 VP (unchanged from 3-4).

## The Six Islands (p. 5)

Fixed setup ("Set up the small islands as shown"); "Place the robber on the pasture hex with the number
12 disc and the pirate on the indicated location. Randomly place ports in the indicated locations."

| r | first q | hexes |
|---|---|---|
| -3 | -2 | P12 O4 ~ F6 ~ O9 P6 |
| -2 | -3 | F8 O10 ~ O11 B10 ~ W3 B10 |
| -1 | -4 | B11 W9 ~ P3 F4 ~ ~ F4 ~ |
| 0 | -5 | ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ |
| 1 | -5 | ~ B4 ~ ~ P8 F10 ~ F5 W6 |
| 2 | -5 | F9 W12 ~ W5 O3 ~ B8 P9 |
| 3 | -5 | P5 O6 ~ P2 ~ B5 W2 |

- Islands: north-west 6 hexes (P12 O4 F8 O10 B11 W9), north 5 (F6 O11 B10 P3 F4), north-east 5 (O9 P6 W3
  B10 F4), south-west 5 (B4 F9 W12 P5 O6), south 5 (P8 F10 W5 O3 P2), south-east 6 (F5 W6 B8 P9 B5 W2).
- Counts: hills 6, forest 7, pasture 7, fields 6, mountains 6 (32); discs 2 × 2, 3 × 3, 4 × 4, 5 × 4,
  6 × 4, 8 × 3, 9 × 4, 10 × 4, 11 × 2, 12 × 2 (32) — the table (not symmetric around 7: it is printed
  that way).
- Robber on the pasture 12, (-2,-3). Pirate on (-5,0), the west point of the frame.
- 11 harbors (random types): (-1,-3) NW, (1,-3) NE, (4,-3) NE, (-2,-2) SE, (-3,-1) SW, (3,-2) SW,
  (-5,2) W, (-4,3) NE, (-2,2) SW, (2,2) E, (0,3) SW.
- Start on one or two islands; every island but your home island(s) pays 2 VP (as The Four Islands).
  13 VP.

## The Fog Islands (p. 6)

"Set up the game as shown, including creating the facedown hex and number disc stacks for the fog
islands. Place the robber on the field hex with the number 12 disc and the pirate on the indicated
location."

| r | first q | hexes |
|---|---|---|
| -3 | -2 | F10 ~ f f ~ F9 W2 |
| -2 | -3 | P6 ~ f f f ~ W5 O12 |
| -1 | -4 | W12 B4 ~ f f f ~ P4 B8 |
| 0 | -5 | ~ O11 P5 ~ f f ~ F6 P3 ~ |
| 1 | -5 | W6 F3 ~ f f f ~ O9 W4 |
| 2 | -5 | B9 P8 ~ f f f ~ B10 |
| 3 | -5 | B11 O10 ~ f f ~ F8 |

- Two fixed 12-hex islands (west, east). Face-up counts: hills 5, forest 5, pasture 5, fields 5,
  mountains 4 (24); discs 2, 3 × 2, 4 × 3, 5 × 2, 6 × 3, 8 × 3, 9 × 3, 10 × 3, 11 × 2, 12 × 2 (24) — the
  table.
- 18 fog hexes (the white area). Face-down stack: sea 3, gold 3, hills 2, forest 2, pasture 2, fields 2,
  mountains 3, desert 1; face-down discs 2 × 2, 3 × 2, 4, 5 × 2, 6, 8, 9, 10, 11 × 2, 12 (14) — the table.
- Harbors printed with their types (fixed): west (-3,-2) NW 3:1, (-3,-1) E sheep, (-4,0) W ore, (-5,2) W
  3:1, (-4,3) NE 3:1; east (3,-3) NE wood, (4,-1) NE 3:1, (3,-2) SW sheep, (3,1) NE brick, (3,1) SE wheat,
  (2,2) W 3:1 (5 × 3:1 + 6 × 2:1, as the table).
- Robber on the fields 12, (-4,-1).
- Pirate: printed on the frame below the two southern fog hexes (position (-2,4), outside the frame
  rows), where the engine can't hold it. It goes on (0,3) instead: of the sea hexes touching the fewest
  land / fog hexes ((-1,-3), (2,-3), (-3,3), (0,3), each one land + two fog) the two nearest the printed
  spot are (-3,3) and (0,3); (0,3) matches the 3-4 map, where the pirate starts just east of the southern
  fog.
- No island bonus; start on one or two islands. 12 VP.

## Through the Desert (p. 7)

"Set up the board as shown. Place the robber on any of the desert hexes and the pirate on the indicated
location. Randomly place ports in the indicated locations." Every hex and disc is printed.

| r | first q | hexes |
|---|---|---|
| -3 | -2 | G4 O6 B11 ~ F12 W5 O3 B6 |
| -2 | -3 | F5 P2 D D D D D ~ ~ |
| -1 | -4 | ~ ~ ~ W2 F8 P9 F10 ~ ~ G10 |
| 0 | -5 | ~ O4 F5 W10 B5 P10 F4 B8 ~ ~ ~ |
| 1 | -5 | P12 W3 B12 O6 B11 O3 W9 ~ ~ O8 |
| 2 | -5 | B9 O11 ~ ~ ~ ~ ~ P11 F3 |
| 3 | -5 | P6 ~ P8 W2 ~ G4 ~ W9 |

- The desert strip (-1,-2) .. (3,-2) cuts off two areas north of it, which the map outlines in dark blue
  as small islands: north-west (G4 O6 B11 F5 P2) and north-east (F12 W5 O3 B6). With `desertIsBoundary`
  the engine splits them off the main island too. The main island is everything south of the strip
  (21 hexes; starting settlements go there). Small islands: (5,-1) gold 10; the east group O8 P11 F3 W9;
  the south pair P8 W2; (0,3) gold 4.
- Counts: gold 3, each resource 7, desert 5 (43 land); discs 2 × 3, 3-11 × 4, 12 × 3 (38) — the table.
- Robber on a desert (the engine uses the middle one, (1,-2)). Pirate on (1,3).
- 11 harbors (random types), all on the main island: (-4,0) NW, (-2,0) NW, (2,-1) E, (-5,1) NW, (2,0) SE,
  (-3,1) SE, (-1,1) SW, (1,1) SW, (-5,2) W, (-4,2) SE, (-5,3) SW.
- 14 VP.

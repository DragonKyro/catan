# Seafarers 5-6 (2025 rulebook) — board specs B: Forgotten Tribe, Cloth for Catan, Pirate Islands, Wonders of Catan

Transcribed from `docs/catan seafarers 5-6 rules.pdf`, pages 8-11 (the four fixed-setup scenarios).
The other four 5-6 maps are in `SEAFARERS56-SPEC-A.md`. Code: `src/game/modules/seafarers/board/scenarios/`
(`forgottenTribe.ts`, `clothForCatan.ts`, `pirateIslands.ts`, `wondersOfCatan.ts`, the `HEXES_5_6P` /
`*_5_6P` blocks); pinned by `fiveSix.b.test.ts` next to them.

## Method

Each map is one embedded raster image (page 8 xref 3499, p9 3759, p10 4684, p11 4951); the crops were
rendered at 250 dpi over the image rect (p8 (9,167)-(585,554) pt, p9 (12,175)-(543,551), p10
(13,202)-(581,569), p11 (9,197)-(585,569)). Calibration on those crops (pointy-top, hex (q,r) centre =
(x0 + W·(q + r/2), y0 + 1.5·S·r), S = W/√3):

| Page | Scenario | W (px) | x0 | y0 |
|---|---|---|---|---|
| 8 | Forgotten Tribe | 170 | 1000 | 665 |
| 9 | Cloth for Catan | 171 | 1012.5 | 655 |
| 10 | Pirate Islands | 169 | 986 | 635 |
| 11 | Wonders of Catan | 170 | 1000 | 640 |

The axial grid drawn over each crop with these numbers lines up with every hex boundary. Corners: 0 NE,
1 SE, 2 S, 3 SW, 4 NW, 5 N; edge d = between corners d and d+1 (0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE).
Neighbours: E (+1,0), W (-1,0), NE (+1,-1), NW (0,-1), SE (0,+1), SW (-1,+1). Harbors: the coastal
edge whose outward normal points at the sign. Tribe tokens / cards: the edge whose midpoint they sit
on or point out from.

## The frame and the sea count

The 5-6 frame (Seafarers frame + the two 5-6 "sea frame pieces") is the elongated hexagon of 65 hex
positions (58 for Cloth for Catan's narrower board). Its west and east points in the middle row each
hold a full hex: (-5,0) / (5,0) — on Cloth for Catan (-5,0) / (4,0). They are drawn as sea hexes on all
four maps (Pirate Islands prints "WEST" / "EAST" on them, and Cloth for Catan's pirate starts on (4,0)),
but every component table's sea count is exactly 2 lower than the sea on its map: the tables leave the
two frame points out. The engine has them as ordinary sea hexes. Before this pass none of the four maps
had them (Cloth had (4,0) only), so the coast next to them was a frame edge instead of open sea.

Table sea / map sea: Forgotten Tribe 22 / 24, Cloth 24 / 26, Pirate Islands 26 / 28, Wonders 24 / 26.
Every other count (land terrains, number discs, ports) matches the table exactly.

Rows below list every frame position from west to east: `~` sea, `D` desert, `G` gold, `B` hills
(brick), `F` forest (wood), `P` pasture (sheep), `W` fields (wheat), `O` mountains (ore); a number is
the disc; land without a number has no disc (`noToken`).

## The Forgotten Tribe (p. 8)

| r | first q | hexes |
|---|---|---|
| -3 | -2 | D D ~ G G ~ P P |
| -2 | -3 | ~ ~ ~ ~ ~ ~ ~ ~ ~ |
| -1 | -4 | W3 B5 O11 P8 B4 F10 W4 B3 F8 O5 |
| 0 | -5 | ~ F11 P12 F5 W10 P5 B9 W2 P9 B10 ~ |
| 1 | -5 | F6 O4 W9 B8 F11 O3 P4 W6 F3 O6 |
| 2 | -5 | ~ ~ ~ ~ ~ ~ ~ ~ ~ |
| 3 | -5 | D D ~ O B ~ W G |

Counts: gold 3, hills 7, forest 7, pasture 7, fields 7, mountains 6, desert 4; discs 2, 3×4, 4×4,
5×4, 6×3, 8×3, 9×3, 10×3, 11×3, 12 (29). Pirate on (-3,3); robber on a desert ("any of the desert
hexes" — the engine uses (-2,-3)).

Tribe tokens (land hex, side → the position across):
- VP (10): (-2,-3) NW → (-2,-4); (-1,-3) NW → (-1,-4); (1,-3) NE → (2,-4); (2,-3) NW → (2,-4);
  (4,-3) NW → (4,-4); (-4,3) SW → (-5,4); (-2,3) SE → (-2,4); (-1,3) SW → (-2,4); (1,3) SE → (1,4);
  (2,3) SE → (2,4).
- Development cards (6): (-2,-3) W → (-3,-3); (2,-3) NE → (3,-4) (the tilted card); (5,-3) E → (6,-3);
  (-5,3) W → (-6,3); (-2,3) SW → (-3,4) (the tilted card); (2,3) E → (3,3).
- Ports (8, printed face up): (-1,-3) NE wheat; (1,-3) NW 3:1; (4,-3) NE wood; (5,-3) NE 3:1;
  (-5,3) SW brick; (-4,3) SE sheep; (-1,3) SE ore; (1,3) SW 3:1.

Matches the code as it was (only the two frame-point sea hexes were missing).

## Cloth for Catan (p. 9)

| r | first q | hexes |
|---|---|---|
| -3 | -2 | F4 P6 B5 W12 B3 P11 W8 |
| -2 | -3 | W3 F12 ~ ~ ~ ~ F3 O9 |
| -1 | -4 | W11 ~ ~ D ~ D ~ ~ P3 |
| 0 | -5 | ~ ~ G ~ ~ ~ ~ G ~ ~ |
| 1 | -5 | O8 ~ ~ D ~ D ~ ~ O2 |
| 2 | -5 | B9 W2 ~ ~ ~ ~ P11 O4 |
| 3 | -5 | P10 F6 O5 F11 F8 W10 B6 |

Two large islands (north: r=-3 plus (-3,-2) (-2,-2) (-4,-1) (3,-2) (4,-2) (4,-1); south: r=3 plus
(-5,1) (-5,2) (-4,2) (1,2) (2,2) (3,1)) and six one-hex small islands. Counts: gold 2, hills 4, forest
6, pasture 5, fields 6, mountains 5, desert 4; discs incl. the 12 villages 2×3, 3×4, 4×4, 5×4, 6×4,
8×4, 9×4, 10×4, 11×4, 12×3 (38). Robber on (-4,-1) (the pawn on the 11 fields), pirate on (4,0).

Villages (number disc on the small island's N / S corner): (-1,-1) N 2, S 5; (1,-1) N 10, S 8;
(-3,0) N 4, S 9; (2,0) N 4, S 5; (-2,1) N 6, S 12; (0,1) N 9, S 10.

Harbors (11 "?" = random: 5 resource 2:1 + the 5-6 sheep 2:1 + 5× 3:1): (-2,-3) NE, (1,-3) NW,
(3,-3) NW, (-3,-2) W, (4,-2) E, (3,1) E, (-5,2) W, (2,2) SE, (-4,3) SW, (-3,3) SE, (0,3) SE. The 5-6
expansion's extra port token is a sheep 2:1 (5-6 rulebook p. 1).

Matches the code as it was, except the west frame point (-5,0), which was missing.

## The Pirate Islands (p. 10)

| r | first q | hexes |
|---|---|---|
| -3 | -2 | G3 ~ O6 ~ ~ P5 W4 B9 |
| -2 | -3 | ~ ~ ~ ~ D ~ O3 B10 F11 |
| -1 | -4 | G11 D O8 ~ ~ ~ F12 F6 P4 F10 |
| 0 | -5 | ~ ~ ~ ~ D ~ W6 W4 O5 P8 ~ |
| 1 | -5 | G11 D O6 ~ ~ ~ P2 P10 B3 P5 |
| 2 | -5 | ~ ~ ~ ~ D ~ W11 O9 B8 |
| 3 | -5 | G3 ~ O8 ~ ~ F9 W5 F4 |

(-5,0) is the "WEST" hex, (5,0) the "EAST" hex. Counts: gold 4, hills 4, forest 6, pasture 6, fields 5,
mountains 7, desert 5; discs 2, 3×4, 4×4, 5×4, 6×4, 8×4, 9×3, 10×3, 11×4, 12 (32).

Fleet loop (arrows, clockwise): (1,-3) → (2,-3) → (2,-2) → (1,-1) → (0,0) → (0,1) → (0,2) → (-1,3) →
(-2,3) → (-2,2) → (-2,1) → (-2,0) → (-1,-1) → (0,-2) → back to (1,-3). The pirate ship starts on (-2,3);
"!" (no attack) on (-2,0).

Player slots (rulebook colours, seat order; 5 players leave out purple). Settlement + ship on the main
island; fortress = the coloured settlement with 3 lair tokens on a gold hex; beachhead = the coloured
disc on an ore hex.

| Colour | Settlement | Ship | Fortress | Beachhead |
|---|---|---|---|---|
| red | (3,-3) NW | (2,-3) NE | (-2,-3) NW | (0,-3) NE |
| white | (3,-3) S | (2,-2) NE | (-2,-3) S | (0,-3) S |
| blue | (1,0) N | (1,0) NW | (-4,-1) SE | (-2,-1) SE |
| orange | (1,0) S | (1,0) SW | (-5,1) NE | (-3,1) NE |
| green | (0,3) N | (0,3) NW | (-5,3) N | (-3,3) N |
| purple | (0,3) SW | (-1,3) SE | (-5,3) SW | (-3,3) SE |

Harbors (9 "?" = random: 5× 2:1 + 4× 3:1): (4,-3) NW, (5,-3) NW, (5,-3) E, (5,-2) E, (4,0) E,
(3,2) E, (2,3) E, (1,3) SW, (2,3) SW.

Matches the code as it was, except the two frame-point sea hexes.

## The Wonders of Catan (p. 11)

| r | first q | hexes |
|---|---|---|
| -3 | -2 | G8 ~ P10 ~ W12 ~ ~ ~ |
| -2 | -3 | ~ ~ B11 ~ F11 ~ ~ D D |
| -1 | -4 | ~ B2 P5 W6 B5 W3 P8 F11 D ~ |
| 0 | -5 | ~ ~ W9 O3 F4 O6 W10 P9 B10 D ~ |
| 1 | -5 | ~ ~ B8 P5 ~ B4 F8 O12 ~ ~ |
| 2 | -5 | G6 ~ F10 O3 ~ O9 W4 ~ F4 |
| 3 | -5 | ~ O5 F9 ~ P2 P11 ~ G6 |

Small islands (1 VP each): (-2,-3); (-5,2); (3,2) + (2,3) — 3 islands × 6 players = the table's 18 VP
tokens. Counts: gold 3, hills 6, forest 7, pasture 7, fields 6, mountains 6, desert 4; discs 2×2, 3×3,
4×4, 5×4, 6×4, 8×4, 9×4, 10×4, 11×4, 12×2 (35). Robber on (4,-1).

Markers:
- Great Wall (5): (3,-1) N, NE, SE; (3,0) NE, SE.
- Great Bridge (2): (-2,2) SE and (-1,3) NW (across the strait); X markers (-2,2) NE, (-2,2) S,
  (-1,3) N, (-1,3) SW.
- Lighthouse (2, 5-6 only): (0,-3) SE and (1,-2) NW; X markers (0,-3) NE, (0,-3) S, (1,-2) N,
  (1,-2) SW.

Harbors (11 "?" = random, as Cloth): (-2,-1) NW, (-1,-1) NE, (1,-1) NE, (-3,-1) W, (-1,0) SE, (-3,1) W,
(2,1) SE, (-3,2) W, (1,2) SE, (-4,3) SE, (-1,3) SE.

Setup: the 5-6 text adds nothing to the Seafarers rule ("may not be placed on an intersection with a
Great Bridge or Great Wall marker or on intersections with 'X' markers next to the Great Bridge
markers"). The lighthouse markers get the same treatment as the Great Bridge ones: their flanking X
markers would mean nothing if a starting settlement could stand on the marker itself (the distance
rule would already keep the X corners free), and the Lighthouse, like the Great Bridge and Great Wall,
"requires a building at one of the markers to begin". So no starting settlement on a lighthouse marker
either (`SITES_5_6P.xMarkers` lists them; the generator only blocks wall + bridge markers + X's).

Wonder tiles (p. 1): Lighthouse 3 wood + 1 wool + 1 grain, "Requires a building at one of the lighthouse
markers to begin"; Great Library 1 brick + 1 wood + 3 wool, "Requires 2 cities to begin" — as in
`wonders/catalogue.ts`.

Matches the code as it was, except the two frame-point sea hexes and the lighthouse setup block.

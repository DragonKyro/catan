# Traders & Barbarians 5-6 (2025 rulebook) — board specs, 5-6 players

Derived by the tb56 agent from `docs/catan traders and barbarians 5-6 rules.pdf`, pages 5-9, cropped at
500 dpi (crops + overlays in `scratch/tb56/`: m5o.png Fishing, m6o.png Rivers, m7o.png Merchant Trains,
m8o.png Barbarian Attack — each is the rulebook map with the axial grid drawn on top; `signs-all.png`
= every harbor sign on all four maps side by side; `piers-*.png` / `p-mouths.png` = hex corners drawn
over the ambiguous harbors and the river mouths).

Calibration (500 dpi crop of page fraction x 0.32.., y 0.36..): hex width W = 211.5 px, row step
1.5·S = 183 px, (0,0) centre at (905, 845) on p5, (930, 843) p6, (913, 842) p7, (910, 856) p8 (the board
image is placed a few points differently on each page). Hex (q,r) centre = (x0 + W·(q + r/2), y0 + 1.5·S·r).
The overlays line up with every hex boundary on all four maps.

## Coordinate system
Same as TB-MAP-SPEC.md (axial, pointy-top; E (+1,0), W (-1,0), NE (+1,-1), NW (0,-1), SE (0,+1),
SW (-1,+1); corners N, NE, SE, S, SW, NW; edges NE (N–NE), E (NE–SE), SE (SE–S), SW (S–SW),
W (SW–NW), NW (NW–N)). ScenarioPortAnchor / ScenarioEdgeRef `direction`: 0 E, 1 SE, 2 SW, 3 W, 4 NW,
5 NE (checked against `frame.test.ts`, which measures the edge-midpoint angle).

The 30-hex 5-6 island (`standardLand5_6()`), rows top → bottom:
- r=-3: q = 0, 1, 2
- r=-2: q = -1 .. 2
- r=-1: q = -2 .. 2
- r=0 : q = -3 .. 2
- r=1 : q = -3 .. 1
- r=2 : q = -3 .. 0
- r=3 : q = -3 .. -1
Outer ring (16): (0,-3) (1,-3) (2,-3) (2,-2) (2,-1) (2,0) (1,1) (0,2) (-1,3) (-2,3) (-3,3) (-3,2) (-3,1)
(-3,0) (-2,-1) (-1,-2). Inner 14 = the rest.

## Frame harbors (identical on all four 5-6 maps — `signs-all.png`)
"Assemble the frame using all the frame pieces from CATAN and CATAN 5-6" — 11 harbors, types printed:
- 3:1 generic: (2,-3) NE edge; (0,-3) W edge; (-3,0) W edge; (1,1) E edge; (-3,3) SW edge
- 2:1 ore:   (1,-3) NW edge   (piers: the (0,-3)/(1,-3) notch corner and (1,-3) N)
- 2:1 wheat: (-2,-1) NW edge  (piers: (-2,-1) NW and the (-1,-2)/(-2,-1) notch corner)
- 2:1 sheep: (2,-2) E edge    (piers: (2,-2) NE and SE)
- 2:1 brick: (-3,2) W edge    (piers: (-3,2) NW and SW)
- 2:1 sheep: (-1,3) E edge    (piers: (-1,3) NE (= notch) and SE)
- 2:1 wood:  (-2,3) SE edge   (piers: (-2,3) S and SE (= notch))
Six signs sit right over a coastal notch where two edges are equally likely by the sign position alone;
the pier directions decided each one (noted above). 5 generic + ore, wheat, brick, wood, 2 sheep =
the CATAN + 5-6 harbor set. Differs from the base game's `STANDARD_PORT_ANCHORS_5_6` (left alone).

## Rivers of Catan (p. 6)
Three river tiles, fixed positions and terrain (sources inside the mountains):
- River A (4 hexes, runs down-right): (-2,0) mountains → (-2,1) hills → (-2,2) pasture → (-2,3) SWAMP;
  mouth = (-2,3) SW edge.
- River B (3 hexes, runs up-right): (-1,-1) mountains → (0,-2) hills → (1,-3) SWAMP; mouth = (1,-3) NW
  edge (the same edge as the 2:1 ore harbor — the picture shows the river running into that harbor's
  water; no rule conflict: a bridge site with a harbor on its corners).
- River C (the 5-6 tile, 3 hexes, runs east, NO swamp): (0,0) mountains → (1,0) pasture → (2,0) pasture;
  mouth = (2,0) NE edge (the river bends up and meets the sea across the NE edge, not the E edge).
Setup: "Return 2 hills, 3 pastures, 3 mountains, and 2 deserts" → 20 random hexes: wood 6, wheat 6,
sheep 3, brick 3, ore 2. Totals with the rivers: wood 6, wheat 6, sheep 6, brick 5, ore 5, swamp 2.
Number discs: all 28 CATAN 5-6 discs (2,2,3,3,3,4,4,4,5,5,5,6,6,6,8,8,8,9,9,9,10,10,10,11,11,11,12,12)
on the 28 non-swamp hexes, usual placement; "the instruction to place the number 2 disc on the same hex
as the number 12 disc does not apply" → no stacked tokens. Robber starts on the (-2,3) swamp (picture).
Bridge sites (10): A: (-2,0)|(-2,1), (-2,1)|(-2,2), (-2,2)|(-2,3), (-2,3) SW mouth;
B: (-1,-1)|(0,-2), (0,-2)|(1,-3), (1,-3) NW mouth; C: (0,0)|(1,0), (1,0)|(2,0), (2,0) NE mouth.
Gold for building on river tiles: all 10 river-tile hexes. Bridges 3 per player, 10 VP.
(Note: the CATAN 5-6 disc set has two 2s and two 12s — confirmed by Barbarian Attack's "return the
number 2 disc, the number 12 disc" leaving one of each on that map. The base game's own
NUMBER_TOKENS_5_6 differs; it is not touched.)

## Fishing on Catan (p. 5)
- Inner light-blue area = the 14 inner hexes (every hex not on the outer ring): (0,-2) (1,-2) (-1,-1)
  (0,-1) (1,-1) (-2,0) (-1,0) (0,0) (1,0) (-2,1) (-1,1) (0,1) (-2,2) (-1,2). The 2 lakes + 12 random
  hexes go there (lakes at random spots); the 16 outer-ring hexes are random.
- Terrain: deserts replaced by the lakes → wood 6, sheep 6, wheat 6, brick 5, ore 5, lake 2.
- Lakes: the T&B lake (printed 2, 3, 11, 12) and the 5-6 lake (printed 4 and 10 — component picture).
  All 28 5-6 discs on the 28 land hexes.
- Fishing grounds: 8 ("a random fishing ground tile on each frame section that does not have a
  harbor"), numbers 4, 5, 6, 8, 9, 10 + the two 5-6 tiles 5 and 9, dealt at random. Notches (2 edges /
  3 corners each):
  1. top:         (1,-3) NE + (2,-3) NW; corners (1,-3)N, (1,-3)NE=(2,-3)NW, (2,-3)N
  2. upper right: (2,-3) E + (2,-2) NE;  corners (2,-3)NE, (2,-3)SE=(2,-2)N, (2,-2)NE
  3. right:       (2,-1) E + (2,0) NE;   corners (2,-1)NE, (2,-1)SE=(2,0)N, (2,0)NE
  4. lower right: (1,1) SE + (0,2) E;    corners (1,1)SE, (1,1)S=(0,2)NE, (0,2)SE
  5. bottom:      (-3,3) SE + (-2,3) SW; corners (-3,3)S, (-3,3)SE=(-2,3)SW, (-2,3)S
  6. lower left:  (-3,2) SW + (-3,3) W;  corners (-3,2)SW, (-3,2)S=(-3,3)NW, (-3,3)SW
  7. left:        (-3,0) SW + (-3,1) W;  corners (-3,0)SW, (-3,0)S=(-3,1)NW, (-3,1)SW
  8. upper left:  (-2,-1) W + (-3,0) NW; corners (-2,-1)NW, (-2,-1)SW=(-3,0)N, (-3,0)NW
  None shares an edge with a harbor.
- Fish tokens: + 4 one, 5 two, 5 three → 15 × 1, 15 × 2, 13 × 3 + the old boot (44).
- Robber starts off the board (as 3-4). 10 VP (11 with the boot).

## Merchant Trains (p. 7)
- Watering holes fixed at (-1,-1) and (0,1); deserts back in the box; 28 random hexes (wood 6, sheep 6,
  wheat 6, brick 5, ore 5) and all 28 5-6 discs.
- Both tiles are printed the same way round as the 3-4 tile (ponds upper-left, upper-right, bottom), so
  each has starts at its NW, NE and S corners (six in all; "three at each watering hole"):
  (-1,-1): NW → edge (-2,-1)|(-1,-2); NE → edge (0,-2)|(0,-1); S → edge (-1,0)|(-2,0)
  (0,1):   NW → edge (-1,1)|(0,0);    NE → edge (1,0)|(1,1);    S → edge (0,2)|(-1,2)
  (a corner's start edge runs between the two other hexes at that corner: NW = W + NW neighbours,
  NE = NE + E, S = SE + SW — same rule as the 3-4 spec's (0,0) starts)
- Wagons: 22 + 11 = 33. Robber off the board. 12 VP.

## Barbarian Attack (p. 8)
Fixed numbers (C = coastal/grey, I = inner/white), rows top → bottom:
- r=-3: (0,-3)=12 C, (1,-3)=9 C, (2,-3)=3 C
- r=-2: (-1,-2)=4 C, (0,-2)=5 I, (1,-2)=10 I, (2,-2)=8 C
- r=-1: (-2,-1)=5 C, (-1,-1)=11 I, (0,-1)=6 I, (1,-1)=3 I, (2,-1)=DESERT C
- r=0 : (-3,0)=CASTLE C, (-2,0)=8 I, (-1,0)=10 I, (0,0)=4 I, (1,0)=6 I, (2,0)=CASTLE C
- r=1 : (-3,1)=DESERT C, (-2,1)=3 I, (-1,1)=8 I, (0,1)=11 I, (1,1)=9 C
- r=2 : (-3,2)=6 C, (-2,2)=4 I, (-1,2)=9 I, (0,2)=10 C
- r=3 : (-3,3)=2 C, (-2,3)=5 C, (-1,3)=11 C
Coastal numbers 2,3,4,5,5,6,8,9,9,10,11,12 (two 5s and two 9s: "when a 5 or a 9 is rolled, place
barbarians on both corresponding hexes"). 26 discs = the 5-6 set minus one 2 and one 12.
Terrain: grey outer (12 numbered) = 3 hills, 3 forests, 2 pastures, 2 fields, 2 mountains; white inner
(14) = 2 hills, 2 forests, 3 pastures, 4 fields, 3 mountains (1 forest + 1 pasture back in the box).
Both castles printed the same way round as the 3-4 tile (purple pips on the NW/SE edges, green on
NE/SW, brown on W/E — `ba-castles.png`), so the knight-loss colours are unchanged.
Start barbarians: on the 2 (-3,3) and the 12 (0,-3) (3-4 rule, unchanged in the 5-6 text).
Barbarians: 36 + 12 = 48. Knights 6 per player. Coins. No robber / Largest Army / base dev cards.
Expel order: "start with the number 5 coastal hex (next to the castle) and move clockwise" — the 5 by a
castle is (-2,-1) (next to the (-3,0) castle):
(-2,-1) → (-1,-2) → (0,-3) → (1,-3) → (2,-3) → (2,-2) → (2,-1) desert → (2,0) castle → (1,1) → (0,2)
→ (-1,3) → (-2,3) → (-3,3) → (-3,2) → (-3,1) desert → (-3,0) castle.
12 VP. (Page 9's landing example picture shows a different, older-looking board fragment — a castle
next to a desert in a 4-hex bottom row — and does not match the page 8 map; page 8 is used.)

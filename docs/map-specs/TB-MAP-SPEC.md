# Traders & Barbarians (2025 rulebook) — exact board specs (3-4 players)

Derived by the orchestrator from high-res crops of `docs/catan traders and barbarians rules.pdf`
(crops in `img/`: tb-river-board.png, tb-river1.png, tb-river2.png, tb-fish-board.png,
fq-*.png, tb-ba-board.png, tb-castle.png, tb-loss.png, tb-mt-start.png). Use these coordinates;
do NOT re-derive them from the PDF unless you find a contradiction (then say so in your report).

## Coordinate system (matches the engine)
Axial (q, r), pointy-top hexes. The 19-hex island, top row to bottom row:
- r=-2: q = 0, 1, 2
- r=-1: q = -1, 0, 1, 2
- r=0 : q = -2, -1, 0, 1, 2
- r=1 : q = -2, -1, 0, 1
- r=2 : q = -2, -1, 0
Neighbour directions: E (+1,0), W (-1,0), NE (+1,-1), NW (0,-1), SE (0,+1), SW (-1,+1).
Hex corners: N (top), NE, SE, S (bottom), SW, NW. Hex edges: NE edge (N–NE), E edge (NE–SE),
SE edge (SE–S), SW edge (S–SW), W edge (SW–NW), NW edge (NW–N).
CAUTION: the codebase has two conflicting comment conventions for the 0..5 `direction` enum
(scenarioTypes.ts says 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE; riversOfCatan.ts comments say
0 NE, 1 E, ...). Check what the resolver actually does, and pin every resolved edge/vertex
in a unit test by checking the two hexes it touches (not just the enum value).
Verify visually with the scenario preview (see "Tooling").

## Frame harbors (same frame in every T&B scenario picture)
9 harbors, fixed positions, types as printed:
- 3:1 generic: (0,-2) NW edge; (2,0) E edge; (-2,2) SW edge; (-1,-1) W edge
- 2:1 brick: (1,-2) NE edge
- 2:1 wood:  (2,-1) NE edge
- 2:1 wheat: (1,1) SE edge
- 2:1 ore:   (-1,2) SE edge
- 2:1 sheep: (-2,1) W edge
(These differ from `STANDARD_PORT_ANCHORS_3_4` used by the base game; do not change the base
game's ports — give the T&B scenarios their own anchors + fixed types.)

## Rivers of Catan
Two river tiles, fixed positions and terrain (each runs diagonally down-right):
- River A (4 hexes): (-1,-1) mountains/ore → (-1,0) hills/brick → (-1,1) pasture/sheep → (-1,2) SWAMP
- River B (3 hexes): (1,-1) mountains/ore → (1,0) hills/brick → (1,1) SWAMP
Other 12 hexes random from: wood 4, wheat 4, sheep 2, brick 1, ore 1 (base minus 2 hills,
2 pastures, 2 mountains, desert). Totals with rivers: wood 4, sheep 3, wheat 4, brick 3, ore 3, swamp 2.
Number discs: set the "2" aside, place the other 17 (3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12) on the 17
non-swamp hexes as normal (random, usual 6/8 rule), then put the 2 ON THE SAME HEX AS THE 12 — that hex
produces on 2 and on 12.
Bridge sites (7) — every place the river crosses or meets an edge:
- (-1,-1)|(-1,0) shared edge; (-1,0)|(-1,1); (-1,1)|(-1,2); (-1,2) SW edge (coast — river runs into the sea)
- (1,-1)|(1,0); (1,0)|(1,1); (1,1) E edge (coast — river runs into the sea)
River source is inside each mountain hex (not on an edge). Robber starts on either swamp.
Gold: +1 per settlement built on ANY corner of ANY of the 7 river-tile hexes; +1 per road built on ANY
edge of ANY river-tile hex (incl. during setup); +3 per bridge. Bridge cost: 2 brick + 1 wood. Max 3
bridges each. Bridges need to connect to own road/building, can't pass an opponent's building, not via
Road Building. Bridges count as roads for Longest Route.
Wealth: unique most gold ⇒ Wealthiest (+1 VP; tie ⇒ nobody). Everyone tied at the least gold holds a
Poor Catanian tile (−2 VP) — INCLUDING when all players are tied (at the start every player takes one).
Spend 2 gold → 1 resource of choice, up to 2×/turn. Buy gold from the supply with resources at 4:1
(3:1 / 2:1 with a matching port; 2:1 port of resource X lets you trade 2 X → 1 gold). Coins aren't
resources: not in hand size, not stolen, not monopolised; may be used in player trades. 10 VP.

## Fishing on Catan
- Inner area = the 7 hexes (0,0),(1,-1),(1,0),(0,1),(-1,1),(-1,0),(0,-1). The LAKE plus 6 random land
  hexes go there (lake position random among the 7); the other 12 random hexes form the outer ring.
- Terrain: base set with the desert replaced by the lake (wood 4, sheep 4, wheat 4, brick 3, ore 3, lake 1).
- Number discs: all 18 base discs on the 18 land hexes (random, usual rules). The lake hex has its own
  printed numbers 2, 3, 11 and 12 — it produces fish on any of those four rolls.
- 6 fishing grounds = frame tiles in the six coastline notches. Random numbers 4,5,6,8,9,10 (one each).
  Each touches 2 coastal edges / 3 corners (a settlement on any of the 3 corners fishes there):
  1. top:        (0,-2) NE edge + (1,-2) NW edge; corners (0,-2)N, (0,-2)NE=(1,-2)NW, (1,-2)N
  2. upper-left: (0,-2) W edge + (-1,-1) NW edge; corners (0,-2)NW, (0,-2)SW=(-1,-1)N, (-1,-1)NW
  3. upper-right:(2,-1) E edge + (2,0) NE edge; corners (2,-1)NE, (2,-1)SE=(2,0)N, (2,0)NE
  4. lower-right:(2,0) SE edge + (1,1) E edge; corners (2,0)SE, (2,0)S=(1,1)NE, (1,1)SE
  5. bottom:     (-2,2) SE edge + (-1,2) SW edge; corners (-2,2)S, (-2,2)SE=(-1,2)SW, (-1,2)S
  6. lower-left: (-2,1) SW edge + (-2,2) W edge; corners (-2,1)SW, (-2,1)S=(-2,2)NW, (-2,2)SW
  (They interleave with the 9 harbors above; none shares an edge with a harbor.) Draw them as
  light-blue chevrons on the sea frame filling the notch.
- Robber starts off the board; enters on a 7 or a Knight. It may sit on the lake (blocks all 4 lake
  numbers), never on a fishing ground. Fish spend 2 removes it again.
- Setup: if your SECOND settlement touches a fishing ground or the lake, draw 1 random fish token.
- Production: settlement on a producing fishing ground / lake gets 1 fish token, city 2. Draw one token
  at a time in turn order from the active player. Old boot: reveal at once.
- Tokens: 11×1, 10×2, 8×3 fish + 1 old boot (30). Reshuffle the discard pile when the supply runs out.
- Max 7 fish tokens (boot excluded). Once per turn, if you hold 7 and would receive more, you may
  discard 1 and draw a replacement; then stop drawing.
- Spend (your turn, each action paid separately, excess lost): 2 remove robber; 3 steal 1 random
  resource from a player; 4 take 1 resource of choice; 5 build a road free; 7 take a dev card free.
- Old boot: on your turn give it to a player with ≥ your public VP (hidden VP cards don't count).
  Holder needs +1 VP to win. Fish tokens: not resources, not stolen, not tradeable, not in hand size.
- Win: 10 VP (11 with the boot).

## Merchant Trains
- Watering hole fixed at (0,0); desert removed; 18 other hexes random; 18 base discs.
- Robber starts off the board (enters on a 7 / Knight).
- Three merchant-train start points = corners NW, NE and S of the watering hole (N, SE, SW are
  forbidden). A train's first wagon goes on the edge leaving that corner AWAY from the hex:
  NW corner → edge between (0,-1) and (-1,0); NE corner → edge between (1,-1) and (1,0);
  S corner → edge between (-1,1) and (0,1).
- Wagons: edges without a wagon (roads OK). A new wagon starts a new train (empty start edge) or is
  added nose-to-tail at the FRONT (head) of an existing train. Trains never branch. When a train's
  head reaches an intersection already on another train they merge (meeting another train's head:
  one merged train continues from there; meeting the middle of a train: the arriving train ends).
  A train also ends when it can't be extended or the 22-wagon supply is empty.
- Acquire: the active player collects 1 wagon if they built ≥1 BUILDING (settlement or city) during
  their Action phase (roads/bridges don't count). Max 1 per turn.
- End of turn voting round (only when a wagon was collected): starting with the active player,
  clockwise, each player may bid any number of wool and/or wheat face up (bids are public, later
  bidders see earlier bids). A player with an absolute majority of all votes chooses the location.
  Otherwise each bidder assigns all their votes to one location: (1) a unique top location gets the
  wagon; else (2) the player with the unique most votes chooses; else (3) the active player chooses
  (even if they bid nothing). All bid cards go to the supply.
- Scoring: a wagon on the same edge as a road counts as one extra road for Longest Route; every
  building on an intersection between 2 wagons (2+ wagon edges meet there) is worth +1 VP.
- Win: 12 VP.

## Barbarian Attack
Fixed numbers, rows top→bottom (C = coastal, I = inner):
- r=-2: (0,-2)=3 C, (1,-2)=8 C, (2,-2)=DESERT C
- r=-1: (-1,-1)=9 C, (0,-1)=4 I, (1,-1)=5 I, (2,-1)=10 C
- r=0 : (-2,0)=12 C, (-1,0)=6 I, (0,0)=10 I, (1,0)=8 I, (2,0)=11 C
- r=1 : (-2,1)=4 C, (-1,1)=9 I, (0,1)=3 I, (1,1)=5 C
- r=2 : (-2,2)=CASTLE C, (-1,2)=6 C, (0,2)=2 C
Coastal numbers 2,3,4,5,6,8,9,10,11,12 (each once — every non-7 roll names exactly one coastal hex).
Terrain random within each area: coastal (10 numbered) = 2 hills, 2 forest, 3 pasture, 2 fields,
1 mountains; inner (7) = 1 hills, 1 forest, 1 pasture, 2 fields, 2 mountains.
Start: 1 barbarian on the 2 hex (0,2), 1 on the 12 hex (-2,0); 36 barbarians total.
No robber, no base dev cards, no Largest Army. 2nd setup placement is a CITY (1 resource per adjacent hex).
Expel order: start at the coastal 4 hex (-2,1) and go clockwise:
(-2,1) → (-2,0) → (-1,-1) → (0,-2) → (1,-2) → (2,-2) desert → (2,-1) → (2,0) → (1,1) → (0,2) → (-1,2) → (-2,2) castle.
Castle hex edge colours (for knight losses): die 1/6 = purple = edges parallel to the NW and SE edges
("/" edges); 2/5 = green = parallel to NE and SW edges ("\" edges); 3/4 = brown = the vertical
W/E edges. Draw the castle hex with small coloured pips by those edges like the tile.
Rules summary (read pages 15-19 for detail):
- 7: discard as normal, then steal 1 random resource from a player of your choice.
- Each time you place a building (settlement or city, not in setup): roll until not 7, place 1
  barbarian on that coastal hex if it has < 3; repeat twice more with numbers different from the
  earlier rolls (stop if the barbarian supply is empty). 3 barbarians ⇒ hex conquered (no production,
  no building on its edges/corners). A building touching only conquered hexes (and the frame) is
  conquered: 0 VP, its ports unusable.
- Dev deck (26): 4 Capture, 14 Knighthood, 4 Swift Knight, 4 Treason. Buying a dev card = play it at
  once. Capture: take 1 barbarian from a coastal hex as a prisoner (none ⇒ discard, draw again).
  Knighthood: place a knight on an empty castle-hex edge. Swift Knight: place a knight on any edge
  with no knight. Treason: take 2 gold; move 2 barbarians from 2 different coastal hexes to 2 other
  unconquered coastal hexes (take from the supply if the board has too few). Reshuffle on empty.
- 6 knights per player (on edges). End-of-turn: move each of your knights up to 3 edges (5 if you pay
  1 wheat for that knight); knights ignore pieces while moving but must end on an edge without a
  knight; a knight on a castle edge MUST move; may not end on a castle edge.
- Then expel: for each coastal hex in order, victory if ≥1 barbarian and more knights on the hex's 6
  edges than barbarians. Prisoners: sole involved player takes all; else 1 each, leftover to most
  knights there (tie: roll, loser gets 3 gold); too few prisoners: everyone rolls, highest first, those
  without one get 3 gold. Liberate (un-conquer hex + its buildings). Then roll 1 die → edge
  orientation (above); each involved knight on an edge of that orientation is removed (+3 gold each).
- Every 2 prisoners = 1 VP. Coins as in Rivers (2 gold → 1 resource ≤2×/turn; buy gold 4:1/3:1/2:1).
- Win: 12 VP.

## Tooling
See CLAUDE.md, "Checking a map against its rulebook picture" (scenario preview, `scripts/render-board.mjs`, `scripts/check-compact.mjs`).

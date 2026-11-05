# "Traders & Barbarians" scenario (2025 rulebook pp. 20-24) — exact spec, 3-4 players

Derived by the orchestrator from `img/tbs-board.png`, `img/tbs-paths.png`, `img/tbs-wagonboard.png`,
`img/tbs-costs.png`, `img/tbs-barb*.png` and the text in `tb.txt` (pages 20-24). Coordinates and
edge/corner names as in TB-MAP-SPEC.md (axial pointy-top; corners N, NE, SE, S, SW, NW).

## Board
- Frame harbors: `TB_FRAME_PORTS_3_4` (same frame as the other T&B maps).
- 3 commodity hexes on corner hexes of the island, each with "X" markers on its 3 frame-side edges
  (no roads there) and 4 interior paths from its inland corners to a centre plaza:
  - QUARRY (2,-2): X on NW, NE, E edges; paths from corners SE, S, SW, NW to the centre.
  - CASTLE (-2,0): X on NW, W, SW edges; paths from corners N, NE, SE, S to the centre.
  - GLASSWORKS (0,2): X on E, SE, SW edges; paths from corners N, NE, SW, NW to the centre.
  (Rule of thumb: a corner gets a path unless both its edges carry X markers.)
- Interior paths are road-buildable edges; the centre plaza is an intersection where no settlement
  may be built and where wagons end their move to deliver/pick up. Commodity hexes have no number and
  produce nothing.
- The other 16 hexes: random from wood 4, sheep 3, wheat 3, brick 3, ore 3 (base minus 1 pasture,
  1 field, the desert). Number discs: the base set minus the 2 and the 12 (16 discs), placed normally,
  skipping the commodity hexes.
- 3 barbarians start ON EDGES: (1,-2)|(1,-1) shared edge; (-1,0)|(-2,1); (0,1)|(1,1).
- No robber, no Longest Road tile, no base dev cards.

## Components / setup
- Commodity tokens: 36 = per location 12 (quarry stack: 6 sand + 6 marble; castle stack: 6 tools +
  6 sand; glassworks stack: 6 glass + 6 tools), shuffled face down per location.
  Needs: castle needs marble and glass; glassworks needs sand; quarry needs tools.
  (So marble → castle, glass → castle, sand → glassworks, tools → quarry.)
- Each player: 5 gold, a wagon board (cube at level 1), 1 wagon piece placed on the intersection of
  their city after setup. Second setup placement is a CITY (1 resource per adjacent hex).
- Dev deck (25): 16 Knight, 3 Road Building, 3 Swift Journey, 3 Victory Point (Stonecutting,
  Glassmaking, Toolmaking). Normal dev-card rules otherwise (bought cards hidden; VP cards revealed when
  they win you the game, even the turn you buy them).

## Rules
- Production: a 2 or 12 is re-rolled. A 7: no production, discard as normal, then move 1 barbarian to
  any edge without a barbarian; if that edge has a road, steal 1 random resource from the road's owner.
- Coins: as Rivers (2 gold → 1 resource ≤ 2×/turn; buy gold with resources at 4:1/3:1/2:1; usable in
  player trades; not stolen; not in hand size).
- Roads may be built on barbarian edges and on interior paths, never on X edges.
- Knight card: move 1 barbarian to an edge without one; steal from the road owner if it lands on a road.
  Swift Journey: after a "Move your wagon" action this turn, take it again. Road Building: 2 free roads.
- Wagon board (level 1..5): movement points 4, 5, 6, 7, 7; drive-off die range none, 6, 5-6, 4-6, 3-6;
  delivery gold 1, 2, 3, 4, 5. Upgrades cost: 1→2 wood+wool+ore; 2→3 wood+wool+ore;
  3→4 2 wood+wool+ore; 4→5 2 wood+wool+ore. Reaching level 5 = +1 VP.
- End of Turn phase (after the Action phase): move your wagon intersection to intersection. Edge
  costs: 2 MP without a road; 1 MP on your road; 1 MP + 1 gold (paid to the owner) on another player's
  road; +2 MP if the edge has a barbarian. Must afford a whole edge; may stop any time; unused MP lost.
  Once per turn spend 1 wheat for +2 MP. Buildings/other wagons don't block. Entering a centre plaza
  ends the move.
- Drive off a barbarian: pause on an intersection adjacent to a barbarian's edge, roll 1 die; if it's
  in your level's range, move that barbarian to any edge without one (no steal). Once per barbarian per
  turn; continue moving either way.
- At a centre plaza: deliver your token if this location needs it (token kept face down = 1 VP; take
  gold = your level's delivery value), then if you carry nothing, draw the top token of that location's
  stack (carry max 1).
- Win: 13 VP.

## Engine notes for the implementer
- Interior paths need extra board graph pieces: one centre vertex per commodity hex plus 4 edges to
  the listed corners. Generate them in the T&B board generator after the base graph is built (generic
  data on BoardState — no special cases in base code); placement code must treat them as normal edges,
  the centre vertex must be settlement-blocked, and rendering must draw roads/wagons along them.
- Randomness (dice re-rolls, drive-off rolls, steals, token draws) from seeded `state.rngState` or
  the action payload.

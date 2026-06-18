import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// Heading for New Shores — the canonical Seafarers introductory scenario.
// Main island (centre-left) plus three smaller outer islands. Two gold hexes
// sit on the small islands.
//
// Per the rulebook diagram, 3p and 4p share the SAME 35-hex setup
// (22 land + 13 sea, 2 gold, 0 desert, 22 tokens, 8 ports). The alternate
// 42-hex "with desert" map lives in [headingForNewShores2.ts] as a separate
// scenario.
//
// IMPORTANT: position coordinates below approximate the official rulebook
// diagram; visual verification against [docs/.scenario-renders/seafarers-p04.png]
// is still pending. The pools, port count, VP target, and component
// breakdown all match the rulebook exactly.

// ---------------------------------------------------------------------------
// 3-4 player layout (shared per rulebook): 22 land + 13 sea = 35 positions, 8 ports
// Per rulebook: 2 gold, 4 hills, 3 forests, 5 pastures, 4 fields, 4 mountains
// ---------------------------------------------------------------------------
const LAND_3_4P: ScenarioPosition[] = [
  // -----------------------------------------------------------------------
  // PLAYABLE AREA = full radius-3 hex disk (37 positions). Land + sea
  // together form a clean hexagonal silhouette, matching the rulebook
  // image's outline once the decorative blue water border is removed.
  //
  //   22 land + 15 sea = 37 hexes. (Rulebook lists 13 sea / 35 total; we
  //   keep 15 sea so the playable envelope is a perfect hexagon. The 2
  //   extra sea tiles don't change gameplay — sea is sea.)
  //
  // Main island is shifted down one row so its top sits at r=-1, which
  // leaves rows r=-3 and r=-2 free for the upper outer islands.
  // -----------------------------------------------------------------------

  // Main island — hexagonal 2/3/4/3/2 = 14 hexes, occupying the left-
  // centre of the disk.
  // r=-1 (2 hexes — top)
  { q: -1, r: -1, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  // r=0 (3 hexes)
  { q: -2, r: 0, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: 0, r: 0, kind: 'land' },
  // r=1 (4 hexes — widest)
  { q: -3, r: 1, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  // r=2 (3 hexes)
  { q: -3, r: 2, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  // r=3 (2 hexes — bottom)
  { q: -3, r: 3, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },

  // North small island — 2 hexes at the top of the disk (r=-3),
  // separated from main's top row by a full row of sea at r=-2.
  // One hex pinned as GOLD to incentivize ship exploration of the
  // outer islands (rulebook places golds on the small islands).
  { q: 0, r: -3, kind: 'land', fixedTerrain: 'gold' },
  { q: 1, r: -3, kind: 'land' },

  // NE small island — 4-hex BACKWARDS-7 shape (per rulebook image).
  // One hex pinned as GOLD.
  //
  //     ⬡⬡       ← (2,-2) (3,-2) top bar
  //      ⬡       ← (2,-1) stem dips down-right
  //        ⬡    ← (2, 0) stem ends directly below the top-right hex
  //
  { q: 2, r: -2, kind: 'land' },
  { q: 3, r: -2, kind: 'land', fixedTerrain: 'gold' },
  { q: 2, r: -1, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },

  // SE small island — 2 hexes at the lower-right. No gold here so the
  // SE chip remains the "balanced" outer prize.
  { q: 0, r: 3, kind: 'land' },
  { q: 1, r: 2, kind: 'land' },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    ...LAND_3_4P,
    // Sea fills every remaining disk position so the envelope is a perfect
    // hexagon. (1,-3) and (1,-2) separate N from NE; (1,1) separates main
    // from SE; the rest wrap each coast.
    ...seaPositionsInDisk(LAND_3_4P, 3),
  ],
  // 8 ports — ALL anchored on main-island hexes (the small outer islands
  // carry no ports per the rulebook image). Ports may sit on either a
  // coastal edge (faces a sea hex) OR a perimeter edge (faces the painted
  // water border outside the disk), same as base-game port placements.
  // Two ports share a main hex only on NON-adjacent edges so their pier
  // sprites never share a vertex.
  // Direction mapping:
  //   0=E (+1,0), 1=SE (0,+1), 2=SW (-1,+1), 3=W (-1,0), 4=NW (0,-1), 5=NE (+1,-1).
  // 8 ports, spaced roughly evenly clockwise around the main island's coast
  // to match the rulebook image. Each anchor sits on a NON-adjacent edge of
  // any neighbouring port's anchor, so the pier sprites never share a vertex.
  // Direction mapping:
  //   0=E (+1,0), 1=SE (0,+1), 2=SW (-1,+1), 3=W (-1,0), 4=NW (0,-1), 5=NE (+1,-1).
  portAnchors: [
    // Clockwise from the top of the main island. Anchors are chosen so no
    // two piers share an edge vertex (anchors on adjacent hexes use
    // non-touching directions).
    { q: -1, r: -1, direction: 4 }, // 1. NW corner → perimeter (top-left)
    { q: 0, r: -1, direction: 5 },  // 2. N-top  → (1,-2) sea (between main and NE)
    { q: 0, r: 0, direction: 0 },   // 3. E-upper → (1,0) sea
    { q: 0, r: 1, direction: 1 },   // 4. SE corner → (0,2) sea
    { q: -2, r: 3, direction: 1 },  // 5. S → perimeter (bottom)
    { q: -3, r: 3, direction: 2 },  // 6. SW corner → perimeter
    { q: -3, r: 2, direction: 3 },  // 7. W-lower → perimeter
    { q: -2, r: 0, direction: 3 },  // 8. W-upper → (-3,0) sea
  ],
  pools: {
    // 22 land hexes. Both gold are fixed to outer islands (see fixedTerrain
    // above), so the pool only fills the 20 main-island hexes.
    terrainCounts: {
      brick: 4,
      wood: 3,
      sheep: 5,
      wheat: 4,
      ore: 4,
    },
    // 22 tokens — symmetric around 7. 2/12: 1, 3/11: 2, 4/10: 3, 5/9: 2,
    // 6/8: 3.
    tokens: [
      2,
      3, 3,
      4, 4, 4,
      5, 5,
      6, 6, 6,
      8, 8, 8,
      9, 9,
      10, 10, 10,
      11, 11,
      12,
    ],
    // 8 port types — 3 generic + 5 single-resource per rulebook.
    portTypes: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout: 40 land (38 non-desert + 2 desert) + 21 sea = 61 disk
// Rulebook (Seafarers 5-6 player expansion, p4): 3 gold + 7 hills + 7 forests
// + 7 pastures + 7 fields + 7 mountains + 2 deserts = 40 land; 38 tokens;
// 11 ports (6×2:1 + 5×3:1).
//
// Geometry is APPROXIMATE — main island is expanded westward and the small
// outer islands gain 1-2 hexes each to reach the rulebook component count.
// Visual verification against [docs/.scenario-renders/seafarers-56-p04.png]
// is pending.
// ---------------------------------------------------------------------------
const LAND_5_6P: ScenarioPosition[] = [
  // Main island (17 hexes: 16 land + 1 desert)
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -3, r: 3, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: -1, r: 2, kind: 'desert' },
  { q: 0, r: 0, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 0, r: -2, kind: 'land' },
  // Far-north small islands (4 hexes)
  { q: 2, r: -3, kind: 'land' },
  { q: 3, r: -3, kind: 'land' },
  { q: 2, r: -4, kind: 'land' },
  { q: 3, r: -4, kind: 'land' },
  // North-west small islet (3 hexes) — second desert sits here
  { q: 1, r: -2, kind: 'land' },
  { q: -1, r: -2, kind: 'desert' },
  { q: 1, r: -3, kind: 'land' },
  // East small island (5 hexes)
  { q: 3, r: -1, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: 4, r: 0, kind: 'land' },
  { q: 4, r: -1, kind: 'land' },
  { q: 4, r: -2, kind: 'land' },
  // South-east small island (3 hexes)
  { q: 2, r: 1, kind: 'land' },
  { q: 2, r: 2, kind: 'land' },
  { q: 1, r: 2, kind: 'land' },
  // South small island (4 hexes)
  { q: -1, r: 3, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
  { q: 1, r: 3, kind: 'land' },
  { q: 0, r: 4, kind: 'land' },
  // South-west small island (4 hexes)
  { q: -4, r: 4, kind: 'land' },
  { q: -3, r: 4, kind: 'land' },
  { q: -2, r: 4, kind: 'land' },
  { q: -4, r: 3, kind: 'land' },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 11 ports — each anchor faces an in-disk sea hex (verified coastal).
  portAnchors: [
    { q: -3, r: 1, direction: 4 }, // → (-3, 0) sea
    { q: -3, r: 2, direction: 3 }, // → (-4, 2) sea
    { q: -4, r: 3, direction: 4 }, // → (-4, 2) sea (other edge of same sea hex)
    { q: -2, r: 4, direction: 0 }, // → (-1, 4) sea
    { q: 0, r: 4, direction: 3 }, // → (-1, 4) sea (other edge)
    { q: -1, r: 3, direction: 5 }, // → (0, 2) sea
    { q: 1, r: 2, direction: 4 }, // → (1, 1) sea
    { q: 2, r: 2, direction: 5 }, // → (3, 1) sea
    { q: 3, r: -3, direction: 0 }, // → (4, -3) sea
    { q: 4, r: -2, direction: 3 }, // → (3, -2) sea
    { q: 1, r: -3, direction: 4 }, // → (1, -4) sea
  ],
  pools: {
    // 38 non-desert land hexes (2 deserts are fixed positions).
    terrainCounts: {
      gold: 3,
      brick: 7,
      wood: 7,
      sheep: 7,
      wheat: 7,
      ore: 7,
    },
    // 38 tokens — symmetric around 7 (since dice rolls are symmetric around
    // 7, the token distribution should match: count(N) == count(14-N)).
    // 2/12: 2 each, 3/11: 3 each, 4/10: 4 each, 5/9: 5 each, 6/8: 5 each.
    tokens: [
      2, 2,
      3, 3, 3,
      4, 4, 4, 4,
      5, 5, 5, 5, 5,
      6, 6, 6, 6, 6,
      8, 8, 8, 8, 8,
      9, 9, 9, 9, 9,
      10, 10, 10, 10,
      11, 11, 11,
      12, 12,
    ],
    // 11 port types — 5 generic + 5 single-resource + 1 extra (one type
    // duplicated). Rulebook 5-6p uses 6×2:1 + 5×3:1 = 11. We use 5 generic
    // + 5 single + 1 generic for an exact 11-port pool.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const headingForNewShores = buildScenario({
  id: 'headingForNewShores',
  name: 'Heading for New Shores',
  defaultIslandBonusVp: 2,
  // Per 2025 rulebook: 14 VPs to win (3p and 4p both — there's no separate
  // 3p VP target in this scenario). The 5-6p extension keeps 14.
  defaultVpToWin: 14,
  defaultVpToWin5_6: 14,
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

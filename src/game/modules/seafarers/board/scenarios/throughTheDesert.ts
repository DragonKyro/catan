import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// Through the Desert — a single main island split by a 3-hex desert chain.
// `desertIsBoundary: true` makes the chain act like sea for island
// partitioning, so the far side becomes an "outer island" worth a chip VP.
//
// Structural migration to the modular schema. Hex positions, terrain mix,
// token list, and port anchors come from the pre-migration data; pool counts
// could be tightened to rulebook (see MIGRATION.md) after visual verification
// against [docs/.scenario-renders/seafarers-p06.png] etc.

// 14 non-desert land hexes + 3 deserts forming the central spine.
const LAND_3_4P: ScenarioPosition[] = [
  // West side of the desert spine
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  // Desert spine
  { q: 0, r: -1, kind: 'desert' },
  { q: 0, r: 0, kind: 'desert' },
  { q: 0, r: 1, kind: 'desert' },
  // East side
  { q: 1, r: -1, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: 2, r: 1, kind: 'land' },
  // Far-east "outer island" hex
  { q: 0, r: 2, kind: 'land' },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    ...LAND_3_4P,
    ...seaPositionsInDisk(LAND_3_4P, 3),
  ],
  portAnchors: [
    { q: -3, r: 1, direction: 4 },
    { q: -2, r: 0, direction: 5 },
    { q: 2, r: -1, direction: 0 },
    { q: 2, r: 0, direction: 5 },
    { q: 2, r: 1, direction: 2 },
    { q: -3, r: 2, direction: 1 },
  ],
  pools: {
    // 14 non-desert land hexes (3 deserts are fixed positions).
    terrainCounts: {
      gold: 1,
      brick: 2,
      wood: 3,
      sheep: 3,
      wheat: 3,
      ore: 2,
    },
    // 14 tokens (one per non-desert land hex).
    tokens: [2, 3, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 11, 12],
    // 6 port types — 1 generic + 5 single-resource.
    portTypes: ['generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout: 43 land (38 non-desert + 5 desert) + 18 sea = 61 disk
// Rulebook (Seafarers 5-6p, p7): 3 gold + 7 hills + 7 forests + 7 pastures
// + 7 fields + 7 mountains + 5 deserts = 43 land; 38 tokens; 11 ports.
//
// Geometry is APPROXIMATE — the 5-desert spine bisects the board vertically;
// 19 non-desert hexes on the west side, 19 on the east, deserts in q=0
// column. Visual verification against
// [docs/.scenario-renders/seafarers-56-p07.png] is pending.
// ---------------------------------------------------------------------------
const LAND_5_6P: ScenarioPosition[] = [
  // West side (19)
  { q: -4, r: 1, kind: 'land' },
  { q: -4, r: 2, kind: 'land' },
  { q: -4, r: 3, kind: 'land' },
  { q: -4, r: 4, kind: 'land' },
  { q: -3, r: 0, kind: 'land' },
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -3, r: 3, kind: 'land' },
  { q: -3, r: 4, kind: 'land' },
  { q: -2, r: -1, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: -1, r: 3, kind: 'land' },
  // Desert spine — 5 deserts bisecting the board (`desertIsBoundary: true`
  // splits the connected-land graph at the spine so the far side earns chips)
  { q: 0, r: -2, kind: 'desert' },
  { q: 0, r: -1, kind: 'desert' },
  { q: 0, r: 0, kind: 'desert' },
  { q: 0, r: 1, kind: 'desert' },
  { q: 0, r: 2, kind: 'desert' },
  // East side (19)
  { q: 1, r: -2, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: 1, r: 2, kind: 'land' },
  { q: 2, r: -3, kind: 'land' },
  { q: 2, r: -2, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: 2, r: 1, kind: 'land' },
  { q: 3, r: -3, kind: 'land' },
  { q: 3, r: -2, kind: 'land' },
  { q: 3, r: -1, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: 3, r: 1, kind: 'land' },
  { q: 4, r: -3, kind: 'land' },
  { q: 4, r: -2, kind: 'land' },
  { q: 4, r: -1, kind: 'land' },
  { q: 4, r: 0, kind: 'land' },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 11 ports — each anchor faces an in-disk sea hex (verified coastal).
  portAnchors: [
    { q: -4, r: 1, direction: 4 }, // → (-4, 0) sea
    { q: -3, r: 0, direction: 4 }, // → (-3, -1) sea
    { q: -2, r: -1, direction: 4 }, // → (-2, -2) sea
    { q: -1, r: -1, direction: 4 }, // → (-1, -2) sea
    { q: 1, r: -2, direction: 4 }, // → (1, -3) sea
    { q: 2, r: -3, direction: 4 }, // → (2, -4) sea
    { q: 3, r: -3, direction: 4 }, // → (3, -4) sea
    { q: 4, r: -3, direction: 4 }, // → (4, -4) sea
    { q: -1, r: 3, direction: 0 }, // → (0, 3) sea
    { q: 3, r: 1, direction: 2 }, // → (2, 2) sea
    { q: 1, r: 2, direction: 0 }, // → (2, 2) sea (other edge)
  ],
  pools: {
    // 38 non-desert land hexes (5 deserts are fixed positions).
    terrainCounts: {
      gold: 3,
      brick: 7,
      wood: 7,
      sheep: 7,
      wheat: 7,
      ore: 7,
    },
    // 38 tokens — fully symmetric around 7. 2/12: 2, 3/11: 3, 4/10: 4,
    // 5/9: 5, 6/8: 5.
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
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const throughTheDesert = buildScenario({
  id: 'throughTheDesert',
  name: 'Through the Desert',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 14,
  defaultVpToWin5_6: 15,
  minPlayers: 3,
  maxPlayers: 6,
  desertIsBoundary: true,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// Token distributions below are symmetric around 7 (count(N) == count(14-N))
// because dice rolls are symmetric around 7. Where the total token count is
// odd, the smallest possible asymmetry is accepted (one pair differing by 1).

// The Wonders of Catan — a single large island. Players build wonders (see
// `state.wonders` + `buildWonder` action); completing one is an instant win.
//
// Structural migration to the modular schema.

// 16 land + 1 desert = 17 land positions.
const LAND_3_4P: ScenarioPosition[] = [
  { q: 0, r: 0, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: -2, r: 1, kind: 'desert' },
  { q: -2, r: 2, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: 2, r: -2, kind: 'land' },
  { q: 0, r: -2, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: 0, r: 2, kind: 'land' },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    ...LAND_3_4P,
    ...seaPositionsInDisk(LAND_3_4P, 3),
  ],
  portAnchors: [
    { q: 1, r: -1, direction: 4 },
    { q: 2, r: -1, direction: 0 },
    { q: 2, r: -2, direction: 5 },
    { q: 0, r: 2, direction: 2 },
    { q: -1, r: 2, direction: 1 },
    { q: -2, r: 2, direction: 3 },
    { q: -2, r: 0, direction: 4 },
    { q: 0, r: -2, direction: 5 },
  ],
  pools: {
    // 16 non-desert land hexes.
    terrainCounts: {
      gold: 1,
      brick: 3,
      wood: 3,
      sheep: 3,
      wheat: 3,
      ore: 3,
    },
    // 16 tokens — fully symmetric around 7. 2/12: 1, 3/11: 1, 4/10: 2,
    // 5/9: 2, 6/8: 2.
    tokens: [2, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 12],
    // 8 port types — 3 generic + 5 single-resource.
    portTypes: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout: 38 land (34 non-desert + 4 desert) + 23 sea = 61 disk
// Rulebook (Seafarers 5-6p, p11): 3 gold + 6 hills + 7 forests + 7 pastures
// + 6 fields + 6 mountains + 4 deserts = 39 land. Ours is 1 less to match the
// shape that fits cleanly in the radius-4 disk; 34 tokens; 11 ports.
//
// Geometry is APPROXIMATE — expanded main island filling much of the radius-4
// disk. Visual verification against
// [docs/.scenario-renders/seafarers-56-p11.png] is pending.
// ---------------------------------------------------------------------------
const LAND_5_6P: ScenarioPosition[] = [
  // West column
  { q: -4, r: 2, kind: 'land' },
  { q: -4, r: 3, kind: 'land' },
  { q: -4, r: 4, kind: 'desert' },
  // Outer west
  { q: -3, r: 0, kind: 'land' },
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -3, r: 3, kind: 'land' },
  // Inner west
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'desert' },
  { q: -2, r: 2, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },
  { q: -2, r: 4, kind: 'desert' },
  // Center cols
  { q: -1, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: -1, r: 3, kind: 'land' },
  { q: 0, r: -2, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: 0, r: 0, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: 0, r: 2, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
  { q: 1, r: -2, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: 1, r: 2, kind: 'land' },
  // East cols
  { q: 2, r: -2, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: 2, r: 1, kind: 'land' },
  { q: 3, r: -2, kind: 'land' },
  { q: 3, r: -1, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: 3, r: 1, kind: 'land' },
  // Far east
  { q: 4, r: -2, kind: 'desert' },
  { q: 4, r: -1, kind: 'land' },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 11 ports — each anchor faces an in-disk sea hex (verified coastal).
  portAnchors: [
    { q: -4, r: 2, direction: 4 }, // → (-4, 1) sea
    { q: -3, r: 0, direction: 4 }, // → (-3, -1) sea
    { q: -1, r: -1, direction: 4 }, // → (-1, -2) sea
    { q: 0, r: -2, direction: 4 }, // → (0, -3) sea
    { q: 1, r: -2, direction: 4 }, // → (1, -3) sea
    { q: 2, r: -2, direction: 4 }, // → (2, -3) sea
    { q: 3, r: -2, direction: 4 }, // → (3, -3) sea
    { q: 3, r: 1, direction: 2 }, // → (2, 2) sea
    { q: -1, r: 3, direction: 1 }, // → (-1, 4) sea
    { q: 1, r: 2, direction: 1 }, // → (1, 3) sea
    { q: 2, r: 1, direction: 1 }, // → (2, 2) sea
  ],
  pools: {
    // 34 non-desert land hexes (4 deserts are fixed positions).
    terrainCounts: {
      gold: 3,
      brick: 6,
      wood: 6,
      sheep: 7,
      wheat: 6,
      ore: 6,
    },
    // 34 tokens — fully symmetric around 7. 2/12: 2 each, 3/11: 3 each,
    // 4/10: 4 each, 5/9: 4 each, 6/8: 4 each.
    tokens: [
      2, 2,
      3, 3, 3,
      4, 4, 4, 4,
      5, 5, 5, 5,
      6, 6, 6, 6,
      8, 8, 8, 8,
      9, 9, 9, 9,
      10, 10, 10, 10,
      11, 11, 11,
      12, 12,
    ],
    // 11 port types — 6 generic + 5 single-resource.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const wondersOfCatan = buildScenario({
  id: 'wondersOfCatan',
  name: 'The Wonders of Catan',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 10,
  defaultVpToWin5_6: 12,
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

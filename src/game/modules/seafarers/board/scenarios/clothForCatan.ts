import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// Cloth for Catan — main island plus small "cloth villages" on outer islets.
// `clothHexes` flip the production rule: rolling a cloth hex's number gives
// the player cloth tokens instead of the listed resource (1 per settlement
// and 2 per city, per `actions/dice.ts`). Cloth → VP at floor(cloth / 2).
//
// Structural migration to the modular schema. Cloth-producing hexes stay
// anchored at the same coordinates so the mechanic keeps working; underlying
// terrain there is randomized from the pool (purely visual since rolls
// produce cloth, not the listed resource).

// 3 cloth-producing hexes, anchored on outer-island land.
const CLOTH_HEXES_3_4: { q: number; r: number }[] = [
  { q: 3, r: -3 },
  { q: 3, r: 0 },
  { q: -1, r: 3 },
];

// 8 main + 1 desert + 6 cloth-islet hexes = 15 land.
const LAND_3_4P: ScenarioPosition[] = [
  // Main island (8 land + 1 desert)
  { q: 0, r: 0, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -1, r: -1, kind: 'desert' },
  // Cloth islets
  { q: 2, r: -3, kind: 'land' },
  { q: 3, r: -3, kind: 'land' },
  { q: 3, r: -1, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: -1, r: 3, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    ...LAND_3_4P,
    ...seaPositionsInDisk(LAND_3_4P, 3),
  ],
  portAnchors: [
    { q: 1, r: -1, direction: 0 },
    { q: 1, r: 0, direction: 1 },
    { q: 0, r: 1, direction: 2 },
    { q: -2, r: 1, direction: 3 },
    { q: 0, r: -1, direction: 5 },
    { q: -1, r: 0, direction: 3 },
  ],
  pools: {
    // 14 non-desert land hexes.
    terrainCounts: {
      gold: 3,
      brick: 1,
      wood: 2,
      sheep: 4,
      wheat: 3,
      ore: 1,
    },
    // 14 tokens — fully symmetric around 7 (no 2 or 12). 3/11: 1, 4/10: 2,
    // 5/9: 2, 6/8: 2.
    tokens: [3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11],
    portTypes: ['generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout: 32 land (28 non-desert + 4 desert) + 29 sea = 61 disk
// Rulebook (Seafarers 5-6p, p9): 2 gold + 4 hills + 6 forests + 5 pastures
// + 6 fields + 5 mountains + 4 deserts = 32 land; 28 tokens; 11 ports.
// 6 cloth-producing hexes (vs 3 at 3-4p).
//
// Geometry is APPROXIMATE — visual verification against
// [docs/.scenario-renders/seafarers-56-p09.png] is pending.
// ---------------------------------------------------------------------------
const CLOTH_HEXES_5_6: { q: number; r: number }[] = [
  { q: 3, r: -3 },
  { q: 3, r: 0 },
  { q: -1, r: 4 },
  { q: 4, r: -2 },
  { q: 1, r: 3 },
  { q: -3, r: 4 },
];

const LAND_5_6P: ScenarioPosition[] = [
  // Main island (18 non-desert + 4 desert)
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -2, r: 3, kind: 'desert' },
  { q: -1, r: -1, kind: 'desert' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: -1, r: 3, kind: 'land' },
  { q: 0, r: -2, kind: 'desert' },
  { q: 0, r: -1, kind: 'land' },
  { q: 0, r: 0, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: 0, r: 2, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
  { q: 1, r: -2, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: 1, r: 2, kind: 'desert' },
  // Cloth islets + extras (10 non-desert)
  { q: 3, r: -3, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: -1, r: 4, kind: 'land' },
  { q: 4, r: -2, kind: 'land' },
  { q: 1, r: 3, kind: 'land' },
  { q: -3, r: 4, kind: 'land' },
  { q: 4, r: -3, kind: 'land' },
  { q: 4, r: 0, kind: 'land' },
  { q: -2, r: 4, kind: 'land' },
  { q: 2, r: 1, kind: 'land' },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 11 ports — each anchor faces an in-disk sea hex.
  portAnchors: [
    { q: -3, r: 1, direction: 3 }, // → (-4, 1) sea
    { q: -3, r: 2, direction: 3 }, // → (-4, 2) sea
    { q: -2, r: 0, direction: 4 }, // → (-2, -1) sea
    { q: 1, r: -2, direction: 4 }, // → (1, -3) sea
    { q: 1, r: -1, direction: 0 }, // → (2, -1) sea
    { q: 0, r: 3, direction: 1 }, // → (0, 4) sea
    { q: -2, r: 2, direction: 2 }, // → (-3, 3) sea
    { q: 4, r: -3, direction: 4 }, // → (4, -4) sea
    { q: 4, r: 0, direction: 2 }, // → (3, 1) sea
    { q: 2, r: 1, direction: 1 }, // → (2, 2) sea
    { q: -3, r: 4, direction: 3 }, // → (-4, 4) sea
  ],
  pools: {
    // 28 non-desert land hexes (4 deserts are fixed positions).
    terrainCounts: {
      gold: 2,
      brick: 4,
      wood: 6,
      sheep: 5,
      wheat: 6,
      ore: 5,
    },
    // 28 tokens — fully symmetric around 7. 2/12: 1, 3/11: 3, 4/10: 3,
    // 5/9: 3, 6/8: 4.
    tokens: [
      2,
      3, 3, 3,
      4, 4, 4,
      5, 5, 5,
      6, 6, 6, 6,
      8, 8, 8, 8,
      9, 9, 9,
      10, 10, 10,
      11, 11, 11,
      12,
    ],
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const clothForCatan = buildScenario({
  id: 'clothForCatan',
  name: 'Cloth for Catan',
  defaultIslandBonusVp: 3,
  defaultVpToWin: 14,
  defaultVpToWin5_6: 16,
  minPlayers: 3,
  maxPlayers: 6,
  clothHexes: CLOTH_HEXES_3_4,
  clothHexes5_6: CLOTH_HEXES_5_6,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

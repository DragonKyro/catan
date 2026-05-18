import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// New World — the rulebook explicitly invites players to design their own
// layout. Our shipped version is a representative shape.
//
// Structural migration to the modular schema. Same land coordinates; terrain,
// tokens and port types are pool-drawn.

// 13 land + 1 desert = 14 land positions.
const LAND_3_4P: ScenarioPosition[] = [
  { q: -2, r: 0, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  { q: 0, r: -2, kind: 'land' },
  { q: 1, r: -2, kind: 'land' },
  { q: 2, r: -2, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: 0, r: 2, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: 0, r: 0, kind: 'desert' },
  { q: -1, r: 1, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 3, r: -1, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    ...LAND_3_4P,
    ...seaPositionsInDisk(LAND_3_4P, 3),
  ],
  portAnchors: [
    { q: -2, r: 0, direction: 4 },
    { q: 2, r: -2, direction: 0 },
    { q: 1, r: 1, direction: 0 },
    { q: -2, r: 2, direction: 3 },
    { q: 0, r: -2, direction: 5 },
    { q: 3, r: 0, direction: 2 },
  ],
  pools: {
    // 13 non-desert land hexes.
    terrainCounts: {
      gold: 2,
      brick: 2,
      wood: 2,
      sheep: 2,
      wheat: 3,
      ore: 2,
    },
    // 13 tokens — symmetric around 7. Odd total → smallest asymmetry at
    // the 2/12 pair (rarest rolls, least impactful). 2: 1, 3/11: 1 each,
    // 4/10: 1 each, 5/9: 2 each, 6/8: 2 each, 12: 0.
    tokens: [2, 3, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 11],
    portTypes: ['generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout: 42 land (37 non-desert + 5 desert) + 19 sea = 61 disk
// Rulebook (Seafarers 5-6p, p12): 4 gold + 7 hills + 7 forests + 7 pastures
// + 7 fields + 5 mountains + 5 deserts = 42 land; 37 tokens; 9 ports.
//
// The rulebook explicitly invites players to design their own layout — we
// ship a representative wide-spread shape filling most of the radius-4 disk.
// Visual reference: [docs/.scenario-renders/seafarers-56-p12.png].
// ---------------------------------------------------------------------------
const LAND_5_6P: ScenarioPosition[] = [
  // Radius 0-2 ring (19 hexes — base-game-sized disk filled)
  { q: 0, r: 0, kind: 'desert' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  { q: 0, r: -2, kind: 'land' },
  { q: 1, r: -2, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: 0, r: 2, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: 2, r: -2, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  // Radius 3 ring picks (15)
  { q: 1, r: -3, kind: 'land' },
  { q: 2, r: -3, kind: 'land' },
  { q: 3, r: -3, kind: 'desert' },
  { q: 3, r: -1, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: 2, r: 1, kind: 'land' },
  { q: 1, r: 2, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
  { q: -1, r: 3, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },
  { q: -3, r: 3, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 0, kind: 'desert' },
  { q: -1, r: -2, kind: 'land' },
  // Radius 4 outer picks (8)
  { q: 2, r: -4, kind: 'land' },
  { q: 4, r: -3, kind: 'land' },
  { q: 4, r: -1, kind: 'land' },
  { q: 3, r: 1, kind: 'desert' },
  { q: 1, r: 3, kind: 'land' },
  { q: -2, r: 4, kind: 'land' },
  { q: -4, r: 2, kind: 'desert' },
  { q: -3, r: -1, kind: 'land' },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 9 ports — rulebook 5-6p New World (4×2:1 + 5×3:1). All verified coastal.
  portAnchors: [
    { q: 4, r: -3, direction: 4 }, // → (4, -4) sea
    { q: 4, r: -1, direction: 4 }, // → (4, -2) sea
    { q: 1, r: -3, direction: 4 }, // → (1, -4) sea
    { q: 2, r: -4, direction: 0 }, // → (3, -4) sea
    { q: 1, r: 3, direction: 2 }, // → (0, 4) sea
    { q: -2, r: 4, direction: 0 }, // → (-1, 4) sea
    { q: -3, r: 3, direction: 2 }, // → (-4, 4) sea
    { q: -3, r: 1, direction: 3 }, // → (-4, 1) sea
    { q: -3, r: -1, direction: 2 }, // → (-4, 0) sea
  ],
  pools: {
    // 37 non-desert land hexes (5 deserts are fixed positions).
    terrainCounts: {
      gold: 4,
      brick: 7,
      wood: 7,
      sheep: 7,
      wheat: 7,
      ore: 5,
    },
    // 37 tokens — symmetric around 7. Odd total → 6/8 differ by 1.
    // 2/12: 2, 3/11: 3, 4/10: 4, 5/9: 5, 6: 4, 8: 5.
    tokens: [
      2, 2,
      3, 3, 3,
      4, 4, 4, 4,
      5, 5, 5, 5, 5,
      6, 6, 6, 6,
      8, 8, 8, 8, 8,
      9, 9, 9, 9, 9,
      10, 10, 10, 10,
      11, 11, 11,
      12, 12,
    ],
    // 9 port types — 4 generic + 5 single-resource.
    portTypes: [
      'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const newWorld = buildScenario({
  id: 'newWorld',
  name: 'New World',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 12,
  defaultVpToWin5_6: 13,
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

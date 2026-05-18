import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// The Forgotten Tribe — main island with scattered outer islets, each
// carrying a tribe token (dev card / VP / commercial harbor) claimed by the
// first player to settle adjacent.
//
// Structural migration to the modular schema. Tribe tokens stay anchored at
// the same (q, r) so the claim mechanic keeps working; terrain at those
// positions is drawn from the pool.

const TRIBE_TOKENS_3_4: {
  q: number;
  r: number;
  type: 'devCard' | 'victoryPoint' | 'commercialHarbor';
}[] = [
  { q: 3, r: -2, type: 'commercialHarbor' },
  { q: 3, r: 0, type: 'devCard' },
  { q: 2, r: 1, type: 'victoryPoint' },
  { q: 0, r: 3, type: 'devCard' },
  { q: -2, r: -1, type: 'commercialHarbor' },
];

// 9 non-desert main-island hexes + 1 desert + 5 tribe islets = 15 land.
const LAND_3_4P: ScenarioPosition[] = [
  // Main island (9 land + 1 desert)
  { q: 0, r: 0, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: -2, r: 1, kind: 'desert' },
  { q: -2, r: 2, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  // Tribe islets — same coords as the tribe tokens above so each token has
  // a land hex to anchor on.
  { q: 3, r: -2, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: 2, r: 1, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
  { q: -2, r: -1, kind: 'land' },
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
    { q: -2, r: 2, direction: 3 },
    { q: -2, r: 1, direction: 4 },
    { q: -1, r: -1, direction: 5 },
  ],
  pools: {
    // 14 non-desert land hexes.
    terrainCounts: {
      gold: 2,
      brick: 2,
      wood: 2,
      sheep: 3,
      wheat: 3,
      ore: 2,
    },
    // 14 tokens — fully symmetric around 7 (no 2 or 12). 3/11: 2, 4/10: 1,
    // 5/9: 2, 6/8: 2.
    tokens: [3, 3, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 11, 11],
    portTypes: ['generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout: 41 land (37 non-desert + 4 desert) + 20 sea = 61 disk
// Rulebook (Seafarers 5-6p, p8): 3 gold + 7 hills + 7 forests + 7 pastures
// + 7 fields + 6 mountains + 4 deserts = 41 land. Tribe islets are
// tokenless in the rulebook but our engine puts a number on every
// non-desert land hex (same as 3-4p); 37 tokens.
//
// Rulebook tribe-token count is 8 at 5-6p (5 at 3-4p). Visual verification
// against [docs/.scenario-renders/seafarers-56-p08.png] is pending.
// ---------------------------------------------------------------------------
const TRIBE_TOKENS_5_6: {
  q: number;
  r: number;
  type: 'devCard' | 'victoryPoint' | 'commercialHarbor';
}[] = [
  { q: 3, r: -3, type: 'commercialHarbor' },
  { q: 4, r: -1, type: 'devCard' },
  { q: 3, r: 1, type: 'victoryPoint' },
  { q: 1, r: 3, type: 'devCard' },
  { q: -2, r: 4, type: 'commercialHarbor' },
  { q: -4, r: 4, type: 'devCard' },
  { q: -4, r: 1, type: 'victoryPoint' },
  { q: -3, r: -1, type: 'commercialHarbor' },
];

const LAND_5_6P: ScenarioPosition[] = [
  // Main island (24 non-desert + 4 desert = 28 hexes)
  { q: -3, r: 0, kind: 'land' },
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -3, r: 3, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'desert' },
  { q: -2, r: 2, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },
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
  { q: 1, r: -2, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: 2, r: -2, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: -1, r: -2, kind: 'desert' },
  { q: 2, r: 1, kind: 'desert' },
  { q: 1, r: 2, kind: 'desert' },
  // Outer tribe-token islets (8) — same coords as TRIBE_TOKENS_5_6
  { q: 3, r: -3, kind: 'land' },
  { q: 4, r: -1, kind: 'land' },
  { q: 3, r: 1, kind: 'land' },
  { q: 1, r: 3, kind: 'land' },
  { q: -2, r: 4, kind: 'land' },
  { q: -4, r: 4, kind: 'land' },
  { q: -4, r: 1, kind: 'land' },
  { q: -3, r: -1, kind: 'land' },
  // 5 extra non-desert filler hexes to reach 37 non-desert
  { q: 4, r: -2, kind: 'land' },
  { q: 4, r: 0, kind: 'land' },
  { q: -3, r: 4, kind: 'land' },
  { q: -4, r: 3, kind: 'land' },
  { q: 2, r: -3, kind: 'land' },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 8 ports — rulebook 5-6p Forgotten Tribe (5×2:1 + 3×3:1). All verified
  // coastal.
  portAnchors: [
    { q: -3, r: 0, direction: 5 }, // → (-2, -1) sea
    { q: -4, r: 1, direction: 4 }, // → (-4, 0) sea
    { q: -4, r: 3, direction: 4 }, // → (-4, 2) sea
    { q: -2, r: 4, direction: 0 }, // → (-1, 4) sea
    { q: 1, r: 3, direction: 3 }, // → (0, 3) sea
    { q: 4, r: 0, direction: 3 }, // → (3, 0) sea
    { q: 4, r: -2, direction: 4 }, // → (4, -3) sea
    { q: 2, r: -3, direction: 4 }, // → (2, -4) sea
  ],
  pools: {
    // 37 non-desert land hexes (4 deserts are fixed positions).
    terrainCounts: {
      gold: 3,
      brick: 7,
      wood: 7,
      sheep: 7,
      wheat: 7,
      ore: 6,
    },
    // 37 tokens — symmetric around 7. Odd total → smallest possible asymmetry
    // (6/8 differ by 1). 2/12: 2, 3/11: 3, 4/10: 4, 5/9: 5, 6: 4, 8: 5.
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
    // 8 port types — 3 generic + 5 single-resource per rulebook.
    portTypes: [
      'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const forgottenTribe = buildScenario({
  id: 'forgottenTribe',
  name: 'The Forgotten Tribe',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 11,
  defaultVpToWin5_6: 13,
  minPlayers: 3,
  maxPlayers: 6,
  tribeTokens: TRIBE_TOKENS_3_4,
  tribeTokens5_6: TRIBE_TOKENS_5_6,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

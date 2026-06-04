import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// Fog Island — main island plus a chain of "fog" hexes that start hidden
// (`fogHexes`). They're revealed when a player builds adjacent to them, and
// the revealing player gets one of the revealed resource (gold prompts the
// choose-resource flow, desert reveals silently).
//
// Structural migration to the modular schema. Same fog-hex coordinates as
// before so the reveal mechanic keeps working; terrain and tokens at those
// coords are drawn from the pool at game-start (matches the rulebook's
// "facedown" semantics — players don't know what's under the fog until they
// reveal it).

// 8 non-desert + 1 desert main island + 6 fog hexes = 15 land positions.
const FOG_COORDS_3_4P: { q: number; r: number }[] = [
  { q: 3, r: -2 },
  { q: 3, r: -1 },
  { q: 3, r: 0 },
  { q: 2, r: 1 },
  { q: 2, r: -3 },
  { q: 1, r: 2 },
];

const LAND_3_4P: ScenarioPosition[] = [
  // Main island (8 land + 1 desert)
  { q: 0, r: 0, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: -2, r: 1, kind: 'desert' },
  { q: -2, r: 2, kind: 'land' },
  // Fog hexes (terrain drawn from pool; identity tracked by FOG_COORDS_3_4P)
  ...FOG_COORDS_3_4P.map((c) => ({ q: c.q, r: c.r, kind: 'land' as const })),
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    ...LAND_3_4P,
    ...seaPositionsInDisk(LAND_3_4P, 3),
  ],
  portAnchors: [
    { q: 0, r: -1, direction: 5 },
    { q: 1, r: 0, direction: 1 },
    { q: 0, r: 1, direction: 2 },
    { q: -2, r: 2, direction: 3 },
    { q: -2, r: 1, direction: 4 },
    { q: -1, r: 0, direction: 4 },
  ],
  pools: {
    // 14 non-desert land hexes. Two gold (both on the fog chain in the
    // original layout) — the pool draws random positions so any of the 14
    // land hexes can end up with gold.
    terrainCounts: {
      gold: 2,
      brick: 2,
      wood: 3,
      sheep: 2,
      wheat: 3,
      ore: 2,
    },
    // 14 tokens (one per non-desert land hex).
    tokens: [3, 3, 4, 4, 5, 6, 6, 8, 8, 9, 10, 10, 11, 11],
    portTypes: ['generic', 'generic', 'sheep', 'wheat', 'brick', 'ore'],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout: 38 land (36 non-desert + 2 desert) + 23 sea = 61 disk
// Rulebook (Seafarers 5-6p, p6): 2 gold + 7 hills + 7 forests + 7 pastures
// + 7 fields + 6 mountains + 2 deserts = 38 land; 36 tokens; 11 ports.
//
// The rulebook treats 18 of these hexes as "facedown" (hidden under fog
// until revealed) — we encode that via `fogHexes5_6` so the engine reveals
// them when a player builds adjacent. Visual verification against
// [docs/.scenario-renders/seafarers-56-p06.png] is pending.
// ---------------------------------------------------------------------------
const FOG_COORDS_5_6P: { q: number; r: number }[] = [
  // Eastern archipelago — these start under fog
  { q: 2, r: -3 },
  { q: 3, r: -3 },
  { q: 3, r: -2 },
  { q: 3, r: -1 },
  { q: 3, r: 0 },
  { q: 3, r: 1 },
  { q: 2, r: 1 },
  { q: 1, r: 2 },
  { q: 1, r: 3 },
  { q: 4, r: -2 },
  { q: 4, r: -1 },
  { q: 4, r: 0 },
];

const LAND_5_6P: ScenarioPosition[] = [
  // Main island (25 non-desert + 1 desert = 26 hexes)
  { q: -4, r: 1, kind: 'land' },
  { q: -4, r: 2, kind: 'land' },
  { q: -4, r: 3, kind: 'land' },
  { q: -4, r: 4, kind: 'land' },
  { q: -3, r: 0, kind: 'land' },
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -3, r: 3, kind: 'land' },
  { q: -3, r: 4, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'desert' },
  { q: -2, r: 2, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },
  { q: -2, r: 4, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: -1, r: 3, kind: 'land' },
  { q: -1, r: 4, kind: 'land' },
  { q: 0, r: -2, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: 0, r: 0, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: 0, r: 2, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
  // Fog archipelago (11 non-desert + 1 desert = 12)
  ...FOG_COORDS_5_6P.map((c) => ({
    q: c.q,
    r: c.r,
    kind: (c.q === 4 && c.r === -1 ? 'desert' : 'land') as 'land' | 'desert',
  })),
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 11 ports — each anchor faces an in-disk sea hex.
  portAnchors: [
    { q: -4, r: 1, direction: 4 }, // → (-4, 0) sea
    { q: -3, r: 0, direction: 4 }, // → (-3, -1) sea
    { q: -1, r: -1, direction: 4 }, // → (-1, -2) sea
    { q: 0, r: -2, direction: 4 }, // → (0, -3) sea
    { q: -1, r: 4, direction: 0 }, // → (0, 4) sea
    { q: 0, r: 3, direction: 1 }, // → (0, 4) sea (other edge)
    { q: 2, r: -3, direction: 4 }, // → (2, -4) sea
    { q: 3, r: -3, direction: 5 }, // → (4, -4) sea
    { q: 3, r: 1, direction: 2 }, // → (2, 2) sea
    { q: 1, r: 3, direction: 5 }, // → (2, 2) sea (other edge)
    { q: 1, r: 2, direction: 4 }, // → (1, 1) sea
  ],
  pools: {
    // 36 non-desert land hexes (2 deserts are fixed positions).
    terrainCounts: {
      gold: 2,
      brick: 7,
      wood: 7,
      sheep: 7,
      wheat: 7,
      ore: 6,
    },
    // 36 tokens — fully symmetric around 7. 2/12: 2, 3/11: 3, 4/10: 4,
    // 5/9: 4, 6/8: 5.
    tokens: [
      2, 2,
      3, 3, 3,
      4, 4, 4, 4,
      5, 5, 5, 5,
      6, 6, 6, 6, 6,
      8, 8, 8, 8, 8,
      9, 9, 9, 9,
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

export const fogIsland = buildScenario({
  id: 'fogIsland',
  name: 'Fog Island',
  defaultIslandBonusVp: 3,
  defaultVpToWin: 12,
  defaultVpToWin5_6: 13,
  minPlayers: 3,
  maxPlayers: 6,
  fogHexes: FOG_COORDS_3_4P,
  fogHexes5_6: FOG_COORDS_5_6P,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

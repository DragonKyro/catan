import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// Pirate Islands — main island plus outer "pirate isles" separated by a
// stretch of sea where a pirate fleet sits. Players sail ships east to
// attack the fleet via `attackPirateFleet`; killing it grants +2 VP.
//
// Structural migration to the modular schema. Same land coordinates and
// pirate-fleet anchor; terrains, tokens, and port types are pool-drawn.

// 9 main + 1 desert + 6 outer islets = 16 land positions.
const LAND_3_4P: ScenarioPosition[] = [
  // Main island (9 land + 1 desert)
  { q: -3, r: 0, kind: 'land' },
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -2, r: -1, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -1, r: -2, kind: 'desert' },
  { q: -1, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  // Pirate isles (small outer islands)
  { q: 1, r: -2, kind: 'land' },
  { q: 2, r: -2, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: 3, r: -1, kind: 'land' },
  { q: 1, r: 2, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    ...LAND_3_4P,
    ...seaPositionsInDisk(LAND_3_4P, 3),
  ],
  portAnchors: [
    // (-3, 0) has no coastal edge to an in-frame sea hex at 3p; the NW
    // generic port anchors on the desert at (-1, -2) facing NE.
    { q: -1, r: -2, direction: 5 },
    { q: -3, r: 2, direction: 1 },
    { q: -1, r: 0, direction: 1 },
    { q: 1, r: -2, direction: 5 },
    { q: 2, r: 0, direction: 2 },
    { q: 0, r: 3, direction: 4 },
  ],
  pools: {
    // 15 non-desert land hexes.
    terrainCounts: {
      gold: 2,
      brick: 2,
      wood: 3,
      sheep: 3,
      wheat: 3,
      ore: 2,
    },
    // 15 tokens — symmetric around 7. Odd total → smallest asymmetry at
    // the 2/12 pair (rarest, least impactful). 2: 1, 3/11: 1 each, 4/10: 2,
    // 5/9: 2, 6/8: 2.
    tokens: [2, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11],
    portTypes: ['generic', 'generic', 'wood', 'brick', 'sheep', 'wheat'],
  },
  // Pirate fleet sits on the sea hex between the main island and the isles.
  // (1, 0) isn't a land position so it becomes sea via `seaPositionsInDisk`,
  // and the generator anchors the pirate token there.
  pirateStart: { q: 1, r: 0 },
};

// ---------------------------------------------------------------------------
// 5-6 player layout: 37 land (32 non-desert + 5 desert) + 24 sea = 61 disk
// Rulebook (Seafarers 5-6p, p10): 4 gold + 4 hills + 6 forests + 6 pastures
// + 5 fields + 7 mountains + 5 deserts = 37 land; 32 tokens; 9 ports.
//
// Geometry is APPROXIMATE — large main island (west) + pirate-isles
// archipelago (east) separated by a corridor of sea where the fleet sits.
// Visual verification against [docs/.scenario-renders/seafarers-56-p10.png]
// is pending.
// ---------------------------------------------------------------------------
const LAND_5_6P: ScenarioPosition[] = [
  // Main island west (20 non-desert + 2 desert = 22 hexes)
  { q: -4, r: 0, kind: 'land' },
  { q: -4, r: 1, kind: 'land' },
  { q: -4, r: 2, kind: 'land' },
  { q: -4, r: 3, kind: 'land' },
  { q: -4, r: 4, kind: 'land' },
  { q: -3, r: -1, kind: 'land' },
  { q: -3, r: 0, kind: 'land' },
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -3, r: 3, kind: 'land' },
  { q: -3, r: 4, kind: 'land' },
  { q: -2, r: -1, kind: 'desert' },
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },
  { q: -2, r: 4, kind: 'desert' },
  { q: -1, r: -2, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  // Pirate isles east (12 non-desert + 3 desert = 15 hexes)
  { q: 2, r: -2, kind: 'land' },
  { q: 3, r: -3, kind: 'land' },
  { q: 3, r: -2, kind: 'land' },
  { q: 4, r: -3, kind: 'land' },
  { q: 4, r: -2, kind: 'desert' },
  { q: 2, r: 0, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: 3, r: 1, kind: 'land' },
  { q: 4, r: 0, kind: 'land' },
  { q: 4, r: -1, kind: 'desert' },
  { q: 0, r: 3, kind: 'land' },
  { q: 1, r: 3, kind: 'land' },
  { q: 1, r: 2, kind: 'land' },
  { q: 0, r: 4, kind: 'land' },
  { q: 2, r: 1, kind: 'desert' },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 9 ports — rulebook 5-6p Pirate Islands (5×2:1 + 4×3:1). All verified
  // coastal.
  portAnchors: [
    { q: -2, r: -1, direction: 4 }, // → (-2, -2) sea
    { q: -3, r: -1, direction: 5 }, // → (-2, -2) sea
    { q: -1, r: -2, direction: 4 }, // → (-1, -3) sea
    { q: -1, r: 2, direction: 1 }, // → (-1, 3) sea
    { q: -2, r: 4, direction: 0 }, // → (-1, 4) sea
    { q: 2, r: -2, direction: 3 }, // → (1, -2) sea
    { q: 3, r: -3, direction: 4 }, // → (3, -4) sea
    { q: 3, r: 1, direction: 2 }, // → (2, 2) sea
    { q: 0, r: 4, direction: 3 }, // → (-1, 4) sea (other edge)
  ],
  // Pirate fleet starts on the sea corridor between main and pirate isles.
  pirateStart: { q: 1, r: 0 },
  pools: {
    // 32 non-desert land hexes (5 deserts are fixed positions).
    terrainCounts: {
      gold: 4,
      brick: 4,
      wood: 6,
      sheep: 6,
      wheat: 5,
      ore: 7,
    },
    // 32 tokens — fully symmetric around 7. 2/12: 2, 3/11: 3, 4/10: 3,
    // 5/9: 4, 6/8: 4.
    tokens: [
      2, 2,
      3, 3, 3,
      4, 4, 4,
      5, 5, 5, 5,
      6, 6, 6, 6,
      8, 8, 8, 8,
      9, 9, 9, 9,
      10, 10, 10,
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

export const pirateIslands = buildScenario({
  id: 'pirateIslands',
  name: 'Pirate Islands',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 12,
  defaultVpToWin5_6: 13,
  minPlayers: 3,
  maxPlayers: 6,
  pirateFleet: { q: 1, r: 0, strength: 4 },
  // 5-6p fleet has +1 strength per rulebook.
  pirateFleet5_6: { q: 1, r: 0, strength: 5 },
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

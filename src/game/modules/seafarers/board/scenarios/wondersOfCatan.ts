import type { ScenarioLayout, ScenarioWonderSitesDef } from '../types';
import { buildScenario } from './builder';
import { fixedPositions, seaHexes, type FixedHex } from './helpers';

// The Wonders of Catan — Seafarers rulebook p.18-19 (3-4 players) and
// Seafarers 5-6 p.11. Fixed setup transcribed from the rulebook maps
// (terrain and number counts match the component tables exactly).
//
// A large island with a desert to the east (the Great Wall markers run
// along it), a strait in the south crossed by the Great Bridge markers
// (5-6: plus the lighthouse markers in the north), and small islands worth
// 1 VP to each player's first settlement there. No pirate. Wonder rules and
// the win condition live in ../../wonders/catalogue.ts.
//
// Corners: 0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N. Edge directions: 0 E, 1 SE,
// 2 SW, 3 W, 4 NW, 5 NE.

// ---------------------------------------------------------------- 3-4p ---
const HEXES_3_4P: FixedHex[] = [
  // Small islands.
  [-1, -3, 'gold', 8], [0, -3, 'brick', 2],
  [3, 1, 'gold', 6], [2, 2, 'wood', 4], [1, 3, 'wheat', 5],
  // The large island.
  [2, -3, 'ore', 10],
  [1, -2, 'wood', 11], [3, -2, 'desert'],
  [-3, -1, 'ore', 12], [-2, -1, 'wheat', 6], [-1, -1, 'brick', 11], [0, -1, 'wheat', 10],
  [1, -1, 'sheep', 3], [2, -1, 'wood', 9], [3, -1, 'desert'],
  [-3, 0, 'ore', 3], [-2, 0, 'wheat', 4], [-1, 0, 'ore', 6], [0, 0, 'sheep', 5],
  [1, 0, 'brick', 4], [2, 0, 'desert'],
  [-4, 1, 'brick', 8], [-3, 1, 'sheep', 9], [0, 1, 'brick', 10],
  [-3, 2, 'wood', 3], [-1, 2, 'wood', 8], [0, 2, 'wheat', 9],
  [-4, 3, 'ore', 5], [-2, 3, 'sheep', 11], [-1, 3, 'sheep', 2],
  ...seaHexes([
    [1, -3], [3, -3], [4, -3],
    [-2, -2], [-1, -2], [0, -2], [2, -2], [4, -2],
    [4, -1],
    [-4, 0], [3, 0],
    [-2, 1], [-1, 1], [1, 1], [2, 1],
    [-4, 2], [-2, 2], [1, 2],
    [-3, 3], [0, 3],
  ]),
];

const SITES_3_4P: ScenarioWonderSitesDef = {
  greatWall: [
    { q: 2, r: -1, corner: 5 },
    { q: 2, r: -1, corner: 0 },
    { q: 2, r: -1, corner: 1 },
    { q: 2, r: -1, corner: 2 },
    { q: 1, r: 0, corner: 1 },
  ],
  greatBridge: [
    { q: -3, r: 2, corner: 1 },
    { q: -2, r: 3, corner: 4 },
  ],
  xMarkers: [
    { q: -3, r: 2, corner: 0 },
    { q: -3, r: 2, corner: 2 },
    { q: -2, r: 3, corner: 5 },
    { q: -2, r: 3, corner: 3 },
  ],
};

const LAYOUT_3_4P: ScenarioLayout = {
  positions: fixedPositions(HEXES_3_4P),
  portAnchors: [
    { q: -2, r: -1, direction: 4 },
    { q: 0, r: -1, direction: 4 },
    { q: 1, r: -1, direction: 5 },
    { q: -3, r: 0, direction: 3 },
    { q: -2, r: 0, direction: 1 },
    { q: 0, r: 2, direction: 5 },
    { q: 0, r: 2, direction: 1 },
    { q: -2, r: 3, direction: 1 },
    { q: -3, r: 2, direction: 3 },
  ],
  pools: {
    terrainCounts: {},
    tokens: [],
    portTypes: [
      'wood', 'brick', 'sheep', 'wheat', 'ore',
      'generic', 'generic', 'generic', 'generic',
    ],
  },
  robberStart: { q: 3, r: -1 },
};

// ---------------------------------------------------------------- 5-6p ---
const HEXES_5_6P: FixedHex[] = [
  // Small islands.
  [-2, -3, 'gold', 8],
  [-5, 2, 'gold', 6],
  [3, 2, 'wood', 4], [2, 3, 'gold', 6],
  // The large island.
  [0, -3, 'sheep', 10], [2, -3, 'wheat', 12],
  [-1, -2, 'brick', 11], [1, -2, 'wood', 11], [4, -2, 'desert'], [5, -2, 'desert'],
  [-3, -1, 'brick', 2], [-2, -1, 'sheep', 5], [-1, -1, 'wheat', 6], [0, -1, 'brick', 5],
  [1, -1, 'wheat', 3], [2, -1, 'sheep', 8], [3, -1, 'wood', 11], [4, -1, 'desert'],
  [-3, 0, 'wheat', 9], [-2, 0, 'ore', 3], [-1, 0, 'wood', 4], [0, 0, 'ore', 6],
  [1, 0, 'wheat', 10], [2, 0, 'sheep', 9], [3, 0, 'brick', 10], [4, 0, 'desert'],
  [-3, 1, 'brick', 8], [-2, 1, 'sheep', 5], [0, 1, 'brick', 4], [1, 1, 'wood', 8],
  [2, 1, 'ore', 12],
  [-3, 2, 'wood', 10], [-2, 2, 'ore', 3], [0, 2, 'ore', 9], [1, 2, 'wheat', 4],
  [-4, 3, 'ore', 5], [-3, 3, 'wood', 9], [-1, 3, 'sheep', 2], [0, 3, 'sheep', 11],
  ...seaHexes([
    [-1, -3], [1, -3], [3, -3], [4, -3], [5, -3],
    [-3, -2], [-2, -2], [0, -2], [2, -2], [3, -2],
    [-4, -1], [5, -1],
    [-4, 0],
    [-5, 1], [-4, 1], [-1, 1], [3, 1], [4, 1],
    [-4, 2], [-1, 2], [2, 2],
    [-5, 3], [-2, 3], [1, 3],
  ]),
];

const SITES_5_6P: ScenarioWonderSitesDef = {
  greatWall: [
    { q: 3, r: -1, corner: 5 },
    { q: 3, r: -1, corner: 0 },
    { q: 3, r: -1, corner: 1 },
    { q: 3, r: 0, corner: 0 },
    { q: 3, r: 0, corner: 1 },
  ],
  greatBridge: [
    { q: -2, r: 2, corner: 1 },
    { q: -1, r: 3, corner: 4 },
  ],
  lighthouse: [
    { q: 0, r: -3, corner: 1 },
    { q: 1, r: -2, corner: 4 },
  ],
  xMarkers: [
    { q: -2, r: 2, corner: 0 },
    { q: -2, r: 2, corner: 2 },
    { q: -1, r: 3, corner: 5 },
    { q: -1, r: 3, corner: 3 },
    { q: 0, r: -3, corner: 0 },
    { q: 0, r: -3, corner: 2 },
    { q: 1, r: -2, corner: 5 },
    { q: 1, r: -2, corner: 3 },
  ],
};

const LAYOUT_5_6P: ScenarioLayout = {
  positions: fixedPositions(HEXES_5_6P),
  portAnchors: [
    { q: -2, r: -1, direction: 4 },
    { q: -1, r: -1, direction: 5 },
    { q: 1, r: -1, direction: 5 },
    { q: -3, r: -1, direction: 3 },
    { q: -1, r: 0, direction: 1 },
    { q: -3, r: 1, direction: 3 },
    { q: 2, r: 1, direction: 1 },
    { q: -3, r: 2, direction: 3 },
    { q: 1, r: 2, direction: 1 },
    { q: -4, r: 3, direction: 1 },
    { q: -1, r: 3, direction: 1 },
  ],
  pools: {
    terrainCounts: {},
    tokens: [],
    portTypes: [
      'wood', 'brick', 'sheep', 'wheat', 'ore', 'sheep',
      'generic', 'generic', 'generic', 'generic', 'generic',
    ],
  },
  robberStart: { q: 4, r: -1 },
};

export const wondersOfCatan = buildScenario({
  id: 'wondersOfCatan',
  name: 'The Wonders of Catan',
  // "Each time you build your first settlement on a small island, you earn
  // 1 additional VP."
  defaultIslandBonusVp: 1,
  // The VP half of the win: 10+ VP with a strictly higher wonder level than
  // everyone else (finishing a wonder wins outright).
  defaultVpToWin: 10,
  minPlayers: 3,
  maxPlayers: 6,
  // "Return the pirate to the box. It is not used in this scenario."
  noPirate: true,
  extras3_4: { wonderSites: SITES_3_4P },
  extras5_6: { wonderSites: SITES_5_6P },
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

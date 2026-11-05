import type { ScenarioLayout, ScenarioVillageDef } from '../types';
import { buildScenario } from './builder';
import { fixedPositions, seaHexes, type FixedHex } from './helpers';

// Cloth for Catan — Seafarers rulebook p.14-15 (3-4 players) and Seafarers
// 5-6 p.9. Fixed setup transcribed from the rulebook maps (terrain and
// number counts — large-island hexes plus villages — match the component
// tables exactly; 5-6 map in docs/map-specs/SEAFARERS56-SPEC-B.md, pinned by
// fiveSix.b.test.ts).
//
// Two large islands (north and south) frame a channel of single-hex small
// islands. The number discs on the small islands' corners are villages that
// trade cloth (../../cloth.ts). Nobody may settle the small islands or put
// the robber on them; there's no Longest Route; each player places three
// starting settlements and only the third pays starting resources.
//
// Corners: 0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N. Edge directions: 0 E, 1 SE,
// 2 SW, 3 W, 4 NW, 5 NE.

// ---------------------------------------------------------------- 3-4p ---
const HEXES_3_4P: FixedHex[] = [
  // North island.
  [-1, -3, 'wood', 4], [0, -3, 'sheep', 6], [1, -3, 'brick', 5], [2, -3, 'sheep', 11],
  [3, -3, 'wheat', 8],
  [-2, -2, 'wheat', 3], [-1, -2, 'wood', 12], [2, -2, 'wood', 3], [3, -2, 'ore', 9],
  [-3, -1, 'wheat', 12],
  // Village islands (no number discs on the hexes themselves).
  [0, -1, 'gold', null], [-2, 0, 'desert'], [1, 0, 'desert'], [-1, 1, 'gold', null],
  // South island.
  [2, 1, 'ore', 2],
  [-4, 2, 'brick', 9], [-3, 2, 'wheat', 2], [0, 2, 'sheep', 11], [1, 2, 'ore', 4],
  [-4, 3, 'sheep', 10], [-3, 3, 'wood', 6], [-2, 3, 'ore', 5], [-1, 3, 'wheat', 10],
  [0, 3, 'brick', 8],
  ...seaHexes([
    [0, -2], [1, -2],
    [-2, -1], [-1, -1], [1, -1], [2, -1], [3, -1],
    [-3, 0], [-1, 0], [0, 0], [2, 0], [3, 0],
    [-4, 1], [-3, 1], [-2, 1], [0, 1], [1, 1],
    [-2, 2], [-1, 2],
  ]),
];

const VILLAGES_3_4P: ScenarioVillageDef[] = [
  { q: 0, r: -1, corner: 5, number: 11 },
  { q: 0, r: -1, corner: 2, number: 8 },
  { q: -1, r: 1, corner: 5, number: 6 },
  { q: -1, r: 1, corner: 2, number: 3 },
  { q: -2, r: 0, corner: 5, number: 10 },
  { q: -2, r: 0, corner: 2, number: 9 },
  { q: 1, r: 0, corner: 5, number: 4 },
  { q: 1, r: 0, corner: 2, number: 5 },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: fixedPositions(HEXES_3_4P),
  portAnchors: [
    { q: -1, r: -3, direction: 5 },
    { q: 2, r: -3, direction: 4 },
    { q: -2, r: -2, direction: 3 },
    { q: 3, r: -2, direction: 0 },
    { q: -4, r: 2, direction: 3 },
    { q: 2, r: 1, direction: 0 },
    { q: -3, r: 3, direction: 2 },
    { q: -1, r: 3, direction: 1 },
    { q: 1, r: 2, direction: 1 },
  ],
  pools: {
    terrainCounts: {},
    tokens: [],
    // "Randomly place ports on the locations shown."
    portTypes: [
      'wood', 'brick', 'sheep', 'wheat', 'ore',
      'generic', 'generic', 'generic', 'generic',
    ],
  },
  // "Players choose which hex with a number 12 disc should start the game
  // with the robber" — the map shows the north island's 12 field.
  robberStart: { q: -3, r: -1 },
  pirateStart: { q: 3, r: 0 },
};

// ---------------------------------------------------------------- 5-6p ---
const HEXES_5_6P: FixedHex[] = [
  // North island.
  [-2, -3, 'wood', 4], [-1, -3, 'sheep', 6], [0, -3, 'brick', 5], [1, -3, 'wheat', 12],
  [2, -3, 'brick', 3], [3, -3, 'sheep', 11], [4, -3, 'wheat', 8],
  [-3, -2, 'wheat', 3], [-2, -2, 'wood', 12], [3, -2, 'wood', 3], [4, -2, 'ore', 9],
  [-4, -1, 'wheat', 11], [4, -1, 'sheep', 3],
  // Village islands.
  [-1, -1, 'desert'], [1, -1, 'desert'],
  [-3, 0, 'gold', null], [2, 0, 'gold', null],
  [-2, 1, 'desert'], [0, 1, 'desert'],
  // South island.
  [-5, 1, 'ore', 8], [3, 1, 'ore', 2],
  [-5, 2, 'brick', 9], [-4, 2, 'wheat', 2], [1, 2, 'sheep', 11], [2, 2, 'ore', 4],
  [-5, 3, 'sheep', 10], [-4, 3, 'wood', 6], [-3, 3, 'ore', 5], [-2, 3, 'wood', 11],
  [-1, 3, 'wood', 8], [0, 3, 'wheat', 10], [1, 3, 'brick', 6],
  ...seaHexes([
    [-1, -2], [0, -2], [1, -2], [2, -2],
    [-3, -1], [-2, -1], [0, -1], [2, -1], [3, -1],
    // (-5, 0) and (4, 0) are the frame's west / east points: sea hexes on
    // the map, not in the component table's sea count. The pirate starts on
    // the east one.
    [-5, 0], [-4, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [3, 0], [4, 0],
    [-4, 1], [-3, 1], [-1, 1], [1, 1], [2, 1],
    [-3, 2], [-2, 2], [-1, 2], [0, 2],
  ]),
];

const VILLAGES_5_6P: ScenarioVillageDef[] = [
  { q: -1, r: -1, corner: 5, number: 2 },
  { q: -1, r: -1, corner: 2, number: 5 },
  { q: 1, r: -1, corner: 5, number: 10 },
  { q: 1, r: -1, corner: 2, number: 8 },
  { q: -3, r: 0, corner: 5, number: 4 },
  { q: -3, r: 0, corner: 2, number: 9 },
  { q: 2, r: 0, corner: 5, number: 4 },
  { q: 2, r: 0, corner: 2, number: 5 },
  { q: -2, r: 1, corner: 5, number: 6 },
  { q: -2, r: 1, corner: 2, number: 12 },
  { q: 0, r: 1, corner: 5, number: 9 },
  { q: 0, r: 1, corner: 2, number: 10 },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: fixedPositions(HEXES_5_6P),
  portAnchors: [
    { q: -2, r: -3, direction: 5 },
    { q: 1, r: -3, direction: 4 },
    { q: 3, r: -3, direction: 4 },
    { q: -3, r: -2, direction: 3 },
    { q: 4, r: -2, direction: 0 },
    { q: 3, r: 1, direction: 0 },
    { q: -5, r: 2, direction: 3 },
    { q: 2, r: 2, direction: 1 },
    { q: -4, r: 3, direction: 2 },
    { q: -3, r: 3, direction: 1 },
    { q: 0, r: 3, direction: 1 },
  ],
  pools: {
    terrainCounts: {},
    tokens: [],
    portTypes: [
      'wood', 'brick', 'sheep', 'wheat', 'ore', 'sheep',
      'generic', 'generic', 'generic', 'generic', 'generic',
    ],
  },
  robberStart: { q: -4, r: -1 },
  pirateStart: { q: 4, r: 0 },
};

export const clothForCatan = buildScenario({
  id: 'clothForCatan',
  name: 'Cloth for Catan',
  defaultIslandBonusVp: 0,
  defaultVpToWin: 14,
  minPlayers: 3,
  maxPlayers: 6,
  // "Your starting settlements ... may be placed on one of the large islands
  // or split across both large islands."
  startingPlacementZone: 'listedIslands',
  setupRounds: 3,
  // "Return the Longest Route tile to the box."
  noLongestRoad: true,
  extras3_4: {
    villages: VILLAGES_3_4P,
    startingIslandHexes: [{ q: -1, r: -3 }, { q: -4, r: 3 }],
  },
  extras5_6: {
    villages: VILLAGES_5_6P,
    startingIslandHexes: [{ q: -2, r: -3 }, { q: -5, r: 3 }],
  },
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

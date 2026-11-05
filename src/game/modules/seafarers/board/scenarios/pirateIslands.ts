import type { ScenarioLayout, ScenarioPirateIslandsDef } from '../types';
import { buildScenario } from './builder';
import { fixedPositions, seaHexes, type FixedHex } from './helpers';

// The Pirate Islands — Seafarers rulebook p.16-17 (3-4 players) and
// Seafarers 5-6 p.10. Fixed setup ("We do not recommend variations for this
// scenario"), transcribed hex by hex from the rulebook maps; terrain and
// number counts match the component tables exactly (5-6 map in
// docs/map-specs/SEAFARERS56-SPEC-B.md, pinned by fiveSix.b.test.ts).
//
// The main island is in the east. The pirate fleet sails a clockwise loop
// around the desert islets in the middle; each player sails one line of
// ships west to their beachhead and on to the pirate fortress in their
// color. Mechanics live in ../../pirateIslands.ts.
//
// Corners: 0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N. Edge directions: 0 E, 1 SE,
// 2 SW, 3 W, 4 NW, 5 NE.

// ---------------------------------------------------------------- 3-4p ---
const HEXES_3_4P: FixedHex[] = [
  // Western pirate islands.
  [-1, -3, 'gold', 11], [0, -3, 'ore', 6], [-2, -2, 'brick', null], [-3, -1, 'wheat', 4],
  [-2, 0, 'ore', 8],
  [-4, 1, 'wheat', 10], [-4, 2, 'brick', null], [-4, 3, 'gold', 3], [-3, 3, 'ore', 6],
  // Desert islets inside the fleet's loop.
  [1, -2, 'desert'], [0, -1, 'desert'], [-1, 1, 'desert'], [-1, 2, 'sheep', null],
  // Main (eastern) island.
  [3, -3, 'wheat', 4], [4, -3, 'brick', 5],
  [3, -2, 'ore', 9], [4, -2, 'wood', 10],
  [2, -1, 'wood', 3], [3, -1, 'sheep', 8], [4, -1, 'wood', 5],
  [1, 0, 'wheat', 6], [2, 0, 'brick', 9], [3, 0, 'sheep', 12],
  [1, 1, 'sheep', 11], [2, 1, 'wood', 8], [3, 1, 'sheep', 9],
  [1, 2, 'ore', 5], [2, 2, 'wood', 2],
  [0, 3, 'wheat', 10], [1, 3, 'brick', 4],
  ...seaHexes([
    [1, -3], [2, -3], [-1, -2], [0, -2], [2, -2], [-2, -1], [-1, -1], [1, -1],
    [-3, 0], [-1, 0], [0, 0], [-3, 1], [-2, 1], [0, 1], [-3, 2], [-2, 2], [0, 2],
    [-2, 3], [-1, 3],
  ]),
];

const PIRATES_3_4P: ScenarioPirateIslandsDef = {
  path: [
    { q: 1, r: -3 }, { q: 2, r: -3 }, { q: 2, r: -2 }, { q: 1, r: -1 }, { q: 0, r: 0 },
    { q: 0, r: 1 }, { q: 0, r: 2 }, { q: -1, r: 3 }, { q: -2, r: 3 }, { q: -2, r: 2 },
    { q: -2, r: 1 }, { q: -1, r: 0 }, { q: -1, r: -1 }, { q: 0, r: -2 },
  ],
  start: 7,
  slots: [
    {
      color: 'red',
      settlement: { q: 3, r: -3, corner: 2 },
      ship: { q: 3, r: -3, direction: 2 },
      fortress: { q: -1, r: -3, corner: 5 },
      beachhead: { q: 0, r: -3, corner: 0 },
    },
    {
      color: 'white',
      settlement: { q: 1, r: 0, corner: 5 },
      ship: { q: 1, r: 0, direction: 4 },
      fortress: { q: -2, r: -2, corner: 2 },
      beachhead: { q: -2, r: 0, corner: 5 },
    },
    {
      color: 'blue',
      settlement: { q: 1, r: 0, corner: 2 },
      ship: { q: 1, r: 0, direction: 2 },
      fortress: { q: -4, r: 2, corner: 5 },
      beachhead: { q: -2, r: 0, corner: 2 },
    },
    {
      color: 'orange',
      settlement: { q: 0, r: 3, corner: 5 },
      ship: { q: 0, r: 3, direction: 4 },
      fortress: { q: -4, r: 3, corner: 2 },
      beachhead: { q: -3, r: 3, corner: 1 },
    },
  ],
  // "In a 3-player game, do not use the white piece locations."
  slotsByPlayers: { 3: [0, 2, 3], 4: [0, 1, 2, 3] },
};

const LAYOUT_3_4P: ScenarioLayout = {
  positions: fixedPositions(HEXES_3_4P),
  portAnchors: [
    { q: 3, r: -3, direction: 4 },
    { q: 4, r: -3, direction: 4 },
    { q: 4, r: -3, direction: 0 },
    { q: 4, r: -2, direction: 0 },
    { q: 3, r: 0, direction: 0 },
    { q: 3, r: 1, direction: 1 },
    { q: 2, r: 2, direction: 1 },
    { q: 0, r: 3, direction: 1 },
  ],
  pools: {
    terrainCounts: {},
    tokens: [],
    portTypes: ['wood', 'brick', 'sheep', 'wheat', 'ore', 'generic', 'generic', 'generic'],
  },
  pirateStart: { q: -1, r: 3 },
};

// ---------------------------------------------------------------- 5-6p ---
const HEXES_5_6P: FixedHex[] = [
  // Western pirate islands.
  [-2, -3, 'gold', 3], [0, -3, 'ore', 6],
  [-4, -1, 'gold', 11], [-3, -1, 'desert'], [-2, -1, 'ore', 8],
  [-5, 1, 'gold', 11], [-4, 1, 'desert'], [-3, 1, 'ore', 6],
  [-5, 3, 'gold', 3], [-3, 3, 'ore', 8],
  // Desert islets inside the fleet's loop.
  [1, -2, 'desert'], [-1, 0, 'desert'], [-1, 2, 'desert'],
  // Main (eastern) island.
  [3, -3, 'sheep', 5], [4, -3, 'wheat', 4], [5, -3, 'brick', 9],
  [3, -2, 'ore', 3], [4, -2, 'brick', 10], [5, -2, 'wood', 11],
  [2, -1, 'wood', 12], [3, -1, 'wood', 6], [4, -1, 'sheep', 4], [5, -1, 'wood', 10],
  [1, 0, 'wheat', 6], [2, 0, 'wheat', 4], [3, 0, 'ore', 5], [4, 0, 'sheep', 8],
  [1, 1, 'sheep', 2], [2, 1, 'sheep', 10], [3, 1, 'brick', 3], [4, 1, 'sheep', 5],
  [1, 2, 'wheat', 11], [2, 2, 'ore', 9], [3, 2, 'brick', 8],
  [0, 3, 'wood', 9], [1, 3, 'wheat', 5], [2, 3, 'wood', 4],
  ...seaHexes([
    [-1, -3], [1, -3], [2, -3],
    [-3, -2], [-2, -2], [-1, -2], [0, -2], [2, -2],
    [-1, -1], [0, -1], [1, -1],
    // (-5, 0) "WEST" and (5, 0) "EAST" are the frame's points: sea hexes on
    // the map, not in the component table's sea count.
    [-5, 0], [-4, 0], [-3, 0], [-2, 0], [0, 0], [5, 0],
    [-2, 1], [-1, 1], [0, 1],
    [-5, 2], [-4, 2], [-3, 2], [-2, 2], [0, 2],
    [-4, 3], [-2, 3], [-1, 3],
  ]),
];

const PIRATES_5_6P: ScenarioPirateIslandsDef = {
  path: [
    { q: 1, r: -3 }, { q: 2, r: -3 }, { q: 2, r: -2 }, { q: 1, r: -1 }, { q: 0, r: 0 },
    { q: 0, r: 1 }, { q: 0, r: 2 }, { q: -1, r: 3 }, { q: -2, r: 3 }, { q: -2, r: 2 },
    { q: -2, r: 1 }, { q: -2, r: 0 }, { q: -1, r: -1 }, { q: 0, r: -2 },
  ],
  start: 8,
  // The "!" hex: while the pirate ship is here, skip the Pirate Attacks step.
  noAttackHex: { q: -2, r: 0 },
  slots: [
    {
      color: 'red',
      settlement: { q: 3, r: -3, corner: 4 },
      ship: { q: 2, r: -3, direction: 5 },
      fortress: { q: -2, r: -3, corner: 4 },
      beachhead: { q: 0, r: -3, corner: 0 },
    },
    {
      color: 'white',
      settlement: { q: 3, r: -3, corner: 2 },
      ship: { q: 2, r: -2, direction: 5 },
      fortress: { q: -2, r: -3, corner: 2 },
      beachhead: { q: 0, r: -3, corner: 2 },
    },
    {
      color: 'blue',
      settlement: { q: 1, r: 0, corner: 5 },
      ship: { q: 1, r: 0, direction: 4 },
      fortress: { q: -4, r: -1, corner: 1 },
      beachhead: { q: -2, r: -1, corner: 1 },
    },
    {
      color: 'orange',
      settlement: { q: 1, r: 0, corner: 2 },
      ship: { q: 1, r: 0, direction: 2 },
      fortress: { q: -5, r: 1, corner: 0 },
      beachhead: { q: -3, r: 1, corner: 0 },
    },
    {
      color: 'green',
      settlement: { q: 0, r: 3, corner: 5 },
      ship: { q: 0, r: 3, direction: 4 },
      fortress: { q: -5, r: 3, corner: 5 },
      beachhead: { q: -3, r: 3, corner: 5 },
    },
    {
      color: 'purple',
      settlement: { q: 0, r: 3, corner: 3 },
      ship: { q: -1, r: 3, direction: 1 },
      fortress: { q: -5, r: 3, corner: 3 },
      beachhead: { q: -3, r: 3, corner: 1 },
    },
  ],
  // "In a 5-player game, do not use the purple piece locations."
  slotsByPlayers: { 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] },
};

const LAYOUT_5_6P: ScenarioLayout = {
  positions: fixedPositions(HEXES_5_6P),
  portAnchors: [
    { q: 4, r: -3, direction: 4 },
    { q: 5, r: -3, direction: 4 },
    { q: 5, r: -3, direction: 0 },
    { q: 5, r: -2, direction: 0 },
    { q: 4, r: 0, direction: 0 },
    { q: 3, r: 2, direction: 0 },
    { q: 2, r: 3, direction: 0 },
    { q: 1, r: 3, direction: 2 },
    { q: 2, r: 3, direction: 2 },
  ],
  pools: {
    terrainCounts: {},
    tokens: [],
    portTypes: [
      'wood', 'brick', 'sheep', 'wheat', 'ore',
      'generic', 'generic', 'generic', 'generic',
    ],
  },
  pirateStart: { q: -2, r: 3 },
};

export const pirateIslands = buildScenario({
  id: 'pirateIslands',
  name: 'Pirate Islands',
  // No island bonus; the win needs your recaptured fortress AND 10 VP.
  defaultIslandBonusVp: 0,
  defaultVpToWin: 10,
  minPlayers: 3,
  maxPlayers: 6,
  noLongestRoad: true,
  noLargestArmy: true,
  extras3_4: { pirateIslands: PIRATES_3_4P },
  extras5_6: { pirateIslands: PIRATES_5_6P },
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

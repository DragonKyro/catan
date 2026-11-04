import type { ScenarioLayout, ScenarioTribeDef } from '../types';
import { buildScenario } from './builder';
import { fixedPositions, seaHexes, type FixedHex } from './helpers';

// The Forgotten Tribe — Seafarers rulebook p.12-13 (3-4 players) and
// Seafarers 5-6 p.8. Fixed setup transcribed from the rulebook maps
// (terrain and number counts match the component tables exactly).
//
// A large numbered island in the middle; the tribe's unnumbered islands
// above and below it. The tribe has put VP tokens, face-down development
// cards and ports on edges of its islands — a ship built or moved onto such
// an edge picks it up (../../tribe.ts). Settlements and the robber only go
// on numbered hexes, so the tribe's islands can't be settled.
//
// Corners: 0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N. Edge directions: 0 E, 1 SE,
// 2 SW, 3 W, 4 NW, 5 NE.

// ---------------------------------------------------------------- 3-4p ---
const HEXES_3_4P: FixedHex[] = [
  // Tribe islands, north.
  [-1, -3, 'gold', null], [0, -3, 'ore', null],
  [2, -3, 'desert'], [3, -3, 'ore', null], [4, -3, 'wheat', null],
  [4, -1, 'sheep', null], [3, 1, 'wood', null],
  // Tribe islands, south.
  [-4, 3, 'desert'], [-3, 3, 'brick', null],
  [-1, 3, 'brick', null], [0, 3, 'desert'], [1, 3, 'gold', null],
  // The large island.
  [-3, -1, 'wheat', 6], [-2, -1, 'wood', 9], [-1, -1, 'ore', 11], [0, -1, 'brick', 5],
  [1, -1, 'wood', 6], [2, -1, 'ore', 4],
  [-3, 0, 'sheep', 10], [-2, 0, 'brick', 8], [-1, 0, 'sheep', 4], [0, 0, 'wheat', 12],
  [1, 0, 'wood', 5], [2, 0, 'sheep', 2],
  [-4, 1, 'wood', 11], [-3, 1, 'wheat', 9], [-2, 1, 'ore', 3], [-1, 1, 'sheep', 8],
  [0, 1, 'brick', 10], [1, 1, 'wheat', 3],
  ...seaHexes([
    [1, -3],
    [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2], [4, -2],
    [3, -1], [3, 0], [2, 1],
    [-4, 2], [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
    [-2, 3],
  ]),
];

const TRIBE_3_4P: ScenarioTribeDef = {
  victoryPoints: [
    { q: -1, r: -3, direction: 5 },
    { q: 2, r: -3, direction: 5 },
    { q: 4, r: -3, direction: 5 },
    { q: 4, r: -1, direction: 0 },
    { q: 3, r: 1, direction: 0 },
    { q: -4, r: 3, direction: 1 },
    { q: -1, r: 3, direction: 2 },
    { q: 1, r: 3, direction: 1 },
  ],
  devCards: [
    { q: -1, r: -3, direction: 3 },
    { q: 4, r: -3, direction: 0 },
    { q: -4, r: 3, direction: 3 },
    { q: 1, r: 3, direction: 0 },
  ],
  // "Without looking at them, randomly place ports face up in the locations
  // shown on the map."
  ports: [
    { q: -1, r: -3, direction: 4 },
    { q: 2, r: -3, direction: 4 },
    { q: 4, r: -1, direction: 5 },
    { q: 3, r: 1, direction: 1 },
    { q: -4, r: 3, direction: 2 },
    { q: -1, r: 3, direction: 1 },
  ],
  portTypes: ['wood', 'brick', 'sheep', 'wheat', 'ore', 'generic'],
};

const LAYOUT_3_4P: ScenarioLayout = {
  positions: fixedPositions(HEXES_3_4P),
  // Every port starts with the tribe.
  portAnchors: [],
  pools: { terrainCounts: {}, tokens: [], portTypes: [] },
  robberStart: { q: 0, r: 3 },
  pirateStart: { q: 1, r: -3 },
};

// ---------------------------------------------------------------- 5-6p ---
const HEXES_5_6P: FixedHex[] = [
  // Tribe islands, north.
  [-2, -3, 'desert'], [-1, -3, 'desert'],
  [1, -3, 'gold', null], [2, -3, 'gold', null],
  [4, -3, 'sheep', null], [5, -3, 'sheep', null],
  // Tribe islands, south.
  [-5, 3, 'desert'], [-4, 3, 'desert'],
  [-2, 3, 'ore', null], [-1, 3, 'brick', null],
  [1, 3, 'wheat', null], [2, 3, 'gold', null],
  // The large island.
  [-4, -1, 'wheat', 3], [-3, -1, 'brick', 5], [-2, -1, 'ore', 11], [-1, -1, 'sheep', 8],
  [0, -1, 'brick', 4], [1, -1, 'wood', 10], [2, -1, 'wheat', 4], [3, -1, 'brick', 3],
  [4, -1, 'wood', 8], [5, -1, 'ore', 5],
  [-4, 0, 'wood', 11], [-3, 0, 'sheep', 12], [-2, 0, 'wood', 5], [-1, 0, 'wheat', 10],
  [0, 0, 'sheep', 5], [1, 0, 'brick', 9], [2, 0, 'wheat', 2], [3, 0, 'sheep', 9],
  [4, 0, 'brick', 10],
  [-5, 1, 'wood', 6], [-4, 1, 'ore', 4], [-3, 1, 'wheat', 9], [-2, 1, 'brick', 8],
  [-1, 1, 'wood', 11], [0, 1, 'ore', 3], [1, 1, 'sheep', 4], [2, 1, 'wheat', 6],
  [3, 1, 'wood', 3], [4, 1, 'ore', 6],
  ...seaHexes([
    [0, -3], [3, -3],
    [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2], [4, -2], [5, -2],
    [-5, 2], [-4, 2], [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2],
    [-3, 3], [0, 3],
  ]),
];

const TRIBE_5_6P: ScenarioTribeDef = {
  victoryPoints: [
    { q: -2, r: -3, direction: 4 },
    { q: -1, r: -3, direction: 4 },
    { q: 1, r: -3, direction: 5 },
    { q: 2, r: -3, direction: 4 },
    { q: 4, r: -3, direction: 4 },
    { q: -4, r: 3, direction: 2 },
    { q: -2, r: 3, direction: 1 },
    { q: -1, r: 3, direction: 2 },
    { q: 1, r: 3, direction: 1 },
    { q: 2, r: 3, direction: 1 },
  ],
  devCards: [
    { q: -2, r: -3, direction: 3 },
    { q: 2, r: -3, direction: 5 },
    { q: 5, r: -3, direction: 0 },
    { q: -5, r: 3, direction: 3 },
    { q: -2, r: 3, direction: 2 },
    { q: 2, r: 3, direction: 0 },
  ],
  // The 5-6 map prints the ports face up; the types below follow it.
  ports: [
    { q: -1, r: -3, direction: 5 },
    { q: 1, r: -3, direction: 4 },
    { q: 4, r: -3, direction: 5 },
    { q: 5, r: -3, direction: 5 },
    { q: -5, r: 3, direction: 2 },
    { q: -4, r: 3, direction: 1 },
    { q: -1, r: 3, direction: 1 },
    { q: 1, r: 3, direction: 2 },
  ],
  portTypes: ['wheat', 'generic', 'wood', 'generic', 'brick', 'sheep', 'ore', 'generic'],
  fixedPortTypes: true,
};

const LAYOUT_5_6P: ScenarioLayout = {
  positions: fixedPositions(HEXES_5_6P),
  portAnchors: [],
  pools: { terrainCounts: {}, tokens: [], portTypes: [] },
  robberStart: { q: -2, r: -3 },
  pirateStart: { q: -3, r: 3 },
};

export const forgottenTribe = buildScenario({
  id: 'forgottenTribe',
  name: 'The Forgotten Tribe',
  defaultIslandBonusVp: 0,
  defaultVpToWin: 13,
  minPlayers: 3,
  maxPlayers: 6,
  numberedHexesOnly: true,
  extras3_4: { tribe: TRIBE_3_4P },
  extras5_6: { tribe: TRIBE_5_6P },
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

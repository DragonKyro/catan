import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Fog Island — main island plus a foggy archipelago. Fog hexes start hidden
// (`fogHexes`); each one is revealed when a player builds adjacent to it and
// the revealing player gets one of the revealed resource (gold prompts the
// choose-resource flow, desert / sea reveal silently). Terrain + token
// behind the fog come from a SEPARATE `fogPools` so reveals stay random but
// don't leak through the main map's pool counts.
//
// Layout authored in the map builder; 14 land + 30 sea inside a radius-4
// disk, 8 ports, 12 fog hexes. No fixed terrain on the main island.

// ---------------------------------------------------------------------------
// 3-4 player layout from `fog islands.json`.
// ---------------------------------------------------------------------------
const FOG_COORDS_3_4P: { q: number; r: number }[] = [
  { q: -1, r: 4 },
  { q: 0, r: 4 },
  { q: 1, r: 3 },
  { q: 0, r: 3 },
  { q: 0, r: 2 },
  { q: 0, r: 1 },
  { q: 0, r: 0 },
  { q: 0, r: -1 },
  { q: -1, r: -1 },
  { q: -2, r: -1 },
  { q: -1, r: -2 },
  { q: 0, r: -2 },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // Land hexes — west cluster.
    { q: -3, r: 1, kind: 'land' },
    { q: -3, r: 2, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -3, r: 4, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -2, r: 3, kind: 'land' },
    // Land hexes — east cluster.
    { q: 2, r: -2, kind: 'land' },
    { q: 2, r: -1, kind: 'land' },
    { q: 2, r: 0, kind: 'land' },
    { q: 2, r: 1, kind: 'land' },
    { q: 3, r: -2, kind: 'land' },
    { q: 3, r: -1, kind: 'land' },
    { q: 3, r: 0, kind: 'land' },
    // Sea hexes (and fog cells which are listed as sea here — the generator
    // re-pins them from `fogPools` at game-start so they reveal as random
    // terrain).
    { q: -4, r: 1, kind: 'sea' },
    { q: -4, r: 2, kind: 'sea' },
    { q: -4, r: 3, kind: 'sea' },
    { q: -4, r: 4, kind: 'sea' },
    { q: -3, r: 0, kind: 'sea' },
    { q: -2, r: -1, kind: 'sea' },
    { q: -2, r: 0, kind: 'sea' },
    { q: -2, r: 4, kind: 'sea' },
    { q: -1, r: -2, kind: 'sea' },
    { q: -1, r: -1, kind: 'sea' },
    { q: -1, r: 0, kind: 'sea' },
    { q: -1, r: 1, kind: 'sea' },
    { q: -1, r: 2, kind: 'sea' },
    { q: -1, r: 3, kind: 'sea' },
    { q: -1, r: 4, kind: 'sea' },
    { q: 0, r: -2, kind: 'sea' },
    { q: 0, r: -1, kind: 'sea' },
    { q: 0, r: 0, kind: 'sea' },
    { q: 0, r: 1, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 0, r: 3, kind: 'sea' },
    { q: 0, r: 4, kind: 'sea' },
    { q: 1, r: -2, kind: 'sea' },
    { q: 1, r: -1, kind: 'sea' },
    { q: 1, r: 0, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: 1, r: 3, kind: 'sea' },
    { q: 2, r: 2, kind: 'sea' },
    { q: 3, r: 1, kind: 'sea' },
  ],
  // 8 ports. Direction mapping: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE.
  portAnchors: [
    { q: -3, r: 4, direction: 3 },
    { q: -3, r: 2, direction: 2 },
    { q: -3, r: 1, direction: 2 },
    { q: -2, r: 4, direction: 4 },
    { q: 3, r: 1, direction: 3 },
    { q: 3, r: 0, direction: 5 },
    { q: 3, r: -2, direction: 0 },
    { q: 2, r: -2, direction: 5 },
  ],
  pools: {
    // 14 main-island land hexes; no desert / gold (gold lives in the fog
    // pool). Resource mix matches `fog islands.json`.
    terrainCounts: {
      wood: 4,
      brick: 2,
      sheep: 4,
      wheat: 2,
      ore: 2,
    },
    // 14 tokens — symmetric around 7 with no 2 / 12 (those live in the
    // fog pool so the foggy archipelago lands the extreme rolls).
    tokens: [
      3,
      4, 4,
      5, 5,
      6, 6,
      8, 8,
      9, 9,
      10, 10,
      11,
    ],
    // 8 port types — 5 single-resource + 3 generic.
    portTypes: [
      'brick', 'wheat', 'wood', 'sheep', 'ore',
      'generic', 'generic', 'generic',
    ],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout from `fog islands 56.json`. 24 land + 34 sea + 18 fog
// inside a radius-6 disk. 11 ports. Fog tiles draw from a separate fog
// pool with desert/sea/gold mixed in.
// ---------------------------------------------------------------------------
const FOG_COORDS_5_6P: { q: number; r: number }[] = [
  { q: -3, r: 6 },
  { q: -2, r: 6 },
  { q: -3, r: 5 },
  { q: -2, r: 5 },
  { q: -1, r: 5 },
  { q: -3, r: 4 },
  { q: -2, r: 4 },
  { q: -1, r: 4 },
  { q: -2, r: 3 },
  { q: -1, r: 3 },
  { q: -2, r: 2 },
  { q: -1, r: 2 },
  { q: 0, r: 2 },
  { q: -2, r: 1 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: 0 },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    // Main-island land hexes (24).
    { q: -6, r: 4, kind: 'land' },
    { q: -6, r: 5, kind: 'land' },
    { q: -6, r: 6, kind: 'land' },
    { q: -5, r: 2, kind: 'land' },
    { q: -5, r: 3, kind: 'land' },
    { q: -5, r: 4, kind: 'land' },
    { q: -5, r: 5, kind: 'land' },
    { q: -5, r: 6, kind: 'land' },
    { q: -4, r: 1, kind: 'land' },
    { q: -4, r: 2, kind: 'land' },
    { q: -4, r: 3, kind: 'land' },
    { q: -3, r: 0, kind: 'land' },
    { q: 0, r: 6, kind: 'land' },
    { q: 1, r: 3, kind: 'land' },
    { q: 1, r: 4, kind: 'land' },
    { q: 1, r: 5, kind: 'land' },
    { q: 2, r: 0, kind: 'land' },
    { q: 2, r: 1, kind: 'land' },
    { q: 2, r: 2, kind: 'land' },
    { q: 2, r: 3, kind: 'land' },
    { q: 2, r: 4, kind: 'land' },
    { q: 3, r: 0, kind: 'land' },
    { q: 3, r: 1, kind: 'land' },
    { q: 3, r: 2, kind: 'land' },
    // Sea hexes (34) — fog cells are listed as sea here; the Seafarers
    // generator re-pins them from `fogPools5_6` at game-start.
    { q: -6, r: 3, kind: 'sea' },
    { q: -4, r: 4, kind: 'sea' },
    { q: -4, r: 5, kind: 'sea' },
    { q: -4, r: 6, kind: 'sea' },
    { q: -3, r: 1, kind: 'sea' },
    { q: -3, r: 2, kind: 'sea' },
    { q: -3, r: 3, kind: 'sea' },
    { q: -3, r: 4, kind: 'sea' },
    { q: -3, r: 5, kind: 'sea' },
    { q: -3, r: 6, kind: 'sea' },
    { q: -2, r: 0, kind: 'sea' },
    { q: -2, r: 1, kind: 'sea' },
    { q: -2, r: 2, kind: 'sea' },
    { q: -2, r: 3, kind: 'sea' },
    { q: -2, r: 4, kind: 'sea' },
    { q: -2, r: 5, kind: 'sea' },
    { q: -2, r: 6, kind: 'sea' },
    { q: -1, r: 0, kind: 'sea' },
    { q: -1, r: 1, kind: 'sea' },
    { q: -1, r: 2, kind: 'sea' },
    { q: -1, r: 3, kind: 'sea' },
    { q: -1, r: 4, kind: 'sea' },
    { q: -1, r: 5, kind: 'sea' },
    { q: -1, r: 6, kind: 'sea' },
    { q: 0, r: 0, kind: 'sea' },
    { q: 0, r: 1, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 0, r: 3, kind: 'sea' },
    { q: 0, r: 4, kind: 'sea' },
    { q: 0, r: 5, kind: 'sea' },
    { q: 1, r: 0, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: 3, r: 3, kind: 'sea' },
  ],
  portAnchors: [
    { q: -6, r: 5, direction: 3 },
    { q: -5, r: 3, direction: 3 },
    { q: -4, r: 1, direction: 4 },
    { q: -3, r: 2, direction: 3 },
    { q: -4, r: 5, direction: 2 },
    { q: 1, r: 5, direction: 3 },
    { q: 2, r: 4, direction: 1 },
    { q: 3, r: 3, direction: 2 },
    { q: 3, r: 2, direction: 5 },
    { q: 2, r: 1, direction: 2 },
    { q: 2, r: 0, direction: 5 },
  ],
  pools: {
    // 24 main-island land hexes; no desert / gold (those live in the fog
    // pool).
    terrainCounts: {
      wood: 5,
      brick: 5,
      sheep: 5,
      wheat: 5,
      ore: 4,
    },
    // 24 tokens — one per main-island land hex.
    tokens: [
      2,
      3, 3,
      4, 4, 4,
      5, 5, 5,
      6, 6, 6,
      8, 8, 8,
      9, 9, 9,
      10, 10, 10,
      11, 11,
      12,
    ],
    // 11 port types — 6 generic + 5 single-resource.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
      'brick', 'wheat', 'ore', 'sheep', 'wood',
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
  // Fog pool from `fog islands.json`. 12 fog tiles: 2 gold + 1 wood +
  // 1 sheep + 2 ore + 2 wheat + 2 brick + 2 sea = 12. 10 producing tiles
  // (12 - 2 sea) → 10 tokens.
  fogPools: {
    terrainCounts: {
      gold: 2,
      wood: 1,
      sheep: 1,
      ore: 2,
      wheat: 2,
      brick: 2,
      sea: 2,
    },
    tokens: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
  },
  // 5-6p fog pool from `fog islands 56.json`. 18 fog tiles: 2 wood + 2
  // sheep + 2 wheat + 1 desert + 3 sea + 2 brick + 3 ore + 3 gold = 18.
  // 14 producing tiles (18 − 1 desert − 3 sea) → 14 tokens.
  fogPools5_6: {
    terrainCounts: {
      wood: 2,
      sheep: 2,
      wheat: 2,
      desert: 1,
      sea: 3,
      brick: 2,
      ore: 3,
      gold: 3,
    },
    tokens: [2, 3, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 11, 12],
  },
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

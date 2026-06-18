import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Fog Island 2 — variant Fog Island layout authored in the map builder.
// 17 main-island land hexes + 12 fog tiles + 15 sea inside a radius-4 disk;
// 8 ports. Same fog reveal mechanic as Fog Island — fog tiles draw from a
// separate `fogPools` so reveals are random without leaking the main pool.

const FOG_COORDS_3_4P: { q: number; r: number }[] = [
  { q: 0, r: 1 },
  { q: 0, r: 2 },
  { q: 0, r: 3 },
  { q: -1, r: 1 },
  { q: -1, r: 2 },
  { q: -1, r: 3 },
  { q: 0, r: 4 },
  { q: -1, r: 4 },
  { q: -1, r: 0 },
  { q: -1, r: -1 },
  { q: -1, r: -2 },
  { q: -2, r: -1 },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // Main island — west cluster.
    { q: -4, r: 2, kind: 'land' },
    { q: -4, r: 3, kind: 'land' },
    { q: -4, r: 4, kind: 'land' },
    { q: -3, r: 1, kind: 'land' },
    { q: -3, r: 2, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -3, r: 4, kind: 'land' },
    // Main island — east cluster.
    { q: 1, r: -2, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    { q: 2, r: -2, kind: 'land' },
    { q: 2, r: -1, kind: 'land' },
    { q: 2, r: 0, kind: 'land' },
    { q: 2, r: 1, kind: 'land' },
    { q: 2, r: 2, kind: 'land' },
    { q: 3, r: -2, kind: 'land' },
    { q: 3, r: -1, kind: 'land' },
    { q: 3, r: 0, kind: 'land' },
    // Sea hexes (fog cells listed below as sea; the generator re-pins them
    // from `fogPools` at game-start).
    { q: -4, r: 1, kind: 'sea' },
    { q: -3, r: 0, kind: 'sea' },
    { q: -2, r: -1, kind: 'sea' },
    { q: -2, r: 0, kind: 'sea' },
    { q: -2, r: 1, kind: 'sea' },
    { q: -2, r: 2, kind: 'sea' },
    { q: -2, r: 3, kind: 'sea' },
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
    { q: 1, r: 0, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: 1, r: 3, kind: 'sea' },
    { q: 3, r: 1, kind: 'sea' },
  ],
  portAnchors: [
    { q: -4, r: 4, direction: 3 },
    { q: -4, r: 4, direction: 1 },
    { q: -4, r: 2, direction: 2 },
    { q: -3, r: 1, direction: 3 },
    { q: 1, r: -2, direction: 5 },
    { q: 3, r: -2, direction: 4 },
    { q: 3, r: 0, direction: 5 },
    { q: 3, r: 1, direction: 2 },
  ],
  pools: {
    // 17 main-island land hexes.
    terrainCounts: {
      wood: 4,
      brick: 3,
      sheep: 4,
      wheat: 3,
      ore: 3,
    },
    // 17 tokens — symmetric around 7 except for a single 12.
    tokens: [
      2,
      3, 3,
      4, 4,
      5, 5,
      6, 6,
      8, 8,
      9, 9,
      10, 10,
      11,
      12,
    ],
    // 8 port types — 5 single-resource (2:1) + 3 generic (3:1).
    portTypes: [
      'brick', 'wheat', 'ore', 'sheep', 'wood',
      'generic', 'generic', 'generic',
    ],
  },
};

export const fogIsland2 = buildScenario({
  id: 'fogIsland2',
  name: 'Fog Island 2',
  defaultIslandBonusVp: 3,
  defaultVpToWin: 10,
  minPlayers: 3,
  maxPlayers: 4,
  fogHexes: FOG_COORDS_3_4P,
  // Fog pool from `fog islands 2.json`. 12 fog tiles: 1 wood + 1 sheep
  // + 2 ore + 2 gold + 2 wheat + 2 brick + 2 sea = 12. 10 producing
  // tiles → 10 tokens.
  fogPools: {
    terrainCounts: {
      wood: 1,
      sheep: 1,
      ore: 2,
      gold: 2,
      wheat: 2,
      brick: 2,
      sea: 2,
    },
    tokens: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
  },
  layout3p: LAYOUT_3_4P,
});

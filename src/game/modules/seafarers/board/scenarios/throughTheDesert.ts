import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Through the Desert — main island split by a desert chain. With
// `desertIsBoundary: true` the chain acts like sea during island
// partitioning, so the far side counts as an outer island and earns a
// chip VP on first settlement.
//
// Layout authored in the map builder; 22 land + 14 sea inside a radius-4
// disk. 8 ports, 2 fixed gold tiles, 3 fixed deserts.

// ---------------------------------------------------------------------------
// 3-4 player layout from `through the desert.json`.
// ---------------------------------------------------------------------------
const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // Land hexes — west of the desert spine.
    { q: -4, r: 2, kind: 'land' },
    { q: -4, r: 3, kind: 'land' },
    { q: -4, r: 4, kind: 'land' },
    { q: -3, r: 0, kind: 'land' },
    { q: -3, r: 2, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -3, r: 4, kind: 'land' },
    { q: -2, r: -1, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -2, r: 3, kind: 'land' },
    { q: -1, r: 0, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: -1, r: 2, kind: 'land' },
    { q: -1, r: 4, kind: 'land' },
    { q: 0, r: -1, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 0, r: 3, kind: 'land' },
    // East of the spine.
    { q: 2, r: -2, kind: 'land' },
    { q: 2, r: -1, kind: 'land' },
    // Fixed gold tiles (one per side of the desert).
    { q: -1, r: -2, kind: 'land', fixedTerrain: 'gold' },
    { q: 1, r: 1, kind: 'land', fixedTerrain: 'gold' },
    // Desert spine.
    { q: -2, r: 0, kind: 'desert' },
    { q: -1, r: -1, kind: 'desert' },
    { q: 0, r: -2, kind: 'desert' },
    // Sea hexes.
    { q: -4, r: 1, kind: 'sea' },
    { q: -3, r: 1, kind: 'sea' },
    { q: -2, r: 4, kind: 'sea' },
    { q: -1, r: 3, kind: 'sea' },
    { q: 0, r: 1, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 1, r: -2, kind: 'sea' },
    { q: 1, r: -1, kind: 'sea' },
    { q: 1, r: 0, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: 2, r: 0, kind: 'sea' },
    { q: 2, r: 1, kind: 'sea' },
  ],
  portAnchors: [
    { q: -4, r: 4, direction: 3 },
    { q: -4, r: 4, direction: 1 },
    { q: -3, r: 2, direction: 4 },
    { q: -4, r: 2, direction: 2 },
    { q: -2, r: 4, direction: 3 },
    { q: -1, r: 3, direction: 4 },
    { q: 0, r: 1, direction: 2 },
    { q: 1, r: -2, direction: 2 },
  ],
  pools: {
    // 20 non-desert non-gold land hexes (2 gold are fixed positions, 3
    // deserts are fixed).
    terrainCounts: {
      wood: 5,
      brick: 3,
      sheep: 4,
      wheat: 4,
      ore: 4,
    },
    // 22 tokens — one per producing land hex (20 pool-drawn + 2 fixed gold).
    tokens: [
      2,
      3, 3,
      4, 4,
      5, 5, 5,
      6, 6, 6,
      8, 8, 8,
      9, 9, 9,
      10, 10,
      11, 11,
      12,
    ],
    // 8 port types — 5 single-resource (2:1) + 3 generic (3:1).
    portTypes: [
      'brick', 'wheat', 'sheep', 'ore', 'wood',
      'generic', 'generic', 'generic',
    ],
  },
};

// ---------------------------------------------------------------------------
// 5-6 player layout from `through the desert 56.json`. 43 land (35 pool +
// 3 fixed gold + 5 fixed desert) + 22 sea inside a radius-6 disk; 11 ports.
// ---------------------------------------------------------------------------
const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    // Land hexes (35 pool-drawn).
    { q: -6, r: 1, kind: 'land' },
    { q: -6, r: 2, kind: 'land' },
    { q: -6, r: 3, kind: 'land' },
    { q: -5, r: 0, kind: 'land' },
    { q: -5, r: 1, kind: 'land' },
    { q: -5, r: 2, kind: 'land' },
    { q: -4, r: -2, kind: 'land' },
    { q: -4, r: 0, kind: 'land' },
    { q: -4, r: 1, kind: 'land' },
    { q: -4, r: 3, kind: 'land' },
    { q: -3, r: -2, kind: 'land' },
    { q: -3, r: 0, kind: 'land' },
    { q: -3, r: 1, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -2, r: -3, kind: 'land' },
    { q: -2, r: -1, kind: 'land' },
    { q: -2, r: 0, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -1, r: -3, kind: 'land' },
    { q: -1, r: -1, kind: 'land' },
    { q: -1, r: 0, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: 0, r: -1, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 0, r: 1, kind: 'land' },
    { q: 1, r: -3, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    { q: 1, r: 0, kind: 'land' },
    { q: 1, r: 2, kind: 'land' },
    { q: 1, r: 3, kind: 'land' },
    { q: 2, r: -3, kind: 'land' },
    { q: 2, r: 2, kind: 'land' },
    { q: 3, r: -3, kind: 'land' },
    { q: 3, r: 1, kind: 'land' },
    { q: 4, r: -3, kind: 'land' },
    // 3 fixed gold tiles (one per side of the desert spine).
    { q: -3, r: -3, kind: 'land', fixedTerrain: 'gold' },
    { q: -1, r: 3, kind: 'land', fixedTerrain: 'gold' },
    { q: 4, r: -1, kind: 'land', fixedTerrain: 'gold' },
    // Desert spine (5 fixed deserts bisecting the board).
    { q: -2, r: -2, kind: 'desert' },
    { q: -1, r: -2, kind: 'desert' },
    { q: 0, r: -2, kind: 'desert' },
    { q: 1, r: -2, kind: 'desert' },
    { q: 2, r: -2, kind: 'desert' },
    // Sea hexes (22).
    { q: -6, r: 0, kind: 'sea' },
    { q: -5, r: -1, kind: 'sea' },
    { q: -5, r: 3, kind: 'sea' },
    { q: -4, r: -1, kind: 'sea' },
    { q: -4, r: 2, kind: 'sea' },
    { q: -3, r: -1, kind: 'sea' },
    { q: -3, r: 2, kind: 'sea' },
    { q: -2, r: 2, kind: 'sea' },
    { q: -2, r: 3, kind: 'sea' },
    { q: -1, r: 2, kind: 'sea' },
    { q: 0, r: -3, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 0, r: 3, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 2, r: -1, kind: 'sea' },
    { q: 2, r: 0, kind: 'sea' },
    { q: 2, r: 1, kind: 'sea' },
    { q: 3, r: -2, kind: 'sea' },
    { q: 3, r: -1, kind: 'sea' },
    { q: 3, r: 0, kind: 'sea' },
    { q: 4, r: -2, kind: 'sea' },
    { q: 4, r: 0, kind: 'sea' },
  ],
  portAnchors: [
    { q: -5, r: 3, direction: 4 },
    { q: -6, r: 3, direction: 2 },
    { q: -6, r: 2, direction: 3 },
    { q: -6, r: 1, direction: 4 },
    { q: -5, r: 0, direction: 4 },
    { q: -3, r: 0, direction: 4 },
    { q: -4, r: 2, direction: 4 },
    { q: -2, r: 1, direction: 2 },
    { q: 0, r: 1, direction: 2 },
    { q: 1, r: 1, direction: 4 },
    { q: 2, r: -1, direction: 3 },
  ],
  pools: {
    // 35 pool-drawn land hexes (3 gold + 5 desert are fixed positions).
    terrainCounts: {
      wood: 7,
      brick: 7,
      sheep: 7,
      wheat: 7,
      ore: 7,
    },
    // 38 tokens — one per producing land hex (35 pool-drawn + 3 fixed gold).
    tokens: [
      2, 2,
      3, 3, 3, 3,
      4, 4, 4, 4,
      5, 5, 5, 5,
      6, 6, 6, 6, 6,
      8, 8, 8, 8, 8,
      9, 9, 9, 9,
      10, 10, 10, 10,
      11, 11, 11, 11,
      12, 12,
    ],
    // 11 port types — 5 single-resource + 6 generic.
    portTypes: [
      'brick', 'wheat', 'ore', 'sheep', 'wood',
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
    ],
  },
};

export const throughTheDesert = buildScenario({
  id: 'throughTheDesert',
  name: 'Through the Desert',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 10,
  defaultVpToWin5_6: 15,
  minPlayers: 3,
  maxPlayers: 6,
  desertIsBoundary: true,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

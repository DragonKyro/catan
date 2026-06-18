import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Four Islands 2 — alternate Four Islands layout authored in the map builder.
// 23 land + 14 sea hexes inside a radius-3 disk, 9 ports, no fixed terrain.
// Same starting rule as Four Islands: any-island starts are allowed and
// every cluster the player doesn't start on awards an outer-island chip.

// ---------------------------------------------------------------------------
// 3-4 player layout from `four islands 2.json`.
// ---------------------------------------------------------------------------
const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // Land hexes (23).
    { q: -3, r: 1, kind: 'land' },
    { q: -3, r: 2, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -2, r: -1, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -2, r: 3, kind: 'land' },
    { q: -1, r: -2, kind: 'land' },
    { q: -1, r: -1, kind: 'land' },
    { q: -1, r: 2, kind: 'land' },
    { q: 0, r: -3, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 0, r: 3, kind: 'land' },
    { q: 1, r: -2, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    { q: 1, r: 1, kind: 'land' },
    { q: 1, r: 2, kind: 'land' },
    { q: 2, r: -3, kind: 'land' },
    { q: 2, r: -2, kind: 'land' },
    { q: 2, r: -1, kind: 'land' },
    { q: 2, r: 1, kind: 'land' },
    { q: 3, r: -3, kind: 'land' },
    { q: 3, r: -2, kind: 'land' },
    // Sea hexes (14).
    { q: -3, r: 0, kind: 'sea' },
    { q: -2, r: 0, kind: 'sea' },
    { q: -1, r: 0, kind: 'sea' },
    { q: -1, r: 1, kind: 'sea' },
    { q: -1, r: 3, kind: 'sea' },
    { q: 0, r: -2, kind: 'sea' },
    { q: 0, r: -1, kind: 'sea' },
    { q: 0, r: 1, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 1, r: -3, kind: 'sea' },
    { q: 1, r: 0, kind: 'sea' },
    { q: 2, r: 0, kind: 'sea' },
    { q: 3, r: -1, kind: 'sea' },
    { q: 3, r: 0, kind: 'sea' },
  ],
  // 9 port anchors. Some sit on sea hexes — the engine resolves the edge
  // from either side. Direction mapping: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE.
  portAnchors: [
    { q: -3, r: 3, direction: 3 },
    { q: -3, r: 1, direction: 2 },
    { q: -1, r: -2, direction: 3 },
    { q: -2, r: 0, direction: 4 },
    { q: 0, r: 0, direction: 4 },
    { q: -1, r: 1, direction: 2 },
    { q: 3, r: -1, direction: 4 },
    { q: 2, r: 1, direction: 4 },
    { q: 2, r: 1, direction: 1 },
  ],
  pools: {
    // 23 land hexes, no desert/gold.
    terrainCounts: {
      wood: 5,
      brick: 4,
      sheep: 5,
      wheat: 5,
      ore: 4,
    },
    // 23 tokens — symmetric around 7 except for a single 12.
    tokens: [
      2,
      3, 3,
      4, 4, 4,
      5, 5, 5,
      6, 6, 6,
      8, 8, 8,
      9, 9, 9,
      10, 10,
      11, 11,
      12,
    ],
    // 9 port types — 5 single-resource (2:1) + 4 generic (3:1).
    portTypes: [
      'wheat', 'wood', 'sheep', 'ore', 'brick',
      'generic', 'generic', 'generic', 'generic',
    ],
  },
};

export const fourIslands2 = buildScenario({
  id: 'fourIslands2',
  name: 'Four Islands 2',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 10,
  minPlayers: 3,
  maxPlayers: 4,
  startingPlacementZone: 'anyIsland',
  layout3p: LAYOUT_3_4P,
});

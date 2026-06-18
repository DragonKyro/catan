import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Four Islands — four small clusters with no main island. Per the rulebook,
// starting settlements are allowed on any cluster (`startingPlacementZone:
// 'anyIsland'`), and every cluster except the one you start on counts as an
// outer island (chip VP on first settlement).
//
// Layout authored in the map builder; 20 land + 17 sea = 37 hexes inside a
// radius-4 disk. 9 ports (5×2:1 + 4×3:1), 0 desert + 0 gold (rulebook).

// ---------------------------------------------------------------------------
// 3-4 player layout from `four islands.json`.
// ---------------------------------------------------------------------------
const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // Land hexes (20).
    { q: -3, r: 2, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -1, r: 3, kind: 'land' },
    { q: 0, r: 2, kind: 'land' },
    { q: 0, r: 3, kind: 'land' },
    { q: 1, r: 2, kind: 'land' },
    { q: -4, r: 2, kind: 'land' },
    { q: -4, r: 3, kind: 'land' },
    { q: -4, r: 4, kind: 'land' },
    { q: -3, r: 0, kind: 'land' },
    { q: -2, r: -1, kind: 'land' },
    { q: -1, r: -1, kind: 'land' },
    { q: -2, r: 0, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    { q: 1, r: -2, kind: 'land' },
    { q: 2, r: -2, kind: 'land' },
    { q: 2, r: -1, kind: 'land' },
    { q: 1, r: 0, kind: 'land' },
    // Sea hexes (17).
    { q: -3, r: 1, kind: 'sea' },
    { q: -2, r: 1, kind: 'sea' },
    { q: -2, r: 3, kind: 'sea' },
    { q: -1, r: 1, kind: 'sea' },
    { q: -1, r: 2, kind: 'sea' },
    { q: 0, r: 1, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: -4, r: 1, kind: 'sea' },
    { q: -3, r: 4, kind: 'sea' },
    { q: -2, r: 4, kind: 'sea' },
    { q: -1, r: 4, kind: 'sea' },
    { q: -1, r: 0, kind: 'sea' },
    { q: 0, r: -1, kind: 'sea' },
    { q: 0, r: -2, kind: 'sea' },
    { q: -1, r: -2, kind: 'sea' },
    { q: 2, r: 0, kind: 'sea' },
    { q: 2, r: 1, kind: 'sea' },
  ],
  // 9 port anchors. Some sit on sea hexes — the engine accepts either side
  // of a coastal edge and the renderer pushes the marker out into the water.
  // Direction mapping: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE.
  portAnchors: [
    { q: -4, r: 2, direction: 2 },
    { q: -3, r: 4, direction: 4 },
    { q: -4, r: 2, direction: 5 },
    { q: -1, r: 3, direction: 4 },
    { q: 1, r: 2, direction: 1 },
    { q: 1, r: 0, direction: 2 },
    { q: 2, r: -1, direction: 5 },
    { q: -1, r: 0, direction: 4 },
    { q: -3, r: 0, direction: 4 },
  ],
  pools: {
    // 20 land hexes, 4 of each resource — no gold, no desert.
    terrainCounts: {
      wood: 4,
      brick: 4,
      sheep: 4,
      wheat: 4,
      ore: 4,
    },
    // 20 tokens — symmetric around 7. 2/12: 1, 3/11: 2, 4/10: 2, 5/9: 2, 6/8: 3.
    tokens: [
      2,
      3, 3,
      4, 4,
      5, 5,
      6, 6, 6,
      8, 8, 8,
      9, 9,
      10, 10,
      11, 11,
      12,
    ],
    // 9 port types — 5 single-resource (2:1) + 4 generic (3:1).
    portTypes: [
      'wheat', 'brick', 'sheep', 'wood', 'ore',
      'generic', 'generic', 'generic', 'generic',
    ],
  },
};

// 5-6 player variant — "Six Islands" geometry authored in the map builder.
// 32 land + 26 sea hexes inside a radius-6 disk, 11 ports, no fixed
// terrain. Same any-island starting rule as the 3-4p Four Islands map.
const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    // Land hexes (32).
    { q: -6, r: 5, kind: 'land' },
    { q: -6, r: 6, kind: 'land' },
    { q: -5, r: 2, kind: 'land' },
    { q: -5, r: 4, kind: 'land' },
    { q: -5, r: 5, kind: 'land' },
    { q: -5, r: 6, kind: 'land' },
    { q: -4, r: 1, kind: 'land' },
    { q: -4, r: 2, kind: 'land' },
    { q: -3, r: 0, kind: 'land' },
    { q: -3, r: 1, kind: 'land' },
    { q: -3, r: 5, kind: 'land' },
    { q: -3, r: 6, kind: 'land' },
    { q: -2, r: 0, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -2, r: 4, kind: 'land' },
    { q: -2, r: 5, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: -1, r: 2, kind: 'land' },
    { q: -1, r: 4, kind: 'land' },
    { q: -1, r: 6, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 0, r: 1, kind: 'land' },
    { q: 0, r: 5, kind: 'land' },
    { q: 0, r: 6, kind: 'land' },
    { q: 1, r: 4, kind: 'land' },
    { q: 1, r: 5, kind: 'land' },
    { q: 2, r: 0, kind: 'land' },
    { q: 2, r: 1, kind: 'land' },
    { q: 2, r: 2, kind: 'land' },
    { q: 2, r: 4, kind: 'land' },
    { q: 3, r: 0, kind: 'land' },
    { q: 3, r: 1, kind: 'land' },
    // Sea hexes (26).
    { q: -6, r: 3, kind: 'sea' },
    { q: -6, r: 4, kind: 'sea' },
    { q: -5, r: 3, kind: 'sea' },
    { q: -4, r: 3, kind: 'sea' },
    { q: -4, r: 4, kind: 'sea' },
    { q: -4, r: 5, kind: 'sea' },
    { q: -4, r: 6, kind: 'sea' },
    { q: -3, r: 2, kind: 'sea' },
    { q: -3, r: 3, kind: 'sea' },
    { q: -3, r: 4, kind: 'sea' },
    { q: -2, r: 1, kind: 'sea' },
    { q: -2, r: 3, kind: 'sea' },
    { q: -2, r: 6, kind: 'sea' },
    { q: -1, r: 0, kind: 'sea' },
    { q: -1, r: 3, kind: 'sea' },
    { q: -1, r: 5, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 0, r: 3, kind: 'sea' },
    { q: 0, r: 4, kind: 'sea' },
    { q: 1, r: 0, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: 1, r: 3, kind: 'sea' },
    { q: 2, r: 3, kind: 'sea' },
    { q: 3, r: 2, kind: 'sea' },
    { q: 3, r: 3, kind: 'sea' },
  ],
  // 11 port anchors. Direction mapping: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE.
  portAnchors: [
    { q: -4, r: 2, direction: 2 },
    { q: -3, r: 2, direction: 4 },
    { q: -2, r: 0, direction: 4 },
    { q: 0, r: 0, direction: 5 },
    { q: 2, r: 1, direction: 2 },
    { q: 3, r: 0, direction: 5 },
    { q: 1, r: 5, direction: 0 },
    { q: -1, r: 6, direction: 2 },
    { q: -3, r: 5, direction: 2 },
    { q: -4, r: 5, direction: 2 },
    { q: -6, r: 5, direction: 3 },
  ],
  pools: {
    // 32 land hexes — no gold, no desert.
    terrainCounts: {
      wood: 7,
      brick: 6,
      sheep: 7,
      wheat: 6,
      ore: 6,
    },
    // 32 tokens — symmetric around 7 except for a single 12.
    tokens: [
      2,
      3, 3, 3,
      4, 4, 4, 4,
      5, 5, 5, 5,
      6, 6, 6, 6,
      8, 8, 8, 8,
      9, 9, 9, 9,
      10, 10, 10, 10,
      11, 11, 11,
      12,
    ],
    // 11 generic ports.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
      'generic', 'generic', 'generic', 'generic', 'generic',
    ],
  },
};

export const fourIslands = buildScenario({
  id: 'fourIslands',
  name: 'Four Islands',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 12,
  defaultVpToWin5_6: 13,
  minPlayers: 3,
  maxPlayers: 6,
  startingPlacementZone: 'anyIsland',
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

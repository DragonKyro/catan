import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';
import { type MapRow, parseRows, seafarers56PortTypes } from './frame5_6';

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

// ---------------------------------------------------------------------------
// 5-6 players: The Six Islands (Seafarers 5-6 rulebook p. 5;
// docs/map-specs/SEAFARERS56-SPEC-A.md). Fixed setup: every hex and disc is
// printed. "Place the robber on the pasture hex with the number 12 disc and
// the pirate on the indicated location. Randomly place ports in the
// indicated locations." Same any-island start as The Four Islands. The
// frame's two middle-row points are sea hexes too (the table's 24 sea
// leaves them out); the pirate starts on the west one.
// ---------------------------------------------------------------------------
const ROWS_5_6P: MapRow[] = [
  [-3, -2, 'P12 O4   ~ F6 ~   O9 P6'],
  [-2, -3, 'F8 O10   ~ O11 B10   ~ W3 B10'],
  [-1, -4, 'B11 W9   ~ P3 F4   ~ ~ F4 ~'],
  [0, -5, '~ ~ ~ ~ ~ ~ ~ ~ ~ ~'],
  [1, -5, '~ B4   ~ ~ P8 F10   ~ F5 W6'],
  [2, -5, 'F9 W12   ~ W5 O3   ~ B8 P9'],
  [3, -5, 'P5 O6   ~ P2 ~   B5 W2'],
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: parseRows(ROWS_5_6P).positions,
  // 11 harbors; types drawn at random. Direction: 0 E, 1 SE, 2 SW, 3 W,
  // 4 NW, 5 NE.
  portAnchors: [
    { q: -1, r: -3, direction: 4 },
    { q: 1, r: -3, direction: 5 },
    { q: 4, r: -3, direction: 5 },
    { q: -2, r: -2, direction: 1 },
    { q: -3, r: -1, direction: 2 },
    { q: 3, r: -2, direction: 2 },
    { q: -5, r: 2, direction: 3 },
    { q: -4, r: 3, direction: 5 },
    { q: -2, r: 2, direction: 2 },
    { q: 2, r: 2, direction: 0 },
    { q: 0, r: 3, direction: 2 },
  ],
  robberStart: { q: -2, r: -3 },
  pirateStart: { q: -5, r: 0 },
  pools: {
    // Every hex and disc is printed: hills 6, forest 7, pasture 7, fields 6,
    // mountains 6; discs 2,2 3,3,3 4×4 5×4 6×4 8×3 9×4 10×4 11,11 12,12.
    terrainCounts: {},
    tokens: [],
    portTypes: seafarers56PortTypes(),
  },
};

export const fourIslands = buildScenario({
  id: 'fourIslands',
  name: 'Four Islands',
  defaultIslandBonusVp: 2,
  // Rulebook: 13 VP (3-4p and The Six Islands at 5-6p).
  defaultVpToWin: 13,
  minPlayers: 3,
  maxPlayers: 6,
  // Start on one or two islands — your home islands; every other island,
  // the largest included, pays you its bonus.
  startingPlacementZone: 'anyIsland',
  bonusOnEveryIsland: true,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

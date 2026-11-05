import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';
import { type MapRow, parseRows, seafarers56PortTypes } from './frame5_6';

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
// 5-6 players (Seafarers 5-6 rulebook p. 7; docs/map-specs/SEAFARERS56-SPEC-A.md).
// "Set up the board as shown. Place the robber on any of the desert hexes
// and the pirate on the indicated location. Randomly place ports in the
// indicated locations." Every hex and disc is printed. The five-desert
// strip cuts the north-west and north-east areas off the main island (the
// map outlines both as small islands; `desertIsBoundary` does the same
// here). The frame's two middle-row points are sea hexes too (the table's
// 20 sea leaves them out).
// ---------------------------------------------------------------------------
const ROWS_5_6P: MapRow[] = [
  [-3, -2, 'G4 O6 B11   ~   F12 W5 O3 B6'],
  [-2, -3, 'F5 P2   D D D D D   ~ ~'],
  [-1, -4, '~ ~ ~   W2 F8 P9 F10   ~ ~ G10'],
  [0, -5, '~ O4 F5 W10 B5 P10 F4 B8   ~ ~ ~'],
  [1, -5, 'P12 W3 B12 O6 B11 O3 W9   ~ ~ O8'],
  [2, -5, 'B9 O11   ~ ~ ~ ~ ~   P11 F3'],
  [3, -5, 'P6 ~ P8 W2 ~ G4 ~ W9'],
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: parseRows(ROWS_5_6P).positions,
  // 11 harbors, all on the main island; types drawn at random.
  // Direction: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE.
  portAnchors: [
    { q: -4, r: 0, direction: 4 },
    { q: -2, r: 0, direction: 4 },
    { q: 2, r: -1, direction: 0 },
    { q: -5, r: 1, direction: 4 },
    { q: 2, r: 0, direction: 1 },
    { q: -3, r: 1, direction: 1 },
    { q: -1, r: 1, direction: 2 },
    { q: 1, r: 1, direction: 2 },
    { q: -5, r: 2, direction: 3 },
    { q: -4, r: 2, direction: 1 },
    { q: -5, r: 3, direction: 2 },
  ],
  // "Any of the desert hexes": the middle one.
  robberStart: { q: 1, r: -2 },
  pirateStart: { q: 1, r: 3 },
  pools: {
    // Everything is printed: gold 3, each resource 7, desert 5; discs
    // 2×3, 3-11 ×4, 12×3.
    terrainCounts: {},
    tokens: [],
    portTypes: seafarers56PortTypes(),
  },
};

export const throughTheDesert = buildScenario({
  id: 'throughTheDesert',
  name: 'Through the Desert',
  defaultIslandBonusVp: 2,
  // Rulebook: 14 VP at 3-4 and 5-6 players.
  defaultVpToWin: 14,
  minPlayers: 3,
  maxPlayers: 6,
  desertIsBoundary: true,
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

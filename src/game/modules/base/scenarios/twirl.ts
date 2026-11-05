import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsAround, seaPositionsInDisk } from './helpers';
import { standardLand5_6 } from './standardShape';

// Twirl — colonist-style spiral. 21-hex shape: a standard 19-hex hexagon
// with a two-hex "tail" extending off the upper-right corner. Visually it
// reads as a twist; mechanically just a slightly larger board.

const LAND: ScenarioPosition[] = [
  // Standard 19-hex hexagon
  { q: 0, r: -2, kind: 'land' },
  { q: 1, r: -2, kind: 'land' },
  { q: 2, r: -2, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: 0, r: 0, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: 0, r: 2, kind: 'land' },
  // Spiral tail (two hexes extending past the upper-right corner)
  { q: 3, r: -3, kind: 'land' },
  { q: 3, r: -2, kind: 'land' },
];

const LAYOUT_3_4: ScenarioLayout = {
  positions: [...LAND, ...seaPositionsInDisk(LAND, 4)],
  portAnchors: [
    { q: 0, r: -2, direction: 5 },
    { q: 3, r: -3, direction: 4 },
    { q: 3, r: -2, direction: 0 },
    { q: 2, r: 0, direction: 1 },
    { q: 1, r: 1, direction: 1 },
    { q: -1, r: 2, direction: 2 },
    { q: -2, r: 2, direction: 3 },
    { q: -2, r: 0, direction: 3 },
    { q: -1, r: -1, direction: 4 },
  ],
  pools: {
    // 21 land hexes: 20 producing + 1 desert.
    terrainCounts: {
      wood: 4,
      brick: 4,
      sheep: 4,
      wheat: 4,
      ore: 4,
      desert: 1,
    },
    // 20 tokens — standard 18 + an extra 4 and 10 so the bigger board still
    // averages roughly the same per-hex production rate.
    tokens: [
      2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 10, 11, 11, 12,
    ],
    portTypes: [
      'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

// 5-6: the 30-hex board with the same two-hex tail twisting off its
// top-right corner hex (2, -3) — one hex to its NE, one to its E, as on the
// 3-4 map — and a second tail turned 180° off the bottom-left corner
// (-3, 3), so the island spins like a two-armed spiral and stays point
// symmetric. 34 land hexes.
const TAILS_5_6: ScenarioPosition[] = [
  { q: 3, r: -4, kind: 'land' },
  { q: 3, r: -3, kind: 'land' },
  { q: -4, r: 4, kind: 'land' },
  { q: -4, r: 3, kind: 'land' },
];

const LAND_5_6: ScenarioPosition[] = [...standardLand5_6(), ...TAILS_5_6];

const LAYOUT_5_6: ScenarioLayout = {
  // The tail tips reach radius 4: the sea follows the coast.
  positions: [...LAND_5_6, ...seaPositionsAround(LAND_5_6)],
  // 12 harbors (a bigger coast than the 30-hex board's 11), point symmetric
  // like the island: one on each tail tip.
  portAnchors: [
    { q: -3, r: 0, direction: 3 },
    { q: -2, r: -1, direction: 4 },
    { q: 0, r: -3, direction: 4 },
    { q: 1, r: -3, direction: 5 },
    { q: 3, r: -4, direction: 5 },
    { q: 2, r: -1, direction: 5 },
    { q: 2, r: 0, direction: 0 },
    { q: 1, r: 1, direction: 1 },
    { q: -1, r: 3, direction: 1 },
    { q: -2, r: 3, direction: 2 },
    { q: -4, r: 4, direction: 2 },
    { q: -3, r: 1, direction: 2 },
  ],
  pools: {
    // 34 land hexes: 32 producing + the 5-6 board's 2 deserts. The 5-6 mix
    // plus a brick and an ore (as the 3-4 map adds) and a wood and a wheat.
    terrainCounts: {
      wood: 7,
      brick: 6,
      sheep: 6,
      wheat: 7,
      ore: 6,
      desert: 2,
    },
    // 32 tokens — the 5-6 set of 28 plus a 4, 5, 9 and 10, so the bigger
    // board keeps about the same production per hex (the 3-4 map adds a 4
    // and a 10).
    tokens: [
      2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 12, 12,
    ],
    // The 5-6 harbors (the base game's 9 plus a 3:1 and a 2:1 wool) and
    // one more 3:1.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const twirl: BaseScenario = {
  id: 'twirl',
  name: 'Twirl',
  description:
    'A spiral — the standard hexagon with a two-hex tail twisting off one corner (the 5-6 board gets a tail at each end). Slightly more room than standard.',
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
};

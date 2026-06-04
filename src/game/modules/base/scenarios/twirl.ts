import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';

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

export const twirl: BaseScenario = {
  id: 'twirl',
  name: 'Twirl',
  description:
    'A 21-hex spiral — the standard hexagon with a two-hex tail twisting off one corner. Slightly more room than standard.',
  minPlayers: 3,
  maxPlayers: 4,
  layout3p: LAYOUT_3_4,
};

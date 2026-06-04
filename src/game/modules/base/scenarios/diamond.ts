import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';

// Diamond — colonist-style rhombus board. 16 land hexes in a 1-2-3-4-3-2-1
// row arrangement, oriented along the q-r diagonal. Pure shape variant; no
// special mechanic. Slightly smaller than standard, so the VP target stays
// at 10 but the game is tight.

const LAND: ScenarioPosition[] = [
  { q: 1, r: -3, kind: 'land' },
  { q: 0, r: -2, kind: 'land' },
  { q: 1, r: -2, kind: 'land' },
  { q: 0, r: -1, kind: 'land' },
  { q: 1, r: -1, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: 0, r: 0, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: 0, r: 1, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  { q: 0, r: 2, kind: 'land' },
  { q: -1, r: 3, kind: 'land' },
];

const LAYOUT_3_4: ScenarioLayout = {
  positions: [...LAND, ...seaPositionsInDisk(LAND, 4)],
  portAnchors: [
    { q: 1, r: -3, direction: 4 },
    { q: 1, r: -2, direction: 0 },
    { q: 2, r: -1, direction: 0 },
    { q: 2, r: 0, direction: 1 },
    { q: 0, r: 2, direction: 1 },
    { q: -1, r: 3, direction: 3 },
    { q: -1, r: 1, direction: 3 },
  ],
  pools: {
    // 16 land hexes: 15 producing + 1 desert. Pool balanced.
    terrainCounts: {
      wood: 3,
      brick: 3,
      sheep: 3,
      wheat: 3,
      ore: 3,
      desert: 1,
    },
    // 15 tokens — standard 18 minus a 3, a 5, and an 11.
    tokens: [2, 3, 4, 4, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 12],
    portTypes: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat'],
  },
};

export const diamond: BaseScenario = {
  id: 'diamond',
  name: 'Diamond',
  description:
    'Rhombus-shaped 16-hex board. Smaller and tighter than standard — settling spots overlap more.',
  minPlayers: 3,
  maxPlayers: 4,
  layout3p: LAYOUT_3_4,
};

import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsAround, seaPositionsInDisk } from './helpers';

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
    // 15 tokens — standard 18 minus a 3, an 11 and a 12 (odd one out on 2/12).
    tokens: [2, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11],
    portTypes: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat'],
  },
};

// 5-6: a clean 25-hex rhombus, rows of 1-2-3-4-5-4-3-2-1 stacked on the
// same centre line (the (q, s) parallelogram q, s in [-2, 2], s = -q - r),
// tips at (2, -4) and (-2, 4). 25 hexes is the 3-4 map's size relative to
// its standard board (16 of 19 → 25 of 30), so the 5-6 game stays as tight.
function diamondLand5_6(): ScenarioPosition[] {
  const out: ScenarioPosition[] = [];
  for (let r = -4; r <= 4; r++) {
    for (let q = -2; q <= 2; q++) {
      const s = -q - r;
      if (s >= -2 && s <= 2) out.push({ q, r, kind: 'land' });
    }
  }
  return out;
}

const LAND_5_6 = diamondLand5_6();

const LAYOUT_5_6: ScenarioLayout = {
  // The tips reach radius 4, so the sea follows the coast rather than
  // filling a radius-5 disk.
  positions: [...LAND_5_6, ...seaPositionsAround(LAND_5_6)],
  // 10 harbors, point symmetric: one on each tip, two along each side, none
  // on the side corners.
  portAnchors: [
    { q: 2, r: -4, direction: 5 },
    { q: 2, r: -2, direction: 5 },
    { q: 2, r: -1, direction: 0 },
    { q: 1, r: 1, direction: 0 },
    { q: 0, r: 2, direction: 1 },
    { q: -2, r: 4, direction: 2 },
    { q: -2, r: 2, direction: 2 },
    { q: -2, r: 1, direction: 3 },
    { q: -1, r: -1, direction: 3 },
    { q: 0, r: -2, direction: 4 },
  ],
  pools: {
    // 25 land hexes: 24 producing + 1 desert. The 5-6 mix trimmed evenly
    // (one sheep fewer than the rest).
    terrainCounts: {
      wood: 5,
      brick: 5,
      sheep: 4,
      wheat: 5,
      ore: 5,
      desert: 1,
    },
    // 24 tokens — the 5-6 set of 28 minus a 3, 5, 9 and 11.
    tokens: [
      2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 10, 10, 10, 11, 11, 12, 12,
    ],
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const diamond: BaseScenario = {
  id: 'diamond',
  name: 'Diamond',
  description:
    'Rhombus-shaped board (16 hexes, 25 at 5-6 players). Smaller and tighter than standard — settling spots overlap more.',
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
};

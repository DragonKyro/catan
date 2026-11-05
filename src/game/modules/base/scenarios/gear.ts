import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { hexagonalDisk, seaPositionsInDisk } from './helpers';

// Gear — 13-hex gear shape. The standard 19-hex hexagon with its 6 "between"
// outer hexes carved out into sea, leaving 6 corner "teeth" sticking out
// around a 7-hex core. Small but unique perimeter geometry — many port slots
// at the tooth tips.

const TEETH: Array<{ q: number; r: number }> = [
  { q: 0, r: -2 },
  { q: 2, r: -2 },
  { q: 2, r: 0 },
  { q: 0, r: 2 },
  { q: -2, r: 2 },
  { q: -2, r: 0 },
];

const CORE: Array<{ q: number; r: number }> = [
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 0 },
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const NOTCHES: Array<{ q: number; r: number }> = [
  { q: 1, r: -2 },
  { q: 2, r: -1 },
  { q: 1, r: 1 },
  { q: -1, r: 2 },
  { q: -2, r: 1 },
  { q: -1, r: -1 },
];

const LAND: ScenarioPosition[] = [
  ...TEETH.map((c) => ({ q: c.q, r: c.r, kind: 'land' as const })),
  ...CORE.map((c) => ({ q: c.q, r: c.r, kind: 'land' as const })),
];

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...LAND,
    ...NOTCHES.map((c) => ({ q: c.q, r: c.r, kind: 'sea' as const })),
    ...seaPositionsInDisk(
      [
        ...LAND,
        ...NOTCHES.map((c) => ({ q: c.q, r: c.r, kind: 'sea' as const })),
      ],
      3,
    ),
  ],
  portAnchors: [
    { q: 0, r: -2, direction: 5 },
    { q: 2, r: -2, direction: 0 },
    { q: 2, r: 0, direction: 1 },
    { q: 0, r: 2, direction: 2 },
    { q: -2, r: 2, direction: 3 },
    { q: -2, r: 0, direction: 4 },
  ],
  pools: {
    // 13 land hexes: 12 producing + 1 desert.
    terrainCounts: {
      wood: 2,
      brick: 2,
      sheep: 3,
      wheat: 3,
      ore: 2,
      desert: 1,
    },
    // 12 tokens — standard 18 minus a 3, 4, 5, 9, 10, 11 (one of each).
    tokens: [2, 3, 4, 5, 6, 6, 8, 8, 9, 10, 11, 12],
    portTypes: ['generic', 'generic', 'generic', 'wood', 'brick', 'ore'],
  },
};

// 5-6: one size up — the standard 19-hex hexagon is the core and the
// radius-3 ring around it alternates tooth, notch, tooth, … all the way
// round (18 hexes → 9 teeth, 9 notches). 28 land hexes, 3-fold symmetric
// like a real 9-tooth gear.
const TEETH_5_6: Array<{ q: number; r: number }> = [
  { q: 0, r: -3 },
  { q: 2, r: -3 },
  { q: 3, r: -2 },
  { q: 3, r: 0 },
  { q: 1, r: 2 },
  { q: -1, r: 3 },
  { q: -3, r: 3 },
  { q: -3, r: 1 },
  { q: -2, r: -1 },
];

const NOTCHES_5_6: Array<{ q: number; r: number }> = [
  { q: 1, r: -3 },
  { q: 3, r: -3 },
  { q: 3, r: -1 },
  { q: 2, r: 1 },
  { q: 0, r: 3 },
  { q: -2, r: 3 },
  { q: -3, r: 2 },
  { q: -3, r: 0 },
  { q: -1, r: -2 },
];

const LAND_5_6: ScenarioPosition[] = [
  ...hexagonalDisk(2).map((c) => ({ q: c.q, r: c.r, kind: 'land' as const })),
  ...TEETH_5_6.map((c) => ({ q: c.q, r: c.r, kind: 'land' as const })),
];

const LAYOUT_5_6: ScenarioLayout = {
  positions: [
    ...LAND_5_6,
    ...NOTCHES_5_6.map((c) => ({ q: c.q, r: c.r, kind: 'sea' as const })),
    ...seaPositionsInDisk(
      [
        ...LAND_5_6,
        ...NOTCHES_5_6.map((c) => ({ q: c.q, r: c.r, kind: 'sea' as const })),
      ],
      4,
    ),
  ],
  // One harbor per tooth, on the edge facing straight out.
  portAnchors: [
    { q: 0, r: -3, direction: 4 },
    { q: 2, r: -3, direction: 5 },
    { q: 3, r: -2, direction: 5 },
    { q: 3, r: 0, direction: 0 },
    { q: 1, r: 2, direction: 1 },
    { q: -1, r: 3, direction: 1 },
    { q: -3, r: 3, direction: 2 },
    { q: -3, r: 1, direction: 3 },
    { q: -2, r: -1, direction: 3 },
  ],
  pools: {
    // 28 land hexes: 26 producing + the 5-6 board's 2 deserts. The 5-6 mix
    // minus a wood and a sheep.
    terrainCounts: {
      wood: 5,
      brick: 5,
      sheep: 5,
      wheat: 6,
      ore: 5,
      desert: 2,
    },
    // 26 tokens — the 5-6 set of 28 minus a 4 and a 10.
    tokens: [
      2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12,
    ],
    // Nine teeth, so the base game's nine harbors.
    portTypes: [
      'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const gear: BaseScenario = {
  id: 'gear',
  name: 'Gear',
  description:
    'Gear shape — six "teeth" jut out from a 7-hex core (nine teeth around a 19-hex core at 5-6 players). One port per tooth. Smaller, sharper games.',
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
};

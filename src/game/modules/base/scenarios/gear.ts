import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';

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

export const gear: BaseScenario = {
  id: 'gear',
  name: 'Gear',
  description:
    '13-hex gear shape — six "teeth" jut out from a 7-hex core. One port per tooth. Smaller, sharper games.',
  minPlayers: 3,
  maxPlayers: 4,
  layout3p: LAYOUT_3_4,
};

import type { CustomMap } from './types';
import { CUSTOM_MAP_FILE_VERSION, CUSTOM_MAP_SCHEMA } from './types';
import type { ScenarioPosition } from '../board/scenarioTypes';
import { hexagonalDisk, seaPositionsInDisk } from '../modules/base/scenarios/helpers';

// Starter map shown when the user opens the builder fresh. A pair of
// small islands joined by a narrow strait — small enough to fit comfortably
// at radius 3, big enough to feel like a real Catan board.
const LAND: ScenarioPosition[] = [
  // West peak
  { q: -2, r: 0, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -1, r: 0, kind: 'land' },
  { q: -1, r: 1, kind: 'land' },
  { q: -2, r: 2, kind: 'land' },
  { q: -1, r: -1, kind: 'land' },
  // East peak
  { q: 1, r: -1, kind: 'land' },
  { q: 1, r: 0, kind: 'land' },
  { q: 2, r: -1, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
  { q: 1, r: 1, kind: 'land' },
  // Strait bridge
  { q: 0, r: 0, kind: 'desert' },
];

export function sampleCustomMap(): CustomMap {
  return {
    schema: CUSTOM_MAP_SCHEMA,
    version: CUSTOM_MAP_FILE_VERSION,
    id: 'twin-peaks',
    name: 'Twin Peaks',
    description: 'Two small islands joined by a narrow strait.',
    minPlayers: 3,
    maxPlayers: 4,
    defaultVpToWin: 10,
    seafarers: false,
    fogHexes: [],
    layout: {
      positions: [...LAND, ...seaPositionsInDisk(LAND, 3)],
      portAnchors: [
        { q: -2, r: 0, direction: 4 },
        { q: -2, r: 2, direction: 2 },
        { q: 1, r: -1, direction: 5 },
        { q: 2, r: 0, direction: 0 },
        { q: 1, r: 1, direction: 1 },
      ],
      pools: {
        // 11 non-desert land hexes: 3+2+2+2+2 = 11.
        terrainCounts: {
          wood: 3,
          brick: 2,
          sheep: 2,
          wheat: 2,
          ore: 2,
        },
        // 11 tokens — one of each non-7 number plus an extra 6.
        tokens: [2, 3, 4, 5, 6, 6, 8, 9, 10, 11, 12],
        portTypes: ['generic', 'generic', 'generic', 'wheat', 'ore'],
      },
    },
  };
}

// Blank starter map used when the user first opens the builder: every disk
// cell is sea, no ports, no pools needed. Painting any cell turns it into
// land; the user fills the pools via the side panel.
export function emptyCustomMap(radius = 3): CustomMap {
  const positions: ScenarioPosition[] = hexagonalDisk(radius).map((c) => ({
    q: c.q,
    r: c.r,
    kind: 'sea',
  }));
  return {
    schema: CUSTOM_MAP_SCHEMA,
    version: CUSTOM_MAP_FILE_VERSION,
    id: 'untitled-map',
    name: 'Untitled map',
    description: '',
    minPlayers: 3,
    maxPlayers: 4,
    defaultVpToWin: 10,
    seafarers: false,
    fogHexes: [],
    layout: {
      positions,
      portAnchors: [],
      pools: {
        terrainCounts: {},
        tokens: [],
        portTypes: [],
      },
    },
  };
}

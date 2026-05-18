import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';
import {
  STANDARD_PORT_ANCHORS_3_4,
  STANDARD_PORT_ANCHORS_5_6,
  standardLand3_4,
  standardLand5_6,
} from './standardShape';

// Pond — single sea hex in the center. Six shoreline vertices become prime
// real estate (no resource production but excellent connectivity via the
// shore road). Pure shape variant; otherwise plays like the standard board.

const POND_3_4 = { q: 0, r: 0 };
// The 5-6p shape's geometric center sits between (-1, 0) and (0, 0).
// Picking (0, 0) keeps the pond visually centered on the q-axis.
const POND_5_6 = { q: 0, r: 0 };

function pondPositions3_4(): ScenarioPosition[] {
  return standardLand3_4().map((p) =>
    p.q === POND_3_4.q && p.r === POND_3_4.r
      ? { q: p.q, r: p.r, kind: 'sea' as const }
      : p,
  );
}

function pondPositions5_6(): ScenarioPosition[] {
  return standardLand5_6().map((p) =>
    p.q === POND_5_6.q && p.r === POND_5_6.r
      ? { q: p.q, r: p.r, kind: 'sea' as const }
      : p,
  );
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...pondPositions3_4(),
    ...seaPositionsInDisk(standardLand3_4(), 3),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  pools: {
    // 18 land hexes (19 - 1 pond): 17 producing + 1 desert.
    terrainCounts: {
      wood: 4,
      brick: 3,
      sheep: 4,
      wheat: 3,
      ore: 3,
      desert: 1,
    },
    tokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 10, 10, 11, 11, 12],
    portTypes: [
      'generic',
      'generic',
      'generic',
      'generic',
      'wood',
      'brick',
      'sheep',
      'wheat',
      'ore',
    ],
  },
};

const LAYOUT_5_6: ScenarioLayout = {
  positions: [
    ...pondPositions5_6(),
    ...seaPositionsInDisk(standardLand5_6(), 4),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_5_6,
  pools: {
    // 29 land hexes (30 - 1 pond): 27 producing + 2 deserts.
    terrainCounts: {
      wood: 5,
      brick: 5,
      sheep: 6,
      wheat: 6,
      ore: 5,
      desert: 2,
    },
    // 27 tokens — standard 5-6p 28 minus one 3.
    tokens: [
      2, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 12,
    ],
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore', 'wheat',
    ],
  },
};

export const pond: BaseScenario = {
  id: 'pond',
  name: 'Pond',
  description: 'A single sea hex in the middle of the board. Otherwise plays like the standard map.',
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
};

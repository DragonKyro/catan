import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';
import { STANDARD_PORT_ANCHORS_3_4, standardLand3_4 } from './standardShape';

// Lakes — standard 19-hex outline with three interior sea hexes. The lakes
// chop up the interior and break the distance rule "across" the water:
// opposite shores of a 1-hex lake are still distance-2 (engine enforces it
// for free via the hex graph), so building density drops.

const LAKE_COORDS: Array<{ q: number; r: number }> = [
  { q: 0, r: 0 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
];

function lakesPositions(): ScenarioPosition[] {
  const lakeSet = new Set(LAKE_COORDS.map((c) => `${c.q},${c.r}`));
  return standardLand3_4().map((p) =>
    lakeSet.has(`${p.q},${p.r}`)
      ? { q: p.q, r: p.r, kind: 'sea' as const }
      : p,
  );
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...lakesPositions(),
    ...seaPositionsInDisk(standardLand3_4(), 3),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  pools: {
    // 16 land hexes (19 - 3 lakes): 15 producing + 1 desert.
    terrainCounts: {
      wood: 3,
      brick: 3,
      sheep: 3,
      wheat: 3,
      ore: 3,
      desert: 1,
    },
    tokens: [2, 3, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 12],
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

export const lakes: BaseScenario = {
  id: 'lakes',
  name: 'Lakes',
  description:
    'Standard outline with three interior lakes. Settlements can sit on the shore, but a road has to go around — opposite shores of a lake are still distance-2 for placement.',
  minPlayers: 3,
  maxPlayers: 4,
  layout3p: LAYOUT_3_4,
};

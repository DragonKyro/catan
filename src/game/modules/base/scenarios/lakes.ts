import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';
import {
  STANDARD_PORT_ANCHORS_3_4,
  STANDARD_PORT_ANCHORS_5_6,
  standardLand3_4,
  standardLand5_6,
} from './standardShape';

// Lakes — standard 19-hex outline with three interior sea hexes. The lakes
// chop up the interior and break the distance rule "across" the water:
// opposite shores of a 1-hex lake are still distance-2 (engine enforces it
// for free via the hex graph), so building density drops.

const LAKE_COORDS: Array<{ q: number; r: number }> = [
  { q: 0, r: 0 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
];

// 5-6: the same diagonal lake through the middle, NE to SW, one hex longer.
// The 30-hex board's centre is the edge between (-1, 0) and (0, 0), so the
// lake takes both centre hexes plus the NE neighbour of one and the SW
// neighbour of the other — point symmetric about the centre, and every lake
// hex is interior (land all round).
const LAKE_COORDS_5_6: Array<{ q: number; r: number }> = [
  { q: 1, r: -1 },
  { q: 0, r: 0 },
  { q: -1, r: 0 },
  { q: -2, r: 1 },
];

function withLakes(
  land: ScenarioPosition[],
  lakeCoords: Array<{ q: number; r: number }>,
): ScenarioPosition[] {
  const lakeSet = new Set(lakeCoords.map((c) => `${c.q},${c.r}`));
  return land.map((p) =>
    lakeSet.has(`${p.q},${p.r}`)
      ? { q: p.q, r: p.r, kind: 'sea' as const }
      : p,
  );
}

function lakesPositions(): ScenarioPosition[] {
  return withLakes(standardLand3_4(), LAKE_COORDS);
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
    // 15 tokens — standard 18 minus a 3, an 11 and a 12 (odd one out on 2/12).
    tokens: [2, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11],
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
    ...withLakes(standardLand5_6(), LAKE_COORDS_5_6),
    ...seaPositionsInDisk(standardLand5_6(), 4),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_5_6,
  pools: {
    // 26 land hexes (30 - 4 lakes): 24 producing + the 5-6 board's 2
    // deserts. The 5-6 mix minus a wood, a sheep, a wheat (the 3-4 map's
    // cuts) and one more sheep.
    terrainCounts: {
      wood: 5,
      brick: 5,
      sheep: 4,
      wheat: 5,
      ore: 5,
      desert: 2,
    },
    // 24 tokens — the 5-6 set of 28 minus a 3, 5, 9 and 11 (symmetric, and
    // about the full set's average production per hex).
    tokens: [
      2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 10, 10, 10, 11, 11, 12, 12,
    ],
    // The 5-6 harbors: the base game's 9 plus a 3:1 and a 2:1 wool.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const lakes: BaseScenario = {
  id: 'lakes',
  name: 'Lakes',
  description:
    'Standard outline with interior lakes (three hexes, four at 5-6 players). Settlements can sit on the shore, but a road has to go around — opposite shores of a lake are still distance-2 for placement.',
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
};

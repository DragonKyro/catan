import type { ScenarioLayout } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';
import {
  STANDARD_PORT_ANCHORS_3_4,
  STANDARD_PORT_ANCHORS_5_6,
  standardLand3_4,
  standardLand5_6,
} from './standardShape';

// Gold Rush — colonist.io's "find the gold" map. Standard 19/30-hex shape;
// two/three gold fields mixed into the terrain pool. Settlers adjacent to a
// gold hex pick a resource of choice on production (the same flow Seafarers
// uses, available in the base engine because `gold` is a Terrain value
// rather than a gated mechanic).

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...standardLand3_4(),
    ...seaPositionsInDisk(standardLand3_4(), 3),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  pools: {
    // 19 land hexes: 18 producing + 1 desert. Two of the producers are gold.
    terrainCounts: {
      gold: 2,
      wood: 3,
      brick: 3,
      sheep: 3,
      wheat: 4,
      ore: 3,
      desert: 1,
    },
    tokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
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
    ...standardLand5_6(),
    ...seaPositionsInDisk(standardLand5_6(), 4),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_5_6,
  pools: {
    // 30 land hexes: 28 producing + 2 deserts. Three gold this time.
    terrainCounts: {
      gold: 3,
      wood: 5,
      brick: 5,
      sheep: 5,
      wheat: 5,
      ore: 5,
      desert: 2,
    },
    tokens: [
      2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 12,
    ],
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore', 'wheat',
    ],
  },
};

export const goldRush: BaseScenario = {
  id: 'goldRush',
  name: 'Gold Rush',
  description:
    'Standard board, but two gold fields are mixed into the terrain. Settle next to one and choose your resource on every production roll.',
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
};

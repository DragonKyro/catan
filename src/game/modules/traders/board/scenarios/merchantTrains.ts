import type {
  ScenarioLayout,
  ScenarioPosition,
} from '../../../../board/scenarioTypes';
import type { TradersScenario } from './types';
import {
  STANDARD_PORT_ANCHORS_3_4,
  standardLand3_4,
} from '../../../base/scenarios/standardShape';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';
import { MERCHANT_TRAINS_DEFAULT_VP } from '../../constants';

// Merchant Trains — the watering hole replaces the desert at the centre.
// Every merchant train starts at the watering hole hex; players bid wool
// and wheat at end of turn to decide where the next wagon goes. Wagons
// extend road owners' Longest Route and grant +1 VP to settlements/cities
// flanked by two wagons.
//
// Layout choice: keep the standard 19-hex disc. Only the centre changes —
// no desert, watering hole instead. All 18 outer hexes are producers.

const WATERING_HOLE_COORD = { q: 0, r: 0 };

function merchantLand3_4(): ScenarioPosition[] {
  return standardLand3_4().map((p) => {
    if (
      p.q === WATERING_HOLE_COORD.q &&
      p.r === WATERING_HOLE_COORD.r
    ) {
      return { ...p, fixedTerrain: 'wateringHole' as const };
    }
    return p;
  });
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...merchantLand3_4(),
    ...seaPositionsInDisk(merchantLand3_4(), 3),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  pools: {
    // 18 producing hexes (everything except the watering hole). Standard
    // 19-distribution minus desert: 4W/3B/4S/4Wh/3O = 18.
    terrainCounts: {
      wood: 4,
      brick: 3,
      sheep: 4,
      wheat: 4,
      ore: 3,
    },
    // Standard 18-token pool. The watering hole doesn't take a token.
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

export const merchantTrains: TradersScenario = {
  id: 'merchantTrains',
  name: 'Merchant Trains',
  description:
    "Trade wagons start at the central watering hole. At the end of each turn, players bid wool and wheat to steer where the next wagon goes. Wagons extend roads and reward settlements caught between two of them.",
  minPlayers: 3,
  maxPlayers: 4,
  defaultVpToWin: MERCHANT_TRAINS_DEFAULT_VP,
  layout3p: LAYOUT_3_4,
  wateringHole: WATERING_HOLE_COORD,
};

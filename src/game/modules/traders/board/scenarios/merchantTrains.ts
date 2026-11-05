import type {
  ScenarioLayout,
  ScenarioPosition,
} from '../../../../board/scenarioTypes';
import type { TradersScenario } from './types';
import { standardLand3_4 } from '../../../base/scenarios/standardShape';
import { TB_FRAME_PORTS_3_4, TB_FRAME_PORTS_5_6 } from '../frame';
import { TB_DISCS_5_6, tbPositions5_6 } from './board5_6';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';
import { MERCHANT_TRAINS_DEFAULT_VP } from '../../constants';

// Merchant Trains (2025 rulebook p. 13-14) — the desert goes back in the
// box and the watering hole sits fixed in the centre; the other 18 hexes
// and the 18 number discs are placed at random as usual. Trains leave the
// watering hole from its NW, NE and S corners (resolved geometrically by
// `resolveWagonStarts`). A player who builds a settlement or city collects
// a wagon; a voting round at the end of the turn decides where it goes.
// Wagons on road edges lengthen the Longest Route, and a building between
// two wagons is worth +1 VP. 12 VP wins. Harbors: the T&B frame.

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
  // The T&B frame: the rulebook's nine harbors with their printed types.
  portAnchors: TB_FRAME_PORTS_3_4,
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
    // Every harbor's type is printed on the frame (TB_FRAME_PORTS_3_4).
    portTypes: [],
  },
};

// ----- 5-6 players (T&B 5-6 rulebook p. 7; TB56-MAP-SPEC) -----
//
// "Return the 2 desert hexes to the box. Place the 2 watering holes as
// shown" — at (-1,-1) and (0,1), both tiles the same way round as the 3-4
// one, so each has its own NW / NE / S starts: "six locations for starting
// a merchant train, three at each watering hole". The other 28 hexes and
// all 28 CATAN 5-6 discs are random.

const WATERING_HOLES_5_6 = [
  { q: -1, r: -1 },
  { q: 0, r: 1 },
];

const LAYOUT_5_6: ScenarioLayout = {
  positions: tbPositions5_6((p) =>
    WATERING_HOLES_5_6.some((w) => w.q === p.q && w.r === p.r)
      ? { ...p, fixedTerrain: 'wateringHole' as const }
      : p,
  ),
  portAnchors: TB_FRAME_PORTS_5_6,
  pools: {
    terrainCounts: { wood: 6, brick: 5, sheep: 6, wheat: 6, ore: 5 },
    tokens: TB_DISCS_5_6,
    portTypes: [],
  },
};

export const merchantTrains: TradersScenario = {
  id: 'merchantTrains',
  name: 'Merchant Trains',
  description:
    "Merchant trains leave the central watering hole. Build a settlement or city to collect a wagon; at the end of your turn everyone bids wool and wheat to decide where it goes. A wagon on a road counts as an extra road for the Longest Route, and every building between two wagons is worth +1 VP. 12 VP wins.",
  minPlayers: 3,
  maxPlayers: 6,
  defaultVpToWin: MERCHANT_TRAINS_DEFAULT_VP,
  layout3p: LAYOUT_3_4,
  wateringHole: WATERING_HOLE_COORD,
  layout5_6p: LAYOUT_5_6,
  board5_6: { wateringHoles: WATERING_HOLES_5_6 },
};

import type {
  ScenarioLayout,
  ScenarioPosition,
} from '../../../../board/scenarioTypes';
import type { TradersScenario } from './types';
import { STANDARD_PORT_ANCHORS_3_4, standardLand3_4 } from '../../../base/scenarios/standardShape';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';

// Rivers of Catan — simplified version of the T&B scenario. The official
// rulebook has 2 multi-hex "river tiles" (3-hex and 4-hex strips) with
// specific terrain mixes and a 2/12 double-token hex. This implementation
// is a faithful approximation that lands the headline mechanics on the
// standard 19-hex disc:
//
//   - 2 swamp hexes (mechanical equivalent of "river tiles"). The robber
//     starts on one of them; they don't produce.
//   - 5 designated river edges (bridge sites). Roads forbidden; bridges
//     required. Crossing a river earns 3 gold (bridge build), settling on
//     the swamp earns 1 gold per build (road or settlement).
//   - 17 land hexes with the remaining standard terrain pool.
//
// Deliberately deferred to a follow-up:
//   - The 2/12 double-token hex (rulebook: number 2 lands on the same hex
//     as the 12, so it produces on both rolls). Needs a dice-handler hook.
//   - Multi-hex river tiles with non-swamp interior terrain.
//   - The 5-6p geometry.

// The two swamp positions, picked to create a meaningful east-west "river"
// through the centre of the board with both swamps being interior hexes
// (so bridges actually open new build sites).
const SWAMP_A = { q: -1, r: 0 };
const SWAMP_B = { q: 1, r: 0 };

function riversLand3_4(): ScenarioPosition[] {
  return standardLand3_4().map((p) => {
    if (p.q === SWAMP_A.q && p.r === SWAMP_A.r) {
      return { ...p, fixedTerrain: 'swamp' as const };
    }
    if (p.q === SWAMP_B.q && p.r === SWAMP_B.r) {
      return { ...p, fixedTerrain: 'swamp' as const };
    }
    return p;
  });
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...riversLand3_4(),
    ...seaPositionsInDisk(riversLand3_4(), 3),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  robberStart: SWAMP_A,
  pools: {
    // 17 land hexes need filling (19 total minus 2 swamps). Standard
    // 18-hex pool minus the desert and one of the 3s — the dropped token
    // approximates the rulebook's 2-on-12 collapse without yet needing a
    // dice-handler hook for the doubled production.
    terrainCounts: {
      wood: 4,
      brick: 3,
      sheep: 3,
      wheat: 4,
      ore: 3,
    },
    tokens: [2, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
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

export const riversOfCatan: TradersScenario = {
  id: 'riversOfCatan',
  name: 'Rivers of Catan',
  description:
    'Two swamps cut a river through the island. Cross it with bridges to reach the far side — every river build pays in gold, and the wealthiest player wears the crown.',
  minPlayers: 3,
  maxPlayers: 4,
  defaultVpToWin: 10,
  layout3p: LAYOUT_3_4,
  robberStart: SWAMP_A,
  // 5 river edges (bridge sites). Directions: 0 = NE, 1 = E, 2 = SE,
  // 3 = SW, 4 = W, 5 = NW (matching the port anchor convention). Each
  // (q, r, dir) names a single edge — the generator dedupes the inverse
  // declared from the neighbour's perspective.
  riverEdges: [
    // Horizontal trunk: hex(0,0) is the "land bridge" between the two swamps.
    // The river flows through the W and E edges of (0,0).
    { q: 0, r: 0, direction: 4 }, // ↔ between (0,0) and SWAMP_A (-1,0)
    { q: 0, r: 0, direction: 1 }, // ↔ between (0,0) and SWAMP_B (1,0)
    // Tails extending into the coast — these stretch the river so bridges
    // are worth building rather than detoured around.
    { q: -1, r: 0, direction: 4 }, // SWAMP_A's W edge (toward (-2,0))
    { q: 1, r: 0, direction: 1 }, // SWAMP_B's E edge (toward (2,0))
    // One southern branch off the middle for variety.
    { q: 0, r: 0, direction: 2 }, // (0,0)'s SE edge (toward (0,1))
  ],
};

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

// Fishing on Catan — the lake replaces the desert at (0, 0). All other
// hexes follow the standard 19-hex distribution minus the desert.
//
// Six fishing grounds are anchored to coastal vertices around the
// perimeter, each with its own fixed number token. Vertex IDs aren't
// available at scenario-declaration time — they're derived from hex
// corners — so we declare the fishing grounds by (hex, cornerIndex) pairs
// and resolve them to VertexIds in the generator.

const LAKE_COORD = { q: 0, r: 0 };

// Lake number token. 4 is a reasonable mid-pip choice — not red (would
// dominate the centre) and not deep tail (would barely fire). Six pips
// of probability over a 6-corner hex means roughly one cluster of fish
// per ~6 rolls per adjacent settlement.
const LAKE_TOKEN = 4;

function fishingLand3_4(): ScenarioPosition[] {
  return standardLand3_4().map((p) => {
    if (p.q === LAKE_COORD.q && p.r === LAKE_COORD.r) {
      return {
        ...p,
        fixedTerrain: 'lake' as const,
        fixedToken: LAKE_TOKEN,
      };
    }
    return p;
  });
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...fishingLand3_4(),
    ...seaPositionsInDisk(fishingLand3_4(), 3),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  pools: {
    // 18 producing land hexes (everything except the lake). Standard
    // 19-distribution minus desert: 4W/3B/4S/4Wh/3O = 18.
    terrainCounts: {
      wood: 4,
      brick: 3,
      sheep: 4,
      wheat: 4,
      ore: 3,
    },
    // Standard 18-token pool. The lake is pinned to 4 via fixedToken and
    // doesn't consume a pool slot, so this matches the 18 non-lake hexes.
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

export const fishingOnCatan: TradersScenario = {
  id: 'fishingOnCatan',
  name: 'Fishing on Catan',
  description:
    'The lake at the centre and six coastal fishing grounds each pay fish tokens on roll. Spend fish for free roads, dev cards, theft, or to drive off the robber — and watch out for the old boot.',
  minPlayers: 3,
  maxPlayers: 4,
  defaultVpToWin: 10,
  layout3p: LAYOUT_3_4,
  lake: LAKE_COORD,
  // Six coastal fishing grounds — one per outer-ring hex face that
  // notches into the sea. Each entry pins the (hex coord, corner index)
  // pair that resolves to a unique perimeter vertex, plus a hand-picked
  // number token spreading pip-weight across the production range.
  fishingGrounds: [
    { q: 0, r: -2, corner: 0, token: 5 }, // N
    { q: 2, r: -2, corner: 1, token: 9 }, // NE
    { q: 2, r: 0, corner: 2, token: 6 }, // E
    { q: 0, r: 2, corner: 3, token: 10 }, // SE
    { q: -2, r: 2, corner: 4, token: 8 }, // SW
    { q: -2, r: 0, corner: 5, token: 11 }, // W
  ],
};

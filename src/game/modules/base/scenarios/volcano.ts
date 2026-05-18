import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';
import { STANDARD_PORT_ANCHORS_3_4, standardLand3_4 } from './standardShape';

// Volcano — colonist.io's destructive scenario. The center hex is a fixed
// volcano (mechanically a desert: robber starts there, blocks no production
// since it produces nothing). The volcano takes a number token — pinned to 6
// so it erupts on a common roll. When that number is rolled, one random
// settlement adjacent to the volcano is destroyed (cities downgrade to
// settlements).
//
// Setup rule: no starting settlement may sit on a volcano-adjacent vertex.
// Enforced by the engine's setup validator via `board.volcanoHex`.

const VOLCANO_COORD = { q: 0, r: 0 };

// Override the (0,0) entry in the standard 19-hex frame to be the volcano:
// kind 'desert' (auto-terrain 'desert'), forceToken so it joins the token
// pool, fixedToken to pin the value.
function volcanoLand(): ScenarioPosition[] {
  return standardLand3_4().map((p) =>
    p.q === VOLCANO_COORD.q && p.r === VOLCANO_COORD.r
      ? {
          q: p.q,
          r: p.r,
          kind: 'desert' as const,
          forceToken: true,
          fixedToken: 6,
        }
      : p,
  );
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...volcanoLand(),
    ...seaPositionsInDisk(standardLand3_4(), 3),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  robberStart: VOLCANO_COORD,
  pools: {
    // 18 non-volcano land hexes (all producing — no other desert). Standard
    // resource distribution minus the desert.
    terrainCounts: {
      wood: 4,
      brick: 3,
      sheep: 4,
      wheat: 4,
      ore: 3,
    },
    // Standard 18 number-token pool. The volcano's 6 is on top of these.
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

export const volcano: BaseScenario = {
  id: 'volcano',
  name: 'Volcano',
  description:
    "Center hex is an active volcano. Roll its number and a random settlement next to it is destroyed (a city downgrades to a settlement). No starting settlement may touch it.",
  minPlayers: 3,
  maxPlayers: 4,
  volcano: VOLCANO_COORD,
  layout3p: LAYOUT_3_4,
};

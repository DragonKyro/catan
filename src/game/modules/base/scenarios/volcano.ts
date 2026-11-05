import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '../../citiesAndKnights/constants';
import type { BaseScenario } from './types';
import { hexagonalDisk, seaPositionsInDisk } from './helpers';
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

// 5-6: the 30-hex board has no centre hex (its middle is an edge), so the
// 5-6 island is built round the volcano instead: the radius-3 hexagon with
// its six corners cut off — a round 31-hex island, the volcano at its heart
// with three rings of land around it (the outer one minus its corners). As
// on the 3-4 map the volcano is the only non-producing hex.
const VOLCANO_CORNERS_CUT_5_6 = new Set(['3,-3', '3,0', '0,3', '-3,3', '-3,0', '0,-3']);

function volcanoLand5_6(): ScenarioPosition[] {
  return hexagonalDisk(3)
    .filter((c) => !VOLCANO_CORNERS_CUT_5_6.has(`${c.q},${c.r}`))
    .map((c) =>
      c.q === VOLCANO_COORD.q && c.r === VOLCANO_COORD.r
        ? {
            q: c.q,
            r: c.r,
            kind: 'desert' as const,
            forceToken: true,
            fixedToken: 6,
          }
        : { q: c.q, r: c.r, kind: 'land' as const },
    );
}

const LAND_5_6 = volcanoLand5_6();

const LAYOUT_5_6: ScenarioLayout = {
  positions: [...LAND_5_6, ...seaPositionsInDisk(LAND_5_6, 4)],
  // 11 harbors spread evenly round the coast.
  portAnchors: [
    { q: -2, r: 0, direction: 3 },
    { q: -1, r: -2, direction: 3 },
    { q: 0, r: -2, direction: 4 },
    { q: 2, r: -3, direction: 4 },
    { q: 3, r: -2, direction: 5 },
    { q: 3, r: -1, direction: 0 },
    { q: 2, r: 1, direction: 0 },
    { q: 1, r: 2, direction: 1 },
    { q: -1, r: 3, direction: 2 },
    { q: -2, r: 2, direction: 2 },
    { q: -3, r: 2, direction: 3 },
  ],
  robberStart: VOLCANO_COORD,
  pools: {
    // 30 producing hexes round the volcano, six of each resource (the 5-6
    // board's 28 producing hexes, its deserts' place taken by the volcano,
    // plus a brick and an ore for the bigger island).
    terrainCounts: {
      wood: 6,
      brick: 6,
      sheep: 6,
      wheat: 6,
      ore: 6,
    },
    // 30 tokens: the 5-6 set plus a 4 and a 10, with one 6 and one 8 swapped
    // for a 5 and a 9. The volcano's own 6 already rules out a red number on
    // its six neighbours, and three 6s + three 8s on the 24 hexes left would
    // too often have no layout without two reds touching; two of each (as on
    // the 3-4 map, where the volcano's 6 also comes on top) fit easily.
    tokens: [
      2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6,
      8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 12, 12,
    ],
    // The 5-6 harbors: the base game's 9 plus a 3:1 and a 2:1 wool.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const volcano: BaseScenario = {
  id: 'volcano',
  name: 'Volcano',
  description:
    "Center hex is an active volcano. Roll its number and a random settlement next to it is destroyed (a city downgrades to a settlement). No starting settlement may touch it.",
  minPlayers: 3,
  maxPlayers: 6,
  volcano: VOLCANO_COORD,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
  // The C&K roll has no gold pick / eruption step.
  notWithExpansions: [CITIES_AND_KNIGHTS_EXPANSION_ID],
};

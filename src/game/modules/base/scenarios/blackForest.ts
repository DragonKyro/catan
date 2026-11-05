import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';
import {
  STANDARD_PORT_ANCHORS_3_4,
  STANDARD_PORT_ANCHORS_5_6,
  standardLand3_4,
  standardLand5_6,
} from './standardShape';

// Black Forest — colonist.io's wood-heavy scenario. Five interior hexes are
// fixed forest (wood); the rest randomize from the pool. The classic
// 6-adjacent-to-8 prohibition is RELAXED here — colonist deliberately allows
// red-on-red so the dense forest middle can have a hot nexus. This map is
// brutal and divisive; that's the point.

const FOREST_FIXED: Array<{ q: number; r: number }> = [
  { q: 0, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
];

// 5-6: the forest is an 8-hex block (rows of 3-2-3) around the 30-hex
// board's centre, which is the edge between (-1, 0) and (0, 0), so it is
// mirror symmetric both ways. Roughly the 3-4 map's share of wood (5 of 19
// there, 8 of 30 here), all of it in the middle of the island.
const FOREST_FIXED_5_6: Array<{ q: number; r: number }> = [
  { q: -1, r: -1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 0 },
  { q: 0, r: 0 },
  { q: -2, r: 1 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

function withForest(
  land: ScenarioPosition[],
  forest: Array<{ q: number; r: number }>,
): ScenarioPosition[] {
  const fixedSet = new Set(forest.map((c) => `${c.q},${c.r}`));
  return land.map((p) =>
    fixedSet.has(`${p.q},${p.r}`)
      ? { q: p.q, r: p.r, kind: 'land', fixedTerrain: 'wood' as const }
      : p,
  );
}

function blackForestLand(): ScenarioPosition[] {
  return withForest(standardLand3_4(), FOREST_FIXED);
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [
    ...blackForestLand(),
    ...seaPositionsInDisk(standardLand3_4(), 3),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  tokenConstraints: { allow6_8Adjacent: true },
  pools: {
    // 14 non-fixed land hexes (19 total - 5 fixed wood). Resource mix is
    // light on wood since the fixed forest already provides plenty.
    terrainCounts: {
      brick: 3,
      sheep: 4,
      wheat: 3,
      ore: 3,
      desert: 1,
    },
    // 18 tokens for 18 producing hexes (5 fixed wood + 13 pool-drawn
    // non-desert). Standard set.
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
    ...withForest(standardLand5_6(), FOREST_FIXED_5_6),
    ...seaPositionsInDisk(standardLand5_6(), 4),
  ],
  portAnchors: STANDARD_PORT_ANCHORS_5_6,
  tokenConstraints: { allow6_8Adjacent: true },
  pools: {
    // 22 non-fixed land hexes (30 - 8 fixed wood): the 5-6 board's 30 with
    // the wood (8 instead of 6) all in the fixed forest, and one sheep and
    // one wheat fewer to make room — as the 3-4 map trades a wheat for its
    // extra forest.
    terrainCounts: {
      brick: 5,
      sheep: 5,
      wheat: 5,
      ore: 5,
      desert: 2,
    },
    // 28 producing hexes (8 wood + 20 drawn): the 5-6 token set.
    tokens: [
      2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12,
    ],
    // The 5-6 harbors: the base game's 9 plus a 3:1 and a 2:1 wool.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const blackForest: BaseScenario = {
  id: 'blackForest',
  name: 'Black Forest',
  description:
    'Five fixed forest hexes anchor the middle of the map (eight at 5-6 players). The usual no-adjacent-reds rule is OFF — the densest production cluster can land anywhere.',
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
};

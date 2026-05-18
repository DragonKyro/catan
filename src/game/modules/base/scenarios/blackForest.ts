import type { ScenarioLayout, ScenarioPosition } from '../../../board/scenarioTypes';
import type { BaseScenario } from './types';
import { seaPositionsInDisk } from './helpers';
import { STANDARD_PORT_ANCHORS_3_4, standardLand3_4 } from './standardShape';

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

function blackForestLand(): ScenarioPosition[] {
  const fixedSet = new Set(FOREST_FIXED.map((c) => `${c.q},${c.r}`));
  return standardLand3_4().map((p) =>
    fixedSet.has(`${p.q},${p.r}`)
      ? { q: p.q, r: p.r, kind: 'land', fixedTerrain: 'wood' as const }
      : p,
  );
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

export const blackForest: BaseScenario = {
  id: 'blackForest',
  name: 'Black Forest',
  description:
    'Five fixed forest hexes anchor the middle of the map. The usual no-adjacent-reds rule is OFF — the densest production cluster can land anywhere.',
  minPlayers: 3,
  maxPlayers: 4,
  layout3p: LAYOUT_3_4,
};

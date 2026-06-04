import type { ScenarioLayout, ScenarioPosition } from '../types';
import { buildScenario } from './builder';
import { seaPositionsInDisk } from './helpers';

// Four Islands — four small clusters with no main island. Per the rulebook,
// starting settlements are allowed on any cluster (`startingPlacementZone:
// 'anyIsland'`), and every cluster except the one you start on counts as an
// outer island (chip VP on first settlement).
//
// This file is a structural migration to the modular `ScenarioLayout` schema:
// the same hex positions / terrain mix / token list / port anchors as the
// pre-migration version, but expressed as a frame + pool so terrains, tokens
// and port types are randomized at game-start using the seeded RNG.
// Pool counts could be tightened to rulebook (see MIGRATION.md) in a
// follow-up after visual verification against [docs/.scenario-renders/].

// 16 land hexes spread across 4 clusters.
const LAND_3_4P: ScenarioPosition[] = [
  // North cluster (4)
  { q: -1, r: -2, kind: 'land' },
  { q: 0, r: -2, kind: 'land' },
  { q: 1, r: -3, kind: 'land' },
  { q: 0, r: -3, kind: 'land' },
  // East cluster (4)
  { q: 3, r: -1, kind: 'land' },
  { q: 3, r: 0, kind: 'land' },
  { q: 2, r: 1, kind: 'land' },
  { q: 3, r: -2, kind: 'land' },
  // South cluster (4)
  { q: -2, r: 3, kind: 'land' },
  { q: -1, r: 3, kind: 'land' },
  { q: 0, r: 3, kind: 'land' },
  { q: -1, r: 2, kind: 'land' },
  // West cluster (4)
  { q: -3, r: 1, kind: 'land' },
  { q: -3, r: 2, kind: 'land' },
  { q: -2, r: 1, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    ...LAND_3_4P,
    // Fill the radius-3 disk so the resulting graph matches what the legacy
    // `fillSea` produced.
    ...seaPositionsInDisk(LAND_3_4P, 3),
  ],
  portAnchors: [
    { q: 0, r: -2, direction: 0 },
    { q: 3, r: -1, direction: 2 },
    { q: -1, r: 3, direction: 5 },
    { q: -3, r: 1, direction: 4 },
    { q: 1, r: -3, direction: 0 },
    { q: 0, r: 3, direction: 5 },
  ],
  pools: {
    // 16 land hexes, mix from the pre-migration data.
    terrainCounts: {
      gold: 2,
      brick: 2,
      wood: 3,
      sheep: 3,
      wheat: 3,
      ore: 3,
    },
    // 16 tokens — fully symmetric around 7. 2/12: 1, 3/11: 1, 4/10: 2,
    // 5/9: 2, 6/8: 2.
    tokens: [2, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 12],
    // 6 port types: 1 generic + 5 single-resource (one of each).
    portTypes: ['generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
};

// 5-6 player variant — per the rulebook this is a distinct scenario called
// "The Six Islands" (Seafarers 5-6p, p5): 32 land hexes spread across SIX
// clusters (vs four), no gold, no desert; 32 tokens; 11 ports.
//
// We keep this under the `fourIslands` scenario id so the lobby still shows
// one "Four Islands" entry; the geometry just swaps to Six Islands at 5-6p.
// Geometry is APPROXIMATE — visual verification against
// [docs/.scenario-renders/seafarers-56-p05.png] is pending.
const LAND_5_6P: ScenarioPosition[] = [
  // Cluster A — NW (6)
  { q: -3, r: 0, kind: 'land' },
  { q: -3, r: -1, kind: 'land' },
  { q: -4, r: 0, kind: 'land' },
  { q: -4, r: 1, kind: 'land' },
  { q: -3, r: 1, kind: 'land' },
  { q: -2, r: 0, kind: 'land' },
  // Cluster B — N (5)
  { q: 0, r: -3, kind: 'land' },
  { q: 0, r: -4, kind: 'land' },
  { q: 1, r: -4, kind: 'land' },
  { q: 1, r: -3, kind: 'land' },
  { q: -1, r: -3, kind: 'land' },
  // Cluster C — NE (6)
  { q: 4, r: -3, kind: 'land' },
  { q: 3, r: -3, kind: 'land' },
  { q: 4, r: -2, kind: 'land' },
  { q: 3, r: -2, kind: 'land' },
  { q: 4, r: -4, kind: 'land' },
  { q: 2, r: -2, kind: 'land' },
  // Cluster D — SW (5)
  { q: -3, r: 3, kind: 'land' },
  { q: -3, r: 4, kind: 'land' },
  { q: -4, r: 3, kind: 'land' },
  { q: -4, r: 4, kind: 'land' },
  { q: -2, r: 3, kind: 'land' },
  // Cluster E — S (5)
  { q: 0, r: 3, kind: 'land' },
  { q: 0, r: 4, kind: 'land' },
  { q: -1, r: 4, kind: 'land' },
  { q: 1, r: 3, kind: 'land' },
  { q: 1, r: 2, kind: 'land' },
  // Cluster F — SE (5)
  { q: 3, r: 0, kind: 'land' },
  { q: 4, r: 0, kind: 'land' },
  { q: 4, r: -1, kind: 'land' },
  { q: 3, r: 1, kind: 'land' },
  { q: 2, r: 0, kind: 'land' },
];

const LAYOUT_5_6P: ScenarioLayout = {
  positions: [
    ...LAND_5_6P,
    ...seaPositionsInDisk(LAND_5_6P, 4),
  ],
  // 11 ports — each anchor faces an in-disk sea hex (verified coastal).
  portAnchors: [
    { q: -3, r: 0, direction: 5 }, // → (-2, -1) sea
    { q: -4, r: 1, direction: 1 }, // → (-4, 2) sea
    { q: -2, r: 0, direction: 4 }, // → (-2, -1) sea (other edge)
    { q: 0, r: -3, direction: 1 }, // → (0, -2) sea
    { q: 1, r: -3, direction: 1 }, // → (1, -2) sea
    { q: 3, r: -3, direction: 3 }, // → (2, -3) sea
    { q: 4, r: -2, direction: 2 }, // → (3, -1) sea
    { q: -3, r: 3, direction: 4 }, // → (-3, 2) sea
    { q: -2, r: 3, direction: 0 }, // → (-1, 3) sea
    { q: 0, r: 3, direction: 4 }, // → (0, 2) sea
    { q: 1, r: 2, direction: 4 }, // → (1, 1) sea
  ],
  pools: {
    // 32 land hexes — no gold, no desert (Six Islands rulebook).
    terrainCounts: {
      brick: 6,
      wood: 7,
      sheep: 7,
      wheat: 6,
      ore: 6,
    },
    // 32 tokens — fully symmetric around 7. 2/12: 1 each, 3/11: 3 each,
    // 4/10: 4 each, 5/9: 4 each, 6/8: 4 each.
    tokens: [
      2,
      3, 3, 3,
      4, 4, 4, 4,
      5, 5, 5, 5,
      6, 6, 6, 6,
      8, 8, 8, 8,
      9, 9, 9, 9,
      10, 10, 10, 10,
      11, 11, 11,
      12,
    ],
    // 11 ports — 6 generic + 5 single-resource.
    portTypes: [
      'generic', 'generic', 'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const fourIslands = buildScenario({
  id: 'fourIslands',
  name: 'Four Islands',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 12,
  defaultVpToWin5_6: 13,
  minPlayers: 3,
  maxPlayers: 6,
  startingPlacementZone: 'anyIsland',
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});

import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Through the Desert 2 — variant Through the Desert layout authored in the
// map builder. 27 land + 13 sea + 3 deserts inside a radius-4 disk; 9 ports;
// 2 fixed gold tiles, one on each side of the desert spine.

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // Land hexes — west of the desert spine.
    { q: -4, r: 2, kind: 'land' },
    { q: -4, r: 3, kind: 'land' },
    { q: -3, r: 0, kind: 'land' },
    { q: -3, r: 2, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -3, r: 4, kind: 'land' },
    { q: -2, r: -1, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -2, r: 3, kind: 'land' },
    { q: -1, r: 0, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: -1, r: 2, kind: 'land' },
    { q: -1, r: 4, kind: 'land' },
    { q: 0, r: -1, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 0, r: 1, kind: 'land' },
    { q: 0, r: 4, kind: 'land' },
    // East of the spine.
    { q: 1, r: -2, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    { q: 1, r: 0, kind: 'land' },
    { q: 2, r: 2, kind: 'land' },
    { q: 3, r: -2, kind: 'land' },
    { q: 3, r: -1, kind: 'land' },
    { q: 3, r: 0, kind: 'land' },
    // Fixed gold tiles.
    { q: -1, r: -2, kind: 'land', fixedTerrain: 'gold' },
    { q: 1, r: 2, kind: 'land', fixedTerrain: 'gold' },
    // Desert spine.
    { q: -2, r: 0, kind: 'desert' },
    { q: -1, r: -1, kind: 'desert' },
    { q: 0, r: -2, kind: 'desert' },
    // Sea hexes.
    { q: -4, r: 1, kind: 'sea' },
    { q: -4, r: 4, kind: 'sea' },
    { q: -3, r: 1, kind: 'sea' },
    { q: -2, r: 4, kind: 'sea' },
    { q: -1, r: 3, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 0, r: 3, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 1, r: 3, kind: 'sea' },
    { q: 2, r: -2, kind: 'sea' },
    { q: 2, r: -1, kind: 'sea' },
    { q: 2, r: 0, kind: 'sea' },
    { q: 2, r: 1, kind: 'sea' },
    { q: 3, r: 1, kind: 'sea' },
  ],
  portAnchors: [
    { q: -4, r: 3, direction: 3 },
    { q: -4, r: 4, direction: 4 },
    { q: -3, r: 4, direction: 2 },
    { q: -2, r: 4, direction: 3 },
    { q: -1, r: 3, direction: 4 },
    { q: 1, r: 1, direction: 4 },
    { q: 2, r: -1, direction: 2 },
    { q: 2, r: -2, direction: 3 },
    { q: -2, r: 1, direction: 3 },
  ],
  pools: {
    // 25 non-desert non-gold land hexes.
    terrainCounts: {
      wood: 5,
      brick: 5,
      sheep: 5,
      wheat: 5,
      ore: 5,
    },
    // 27 tokens — one per producing land hex (25 pool-drawn + 2 fixed gold).
    tokens: [
      2,
      3, 3, 3,
      4, 4, 4,
      5, 5, 5,
      6, 6, 6,
      8, 8, 8,
      9, 9, 9,
      10, 10, 10,
      11, 11, 11,
      12, 12,
    ],
    // 9 port types — 5 single-resource (2:1) + 4 generic (3:1).
    portTypes: [
      'wheat', 'ore', 'sheep', 'wood', 'brick',
      'generic', 'generic', 'generic', 'generic',
    ],
  },
};

export const throughTheDesert2 = buildScenario({
  id: 'throughTheDesert2',
  name: 'Through the Desert 2',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 10,
  minPlayers: 3,
  maxPlayers: 4,
  desertIsBoundary: true,
  layout3p: LAYOUT_3_4P,
});

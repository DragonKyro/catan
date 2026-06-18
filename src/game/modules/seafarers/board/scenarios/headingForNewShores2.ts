import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Heading for New Shores 2 — the alternate Seafarers introductory map.
// Layout authored in the map builder; 28 land + 16 sea = 44 hexes inside a
// radius-4 disk. 9 ports (5×2:1 + 4×3:1), 1 desert + 2 gold randomised
// into the terrain pool.
//
// Shape: an irregular main landmass occupying the W half of the disk,
// connected southwards to a tail that bends back east; a separate 5-hex
// "boot" island on the E (q ≈ 2..3); and small fingerprints to the south.

// ---------------------------------------------------------------------------
// 3-4 player layout: 28 land + 16 sea, 9 ports. Desert and gold are NOT
// pinned — they're drawn from `terrainCounts` and land on random tiles.
// ---------------------------------------------------------------------------
const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // Land hexes.
    { q: -3, r: 1, kind: 'land' },
    { q: -3, r: 2, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -2, r: 0, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -2, r: 3, kind: 'land' },
    { q: -1, r: -2, kind: 'land' },
    { q: -1, r: 0, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: -1, r: 2, kind: 'land' },
    { q: -1, r: 3, kind: 'land' },
    { q: 0, r: -2, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 0, r: 1, kind: 'land' },
    { q: 0, r: 2, kind: 'land' },
    { q: 2, r: -2, kind: 'land' },
    { q: 2, r: -1, kind: 'land' },
    { q: 2, r: 0, kind: 'land' },
    { q: 2, r: 1, kind: 'land' },
    { q: 3, r: -1, kind: 'land' },
    { q: -4, r: 2, kind: 'land' },
    { q: -4, r: 3, kind: 'land' },
    { q: -4, r: 4, kind: 'land' },
    { q: -3, r: 4, kind: 'land' },
    { q: -2, r: 4, kind: 'land' },
    { q: 0, r: 4, kind: 'land' },
    { q: 1, r: 3, kind: 'land' },
    // Sea hexes.
    { q: -3, r: 0, kind: 'sea' },
    { q: -2, r: -1, kind: 'sea' },
    { q: -1, r: -1, kind: 'sea' },
    { q: 0, r: -1, kind: 'sea' },
    { q: 0, r: 3, kind: 'sea' },
    { q: 1, r: -2, kind: 'sea' },
    { q: 1, r: -1, kind: 'sea' },
    { q: 1, r: 0, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: 3, r: -2, kind: 'sea' },
    { q: 3, r: 0, kind: 'sea' },
    { q: -4, r: 1, kind: 'sea' },
    { q: -1, r: 4, kind: 'sea' },
    { q: 2, r: 2, kind: 'sea' },
    { q: 3, r: 1, kind: 'sea' },
  ],
  // 9 port anchors. Direction mapping: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE.
  // Anchors may sit on EITHER side of a coastal edge — `resolvePorts` only
  // needs (q, r, direction) to identify the edge, and the renderer picks
  // the land neighbour to push the marker out. Three of these anchors
  // (-1,4), (0,3), (1,0) live on the sea side of their edge.
  portAnchors: [
    { q: -4, r: 4, direction: 3 },
    { q: -3, r: 4, direction: 2 },
    { q: -1, r: 4, direction: 3 },
    { q: 0, r: 3, direction: 4 },
    { q: 1, r: 0, direction: 2 },
    { q: 0, r: 0, direction: 4 },
    { q: -2, r: 0, direction: 3 },
    { q: -4, r: 2, direction: 4 },
    { q: -4, r: 2, direction: 2 },
  ],
  pools: {
    // 28 land hexes filled entirely from the pool. Standard 5-of-each
    // resource (= 25) + 1 desert + 2 gold = 28.
    terrainCounts: {
      wood: 5,
      brick: 5,
      sheep: 5,
      wheat: 5,
      ore: 5,
      desert: 1,
      gold: 2,
    },
    // 27 tokens — one per producing land hex (28 minus the pool-drawn
    // desert). Symmetric around 7 except for a single 12 (the smallest
    // asymmetry, placed on the rarest pair per the token-distribution
    // rule in CLAUDE.md).
    tokens: [
      2, 2,
      3, 3, 3,
      4, 4, 4,
      5, 5, 5,
      6, 6, 6,
      8, 8, 8,
      9, 9, 9,
      10, 10, 10,
      11, 11, 11,
      12,
    ],
    // 9 port types. Order matches `portAnchors`: first 5 are the 2:1
    // resource ports, the rest are generic 3:1.
    portTypes: [
      'wheat', 'brick', 'wood', 'sheep', 'ore',
      'generic', 'generic', 'generic', 'generic',
    ],
  },
};

export const headingForNewShores2 = buildScenario({
  id: 'headingForNewShores2',
  name: 'Heading for New Shores 2',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 10,
  minPlayers: 3,
  maxPlayers: 4,
  layout3p: LAYOUT_3_4P,
});

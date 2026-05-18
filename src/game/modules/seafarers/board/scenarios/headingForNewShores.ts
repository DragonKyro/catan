import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Heading for New Shores — the canonical Seafarers introductory scenario.
// Main island (centre-left) plus three smaller outer islands. Two gold hexes
// (3-4p) / three (5-6p) sit on the small islands.
//
// This is the first scenario migrated to the **modular** layout format
// (frame + pools). The frame — which (q,r) positions are land vs sea — is
// deterministic per player count. Terrain, number tokens, and port types are
// drawn from pools at game-start using the seeded RNG.
//
// IMPORTANT: the position coordinates below are an approximation of the
// official rulebook diagram, derived from the existing hand-authored layout
// plus the additional hexes needed to hit the official component counts
// (3p: 22 land + 13 sea = 35; 4p: 28 land + 14 sea = 42). Visual verification
// against [docs/.scenario-renders/seafarers-p04.png] (3p) and
// [docs/.scenario-renders/seafarers-p05.png] (4p) is still pending — once
// the in-game ScenarioPreview component lands we can compare side-by-side
// and tighten the positions. The pools, port count, VP target, and component
// breakdown all match the rulebook exactly.

// ---------------------------------------------------------------------------
// 3-player layout: 22 land + 13 sea = 35 positions, 8 ports
// Per rulebook: 2 gold, 4 hills, 3 forests, 5 pastures, 4 fields, 4 mountains
// ---------------------------------------------------------------------------
const LAYOUT_3P: ScenarioLayout = {
  positions: [
    // Main island (13 land hexes) — pulled from the existing layout, with the
    // former fixed desert at (-1,2) flipped to a regular land hex since the
    // 3p rulebook ships with zero deserts.
    { q: -2, r: 0, kind: 'land' },
    { q: -1, r: 0, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 1, r: 0, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: 0, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -1, r: 2, kind: 'land' },
    { q: -1, r: -1, kind: 'land' },
    { q: 0, r: -1, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    { q: 0, r: -2, kind: 'land' },
    // NE small island (2)
    { q: 2, r: -3, kind: 'land' },
    { q: 3, r: -3, kind: 'land' },
    // East small island (3)
    { q: 3, r: -1, kind: 'land' },
    { q: 3, r: 0, kind: 'land' },
    { q: 4, r: 0, kind: 'land' },
    // South small island (3)
    { q: -1, r: 3, kind: 'land' },
    { q: 0, r: 3, kind: 'land' },
    { q: 1, r: 3, kind: 'land' },
    // SE small island (1)
    { q: 2, r: 1, kind: 'land' },

    // Sea (13)
    { q: -1, r: -2, kind: 'sea' },
    { q: 1, r: -2, kind: 'sea' },
    { q: 2, r: -2, kind: 'sea' },
    { q: 3, r: -2, kind: 'sea' },
    { q: 4, r: -3, kind: 'sea' },
    { q: 4, r: -2, kind: 'sea' },
    { q: 4, r: -1, kind: 'sea' },
    { q: 2, r: -1, kind: 'sea' },
    { q: 2, r: 0, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: -2, r: 3, kind: 'sea' },
  ],
  // 8 ports — anchored on a land hex with `direction` pointing to an adjacent
  // explicit sea hex (Seafarers convention: coastal edges need a sea hex on
  // the water side, off-frame doesn't count). Types are drawn from
  // `pools.portTypes` (5 single-resource + 3 generic per 3p rules).
  // Direction mapping: 0=NE, 1=E, 2=SE, 3=SW, 4=W, 5=NW.
  portAnchors: [
    { q: 1, r: -1, direction: 0 }, // → (2,-2) sea
    { q: 1, r: 0, direction: 1 }, // → (2,0) sea
    { q: 0, r: 1, direction: 1 }, // → (1,1) sea
    { q: -2, r: 2, direction: 2 }, // → (-2,3) sea
    { q: -1, r: 2, direction: 3 }, // → (-2,3) sea (different edge of same sea hex)
    { q: 0, r: -2, direction: 4 }, // → (-1,-2) sea
    { q: 3, r: 0, direction: 0 }, // → (4,-1) sea
    { q: 0, r: 3, direction: 5 }, // → (0,2) sea
  ],
  pools: {
    // 22 land hexes (no desert in 3p).
    terrainCounts: {
      gold: 2,
      brick: 4,
      wood: 3,
      sheep: 5,
      wheat: 4,
      ore: 4,
    },
    // 22 tokens — rulebook 3p distribution.
    tokens: [
      2,
      3, 3,
      4, 4, 4,
      5, 5, 5,
      6, 6,
      8, 8, 8,
      9, 9,
      10, 10, 10,
      11, 11,
      12,
    ],
    // 8 port types — 3 generic + 5 single-resource per rulebook.
    portTypes: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
};

// ---------------------------------------------------------------------------
// 4-player layout: 28 land + 14 sea = 42 positions, 9 ports, 1 desert
// Per rulebook: 2 gold, 5 hills, 5 forests, 5 pastures, 5 fields, 5 mountains, 1 desert
// ---------------------------------------------------------------------------
const LAYOUT_4P: ScenarioLayout = {
  positions: [
    // Main island (14 land + 1 desert = 15 hexes; the desert anchors
    // (-1,2) per the existing layout).
    { q: -2, r: 0, kind: 'land' },
    { q: -1, r: 0, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 1, r: 0, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: 0, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -1, r: 2, kind: 'desert' },
    { q: -1, r: -1, kind: 'land' },
    { q: 0, r: -1, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    { q: 0, r: -2, kind: 'land' },
    { q: 1, r: -2, kind: 'land' },     // +1 vs 3p
    { q: -1, r: -2, kind: 'land' },    // +1 vs 3p
    // NE small island (3) — +1 vs 3p
    { q: 2, r: -3, kind: 'land' },
    { q: 3, r: -3, kind: 'land' },
    { q: 4, r: -3, kind: 'land' },
    // East small island (4) — +1 vs 3p (adds (4,-2) as a gold hex per
    // rulebook 4p which has a third gold; randomized via terrain pool).
    { q: 3, r: -1, kind: 'land' },
    { q: 3, r: 0, kind: 'land' },
    { q: 4, r: 0, kind: 'land' },
    { q: 4, r: -1, kind: 'land' },     // +1 vs 3p
    // South small island (4) — +1 vs 3p
    { q: -1, r: 3, kind: 'land' },
    { q: 0, r: 3, kind: 'land' },
    { q: 1, r: 3, kind: 'land' },
    { q: -2, r: 3, kind: 'land' },     // +1 vs 3p (was sea in 3p)
    // SE small island (2) — +1 vs 3p
    { q: 2, r: 1, kind: 'land' },
    { q: 2, r: 2, kind: 'land' },      // +1 vs 3p

    // Sea (14)
    { q: 2, r: -2, kind: 'sea' },
    { q: 3, r: -2, kind: 'sea' },
    { q: 4, r: -2, kind: 'sea' },
    { q: 2, r: -1, kind: 'sea' },
    { q: 2, r: 0, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: -3, r: 1, kind: 'sea' },
    { q: -3, r: 2, kind: 'sea' },
    { q: -3, r: 3, kind: 'sea' },
    { q: -2, r: -1, kind: 'sea' },
    { q: 4, r: -4, kind: 'sea' },
    { q: 5, r: -3, kind: 'sea' },
  ],
  // 9 ports for 4p — each anchor points to a `kind: 'sea'` neighbor.
  // Direction mapping: 0=NE, 1=E, 2=SE, 3=SW, 4=W, 5=NW.
  portAnchors: [
    { q: 1, r: -1, direction: 0 }, // → (2,-2) sea
    { q: 1, r: 0, direction: 1 }, // → (2,0) sea
    { q: 0, r: 1, direction: 1 }, // → (1,1) sea
    { q: -2, r: 2, direction: 3 }, // → (-3,3) sea
    { q: -2, r: 1, direction: 3 }, // → (-3,2) sea
    { q: -1, r: -2, direction: 4 }, // → (-2,-1) sea
    { q: 3, r: 0, direction: 4 }, // → (2,0) sea
    { q: 0, r: 3, direction: 5 }, // → (0,2) sea
    { q: 2, r: 2, direction: 4 }, // → (1,2) sea
  ],
  pools: {
    // 27 land hexes need terrains (desert is at a fixed position, doesn't pull).
    terrainCounts: {
      gold: 2,
      brick: 5,
      wood: 5,
      sheep: 5,
      wheat: 5,
      ore: 5,
    },
    // 27 tokens (one per non-desert land hex). Rulebook 4p distribution.
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
    // 9 port types — 4 generic + 5 single-resource per rulebook 4p.
    portTypes: [
      'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const headingForNewShores = buildScenario({
  id: 'headingForNewShores',
  name: 'Heading for New Shores',
  defaultIslandBonusVp: 2,
  // Per 2025 rulebook: 14 VPs to win (3p and 4p both — there's no separate
  // 3p VP target in this scenario). The 5-6p extension typically adds 1.
  defaultVpToWin: 14,
  defaultVpToWin5_6: 14,
  minPlayers: 3,
  // 5-6p still pending Phase 7 (needs an expanded main island so 10 starting
  // settlements fit under the distance rule).
  maxPlayers: 4,
  layout3p: LAYOUT_3P,
  layout4p: LAYOUT_4P,
});

import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';

// Heading for New Shores 2 — the alternate Seafarers introductory map.
// Larger 42-hex setup (28 land + 14 sea) with one desert and 2 gold.
// 9 ports (5×2:1 + 4×3:1). Same setup for 3p and 4p per the rulebook.
//
// Main island is a TRUE hexagon: 3/4/5/4/3 rows = 19 hexes with the desert
// pinned at its centre. Three small outer islands sit around the main:
//
//   • NW island: 2 hexes (one GOLD) — top-left of board
//   • NE island: 4 hexes, BACKWARDS-7 shape (one GOLD) — top-right
//   • SE island: 3 hexes (no gold) — lower-right
//
// Gold tiles are pinned to outer islands so ship investment translates
// directly into the choose-any-resource production bonus, matching the
// rulebook's intent that exploration of the small islands is rewarded.

// ---------------------------------------------------------------------------
// 3-4 player layout: 28 land + 14 sea = 42 positions, 9 ports, 1 desert,
// 2 gold (both on outer islands).
// ---------------------------------------------------------------------------
const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // -----------------------------------------------------------------------
    // Main island — TRUE HEXAGON, 3/4/5/4/3 = 19 hexes, centred at q=-1.
    // Desert pinned at the geometric centre (-1, 0).
    // -----------------------------------------------------------------------
    // r=-2 (3 hexes — top row)
    { q: -1, r: -2, kind: 'land' },
    { q: 0, r: -2, kind: 'land' },
    { q: 1, r: -2, kind: 'land' },
    // r=-1 (4 hexes)
    { q: -2, r: -1, kind: 'land' },
    { q: -1, r: -1, kind: 'land' },
    { q: 0, r: -1, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    // r=0 (5 hexes — widest row, desert at centre)
    { q: -3, r: 0, kind: 'land' },
    { q: -2, r: 0, kind: 'land' },
    { q: -1, r: 0, kind: 'desert' },
    { q: 0, r: 0, kind: 'land' },
    { q: 1, r: 0, kind: 'land' },
    // r=1 (4 hexes)
    { q: -3, r: 1, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: 0, r: 1, kind: 'land' },
    // r=2 (3 hexes — bottom row)
    { q: -3, r: 2, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -1, r: 2, kind: 'land' },

    // -----------------------------------------------------------------------
    // NW small island — 2 hexes diagonally above the main island's NW
    // corner. One hex is GOLD.
    // -----------------------------------------------------------------------
    { q: -3, r: -2, kind: 'land', fixedTerrain: 'gold' },
    { q: -2, r: -3, kind: 'land' },

    // -----------------------------------------------------------------------
    // NE small island — 4-hex BACKWARDS-7 (top bar + stem leaning down-
    // right from the LEFT end of the bar):
    //
    //     ⬡⬡       ← (3,-3) (4,-3) top bar
    //      ⬡       ← (3,-2) stem dips down-right
    //      ⬡       ← (3,-1) stem ends below the bar's left hex
    //
    // One hex is GOLD.
    // -----------------------------------------------------------------------
    { q: 3, r: -3, kind: 'land' },
    { q: 4, r: -3, kind: 'land', fixedTerrain: 'gold' },
    { q: 3, r: -2, kind: 'land' },
    { q: 3, r: -1, kind: 'land' },

    // -----------------------------------------------------------------------
    // SE small island — 3-hex triangle/L cluster south-east of main.
    // -----------------------------------------------------------------------
    { q: 3, r: 1, kind: 'land' },
    { q: 2, r: 2, kind: 'land' },
    { q: 3, r: 2, kind: 'land' },

    // -----------------------------------------------------------------------
    // Sea (14) — explicit ocean cells separating the islands.
    // -----------------------------------------------------------------------
    { q: -2, r: -2, kind: 'sea' }, // between NW and main top
    { q: -3, r: -1, kind: 'sea' }, // between NW and main left
    { q: 2, r: -3, kind: 'sea' },  // between N gap and NE
    { q: 2, r: -2, kind: 'sea' },  // between main top-right and NE
    { q: 2, r: -1, kind: 'sea' },  // between main right and NE stem
    { q: 2, r: 0, kind: 'sea' },   // between main right and SE
    { q: 2, r: 1, kind: 'sea' },   // between main and SE
    { q: 1, r: 1, kind: 'sea' },   // between main and SE
    { q: 1, r: 2, kind: 'sea' },   // between main bottom and SE
    { q: 4, r: -2, kind: 'sea' },  // east of NE backwards-7
    { q: 4, r: -1, kind: 'sea' },  // east of NE backwards-7
    { q: 4, r: 0, kind: 'sea' },   // east buffer
    { q: -1, r: 3, kind: 'sea' },  // south of main bottom
    { q: 0, r: 2, kind: 'sea' },   // SE-adjacent buffer
  ],
  // 9 ports — ALL on the main island, spaced clockwise around its coast.
  // Mix of coastal (faces a sea hex) and perimeter (faces off-board water
  // border). Adjacent ports are placed on NON-touching edges so the pier
  // sprites don't share vertices.
  // Direction mapping: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE.
  portAnchors: [
    { q: -1, r: -2, direction: 4 }, // 1. main top-NW → perimeter
    { q: 1, r: -2, direction: 5 },  // 2. main top-NE → perimeter
    { q: 1, r: -1, direction: 0 },  // 3. main E-upper → (2,-1) sea
    { q: 1, r: 0, direction: 0 },   // 4. main E → (2,0) sea
    { q: 0, r: 1, direction: 1 },   // 5. main SE → (1,1) sea (visible between main and SE island)
    { q: -1, r: 2, direction: 1 },  // 6. main S → perimeter
    { q: -3, r: 2, direction: 2 },  // 7. main SW → perimeter
    { q: -3, r: 1, direction: 3 },  // 8. main W → perimeter
    { q: -2, r: -1, direction: 3 }, // 9. main W-upper → (-3,-1) sea
  ],
  pools: {
    // 28 land - 1 desert - 2 gold (both fixed) = 25 hexes drawn from pool.
    // Rulebook 5 each of brick/wood/sheep/wheat/ore = 25.
    terrainCounts: {
      brick: 5,
      wood: 5,
      sheep: 5,
      wheat: 5,
      ore: 5,
    },
    // 27 tokens (one per non-desert land hex). Closest to symmetric around
    // 7 for an odd-count pool; asymmetry of 1 placed on the rarest pair (12)
    // per the CLAUDE.md token rule.
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
    // 9 port types — 4 generic (3:1) + 5 single-resource (2:1) per rulebook.
    portTypes: [
      'generic', 'generic', 'generic', 'generic',
      'wood', 'brick', 'sheep', 'wheat', 'ore',
    ],
  },
};

export const headingForNewShores2 = buildScenario({
  id: 'headingForNewShores2',
  name: 'Heading for New Shores 2',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 14,
  minPlayers: 3,
  maxPlayers: 4,
  layout3p: LAYOUT_3_4P,
});

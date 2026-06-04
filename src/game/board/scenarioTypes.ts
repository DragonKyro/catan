import type { Terrain, PortType } from '../types';

// Modular scenario layout schema. Originally a Seafarers concept; lifted to a
// shared location so the base game can declare alternate-shape scenarios
// (Gold Rush, Volcano, Black Forest, Diamond, Gear, Lakes, Pond, Twirl)
// without duplicating the materialization machinery.
//
// The schema distinguishes three things per scenario:
//   1. The FRAME — fixed positions: which (q, r) cells exist and whether each
//      is land, sea, or desert. Varies by player count.
//   2. The POOLS — counts of terrains, number tokens, and port types. These
//      get randomly distributed at game start over the frame's land hexes.
//   3. The RULES — VP target, special mechanics, starting placement zone
//      (declared on the scenario record that wraps this layout).

// ----- Per-hex / per-port definitions (post-materialization) -----

export interface ScenarioHexDef {
  q: number;
  r: number;
  terrain: Terrain;
  token: number | null;
}

// Port placement: anchored by a (q, r) land/island hex and a direction 0..5
// (clockwise from the upper-right edge, pointy-top orientation). The edge
// chosen is the shared edge between this hex and the neighbour in that
// direction. The neighbour is expected to be a sea hex.
export interface ScenarioPortDef {
  q: number;
  r: number;
  direction: 0 | 1 | 2 | 3 | 4 | 5;
  type: PortType;
}

// ----- Modular schema (frame + pools) -----

export type ScenarioPositionKind = 'land' | 'sea' | 'desert';

export interface ScenarioPosition {
  q: number;
  r: number;
  kind: ScenarioPositionKind;
  // Optional anchor: pin this position to a specific terrain (e.g. a
  // designated gold field on a small island, or the fixed forest tiles on
  // Black Forest). Bypasses the pool draw. Only meaningful when
  // `kind === 'land'`.
  fixedTerrain?: Terrain;
  // When true, this position participates in token assignment even though
  // its terrain is desert. Used by the Volcano scenario where the volcano
  // hex is mechanically a desert (robber-blocking, no production) but rolls
  // its number to trigger eruption.
  forceToken?: boolean;
  // When set, the position takes this exact number token instead of drawing
  // from the pool. The pool's token count should be reduced by the number
  // of `fixedToken` positions on the layout. The 6/8 adjacency check still
  // includes fixed-token hexes.
  fixedToken?: number;
}

// Port anchor without a type — the type is drawn from `ScenarioPools.portTypes`.
export interface ScenarioPortAnchor {
  q: number;
  r: number;
  direction: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface ScenarioPools {
  // Number of each terrain to place on `kind: 'land'` positions that don't
  // have a `fixedTerrain`. Sum must equal the count of such positions.
  terrainCounts: Partial<Record<Terrain, number>>;
  // Number tokens to distribute across non-desert land positions (including
  // pool-drawn AND fixed-terrain ones, except deserts). Length must equal
  // the non-desert land count. Pool order doesn't matter — the generator
  // shuffles and retries to avoid 6/8 adjacency.
  tokens: number[];
  // Port type pool. Length must equal `portAnchors.length`.
  portTypes: PortType[];
}

export interface ScenarioTokenConstraints {
  // When true, the materializer skips the no-adjacent-6/8 retry loop. Used
  // by Black Forest where colonist.io deliberately allows red-on-red
  // adjacencies on the outer ring.
  allow6_8Adjacent?: boolean;
}

export interface ScenarioLayout {
  positions: ScenarioPosition[];
  portAnchors: ScenarioPortAnchor[];
  pools: ScenarioPools;
  // Optional overrides for where robber / pirate start. When absent the
  // generator falls back to defaults (first desert, first sea hex).
  robberStart?: { q: number; r: number };
  pirateStart?: { q: number; r: number };
  // Optional constraints on the token shuffle.
  tokenConstraints?: ScenarioTokenConstraints;
}

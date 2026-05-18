import type { Terrain, PortType, TribeTokenType } from '../../../types';

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

// ----------------------------------------------------------------------------
// Modular scenario schema (Phase 7 work, additive — old per-hex `land` /
// `ports` blueprints still build the same way).
//
// The official Seafarers Almanac distinguishes three things per scenario:
//   1. The FRAME — fixed positions: which (q, r) cells exist and whether each
//      is land, sea, or desert. This is the only piece that varies by player
//      count (e.g. Heading for New Shores 3p uses a different shape than 4p).
//   2. The POOLS — counts of terrains, number tokens, and port types. These
//      get randomly distributed at game start over the frame's land hexes.
//   3. The RULES — VP target, special mechanics, starting placement zone.
//
// Treating these as separate concerns makes future custom-map support
// straightforward (a custom map is just a frame + pools), and lets multiple
// scenarios reuse the same frame with different pools / rules.
// ----------------------------------------------------------------------------

export type ScenarioPositionKind = 'land' | 'sea' | 'desert';

export interface ScenarioPosition {
  q: number;
  r: number;
  kind: ScenarioPositionKind;
  // Optional anchor: pin this position to a specific terrain (e.g. a
  // designated gold field on a small island). Bypasses the pool draw.
  // Only meaningful when `kind === 'land'`.
  fixedTerrain?: Terrain;
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

export interface ScenarioLayout {
  positions: ScenarioPosition[];
  portAnchors: ScenarioPortAnchor[];
  pools: ScenarioPools;
  // Optional overrides for where robber / pirate start. When absent the
  // generator falls back to defaults (first desert, first sea hex).
  robberStart?: { q: number; r: number };
  pirateStart?: { q: number; r: number };
}

// Forgotten Tribe token placement. Each token sits on a single hex; the
// first player to settle on any vertex of that hex claims it.
export interface ScenarioTribeTokenDef {
  q: number;
  r: number;
  type: TribeTokenType;
}

export interface Scenario {
  id: string;
  name: string;
  // Legacy fixed-content layout (per-hex terrain + token). Empty arrays for
  // modular scenarios — read `layout3p`/`layout4p`/`layout5_6p` instead.
  hexes: ScenarioHexDef[];
  ports: ScenarioPortDef[];
  // Default VP per outer island (smaller connected land component); the
  // largest connected land component is the "main island" and gets no chip.
  defaultIslandBonusVp: number;
  // Per-island override (keyed by an arbitrary island label). Currently
  // unused in v1 — scenarios fall back to defaultIslandBonusVp for all
  // outer islands.
  islandBonusVp?: Record<string, number>;
  // Optional 5-6 player variant. When present and the game has >= 5 players,
  // these hex/port definitions replace the 3-4 ones. The grid radius is
  // increased to 4 so larger layouts fit.
  hexes5_6?: ScenarioHexDef[];
  ports5_6?: ScenarioPortDef[];
  // Official VP target for this scenario (used as the default in lobby UI;
  // still overridable by the host). Applies to the 3-4 player layout.
  defaultVpToWin: number;
  // Official VP target for the 5-6 player layout. When absent, falls back
  // to `defaultVpToWin`. Most official Seafarers scenarios add 1-2 VP for
  // the larger board because more island-bonus chips become reachable.
  defaultVpToWin5_6?: number;
  // Player-count window the scenario supports. The lobby uses these to gray
  // out unsupported seat counts. When `hexes5_6` is absent the scenario is
  // effectively capped at 4.
  minPlayers: number;
  maxPlayers: number;
  // Where players may put their two starting settlements. Most scenarios
  // restrict setup to the main island and reward expansion onto outer
  // islands during the game; a few (e.g. Four Islands) explicitly allow
  // starting on any land hex.
  startingPlacementZone: 'mainIslandOnly' | 'anyIsland';
  // When true, desert hexes act as island boundaries (like sea) during
  // connected-component analysis. The "far side" of the desert then counts
  // as a separate logical island and earns an outer-island chip even though
  // it's land-connected through the desert. Used by Through the Desert.
  desertIsBoundary?: boolean;
  // Forgotten Tribe: tribe-token placements per board layout. The 3-4p set
  // applies to the base layout; the 5-6p set replaces it when the larger
  // board is generated.
  tribeTokens?: ScenarioTribeTokenDef[];
  tribeTokens5_6?: ScenarioTribeTokenDef[];
  // Fog Island: coordinates of hexes that start under fog. Revealed (and
  // removed from `state.unrevealedFogHexes`) when a settlement / road /
  // ship is built adjacent to them.
  fogHexes?: { q: number; r: number }[];
  fogHexes5_6?: { q: number; r: number }[];
  // Pirate Islands: starting fleet anchor + strength. The fleet sits on
  // this sea hex; players attack it via the `attackPirateFleet` action
  // and the +2 VP defeat bonus goes to whoever lands the killing blow.
  pirateFleet?: { q: number; r: number; strength: number };
  pirateFleet5_6?: { q: number; r: number; strength: number };
  // Cloth for Catan: hexes that produce cloth tokens instead of their
  // regular resource on roll. Overlaid on whatever the underlying terrain
  // is — the scenario chooses which hexes (typically the small outer
  // islands).
  clothHexes?: { q: number; r: number }[];
  clothHexes5_6?: { q: number; r: number }[];
  // Modular layouts (Phase 7+). When set, the generator uses these in
  // preference to the legacy fixed `hexes` field. Per-player-count buckets
  // so scenarios like Heading for New Shores can declare distinct 3p vs 4p
  // frames as printed in the rulebook. `layout4p` defaults to `layout3p`,
  // `layout5_6p` defaults to itself or — for backwards compat — to the
  // legacy `hexes5_6` data.
  layout3p?: ScenarioLayout;
  layout4p?: ScenarioLayout;
  layout5_6p?: ScenarioLayout;
}

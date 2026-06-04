import type { Terrain, PortType, TribeTokenType } from '../../../types';

// Shared modular layout schema lives in the board layer (used by both the
// Seafarers scenario set and the base-game Fun Maps set). Re-exported here
// for back-compat with the existing scenario files under this directory.
export type {
  ScenarioHexDef,
  ScenarioPortDef,
  ScenarioPosition,
  ScenarioPositionKind,
  ScenarioPortAnchor,
  ScenarioPools,
  ScenarioTokenConstraints,
  ScenarioLayout,
} from '../../../board/scenarioTypes';

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
  hexes: import('../../../board/scenarioTypes').ScenarioHexDef[];
  ports: import('../../../board/scenarioTypes').ScenarioPortDef[];
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
  hexes5_6?: import('../../../board/scenarioTypes').ScenarioHexDef[];
  ports5_6?: import('../../../board/scenarioTypes').ScenarioPortDef[];
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
  layout3p?: import('../../../board/scenarioTypes').ScenarioLayout;
  layout4p?: import('../../../board/scenarioTypes').ScenarioLayout;
  layout5_6p?: import('../../../board/scenarioTypes').ScenarioLayout;
}

// Re-export `Terrain` / `PortType` here too so callers that import them
// alongside the scenario types don't have to chase the long relative path.
export type { Terrain, PortType };

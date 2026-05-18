import type { Terrain, PortType } from '../../../types';

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

export interface Scenario {
  id: string;
  name: string;
  // Full hex grid for the 3-4 player variant. Anything not listed is
  // implicitly absent.
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
  // still overridable by the host).
  defaultVpToWin: number;
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
}

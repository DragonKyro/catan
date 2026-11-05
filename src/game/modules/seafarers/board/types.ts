import type { Terrain, PortType } from '../../../types';

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

// Board references declared on axial coordinates, resolved to ids once the
// board graph exists. Corners run clockwise from north-east (0 NE, 1 SE,
// 2 S, 3 SW, 4 NW, 5 N); an edge `direction` d is the side between corners
// d and d+1 (0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE).
export interface HexRef {
  q: number;
  r: number;
}
export interface VertexRef {
  q: number;
  r: number;
  corner: 0 | 1 | 2 | 3 | 4 | 5;
}
export interface EdgeRef {
  q: number;
  r: number;
  direction: 0 | 1 | 2 | 3 | 4 | 5;
}

// Forgotten Tribe: what the tribe has placed on which edges.
export interface ScenarioTribeDef {
  victoryPoints: EdgeRef[];
  devCards: EdgeRef[];
  ports: EdgeRef[];
  // Port tokens for `ports`: shuffled ("randomly place ports face up"),
  // unless `fixedPortTypes` (the map prints them face up).
  portTypes: PortType[];
  fixedPortTypes?: boolean;
}

// Cloth for Catan village: a number disc on a small-island intersection.
export interface ScenarioVillageDef extends VertexRef {
  number: number;
}

// Wonders of Catan marker intersections.
export interface ScenarioWonderSitesDef {
  greatWall: VertexRef[];
  greatBridge: VertexRef[];
  lighthouse?: VertexRef[];
  // "X" markers next to the Great Bridge markers (no starting settlements).
  xMarkers: VertexRef[];
}

// Pirate Islands: one player's slot (rulebook colors, in seat order).
export interface ScenarioPirateSlotDef {
  color: string;
  // Settlement + ship placed for this player before setup.
  settlement: VertexRef;
  ship: EdgeRef;
  fortress: VertexRef;
  beachhead: VertexRef;
}

export interface ScenarioPirateIslandsDef {
  // Fleet loop in travel order.
  path: HexRef[];
  // Index into `path` where the fleet starts.
  start: number;
  // Seafarers 5-6: while the fleet is on this hex, it doesn't attack.
  noAttackHex?: HexRef;
  slots: ScenarioPirateSlotDef[];
  // Slot indices by player count (e.g. 3p skips the white slot).
  slotsByPlayers: Record<number, number[]>;
}

// Map-specific mechanic data for one board size.
export interface ScenarioExtras {
  tribe?: ScenarioTribeDef;
  villages?: ScenarioVillageDef[];
  wonderSites?: ScenarioWonderSitesDef;
  pirateIslands?: ScenarioPirateIslandsDef;
  // Island ids are assigned at generation; these hexes name the islands
  // starting settlements may use (Cloth for Catan: the two large islands).
  startingIslandHexes?: HexRef[];
  // Land groups the map outlines as ONE island although sea separates them
  // (Heading for New Shores 5-6: the dark-blue outlines wrap each pair of
  // eastern islets with the sea between). One hex per island to merge; the
  // group counts as one island for the bonus and home islands.
  islandGroups?: HexRef[][];
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
  // Where players may put their starting settlements. Most scenarios
  // restrict setup to the main island and reward expansion onto outer
  // islands during the game; a few (Four Islands, Fog Islands, New World)
  // allow starting on any island — those become the player's home islands.
  // 'listedIslands' = the islands named by `extras.startingIslandHexes`.
  startingPlacementZone: 'mainIslandOnly' | 'anyIsland' | 'listedIslands';
  // When true, every island (including the largest) pays its bonus to
  // players who don't start there. Used with 'anyIsland' setups.
  bonusOnEveryIsland?: boolean;
  // No pirate in this scenario (Wonders of Catan).
  noPirate?: boolean;
  // Longest Route / Largest Army tiles returned to the box.
  noLongestRoad?: boolean;
  noLargestArmy?: boolean;
  // Cloth for Catan: three starting settlements.
  setupRounds?: 3;
  // Forgotten Tribe: settlements and the robber only on numbered hexes.
  numberedHexesOnly?: boolean;
  // Map-specific mechanic data by board size.
  extras3_4?: ScenarioExtras;
  extras5_6?: ScenarioExtras;
  // When true, desert hexes act as island boundaries (like sea) during
  // connected-component analysis. The "far side" of the desert then counts
  // as a separate logical island and earns an outer-island chip even though
  // it's land-connected through the desert. Used by Through the Desert.
  desertIsBoundary?: boolean;
  // Fog Island: coordinates of hexes that start under fog. Revealed (and
  // removed from `state.unrevealedFogHexes`) when a settlement / road /
  // ship is built adjacent to them.
  fogHexes?: { q: number; r: number }[];
  fogHexes5_6?: { q: number; r: number }[];
  // Optional separate pool used to populate fog cells with random terrain
  // and tokens. When set, fog cells skip the main `layout.pools` and draw
  // from here instead (matching the "facedown chits" rulebook semantics).
  fogPools?: import('../../../board/fogPoolInjection').FogPoolDef;
  fogPools5_6?: import('../../../board/fogPoolInjection').FogPoolDef;
  // Modular layouts (Phase 7+). When set, the generator uses these in
  // preference to the legacy fixed `hexes` field. Per-player-count buckets
  // so scenarios like Heading for New Shores can declare distinct 3p vs 4p
  // frames as printed in the rulebook. `layout4p` defaults to `layout3p`,
  // `layout5_6p` defaults to itself or — for backwards compat — to the
  // legacy `hexes5_6` data.
  layout3p?: import('../../../board/scenarioTypes').ScenarioLayout;
  layout4p?: import('../../../board/scenarioTypes').ScenarioLayout;
  layout5_6p?: import('../../../board/scenarioTypes').ScenarioLayout;
  // New World: the board is dealt at random every game (land / sea shape,
  // terrain, number discs, harbors — see ./newWorldBoard.ts). When set, the
  // generator calls it with the seeded RNG instead of reading the layouts
  // above; it returns a fully pinned layout and the advanced RNG.
  randomLayout?: (
    numPlayers: number,
    rngState: number,
  ) => [import('../../../board/scenarioTypes').ScenarioLayout, number];
  // The robber starts beside the board (`state.robberActive = false`) and
  // enters on the first 7 / Knight (New World: "Place the robber and pirate
  // on the indicated locations" — both on the frame).
  robberStartsOffBoard?: boolean;
}

// Re-export `Terrain` / `PortType` here too so callers that import them
// alongside the scenario types don't have to chase the long relative path.
export type { Terrain, PortType };

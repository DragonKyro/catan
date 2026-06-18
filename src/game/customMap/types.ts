import type { ScenarioLayout } from '../board/scenarioTypes';
import type { FogPoolDef } from '../board/fogPoolInjection';

// Terrain + token pool consumed by fog tiles. Reuses the shared shape
// from the board layer so the custom-map generator and the Seafarers
// generator inject fog pools identically.
export type FogPools = FogPoolDef;

// Custom user-authored map. Persisted as JSON via `serializeCustomMap` and
// loaded via `parseCustomMap`. The `layout` field is the existing
// `ScenarioLayout` shape that materializer/assembler already consume — so a
// user map flows through the engine via exactly the same code path as the
// shipped base-game Fun Maps and Seafarers scenarios.
export interface CustomMap {
  schema: 'catan-custom-map';
  version: number;
  id: string;
  name: string;
  description?: string;
  minPlayers: number;
  maxPlayers: number;
  // VP target the lobby suggests when this map is selected. Falls back to
  // the per-player-count default (10) when absent.
  defaultVpToWin?: number;
  // When true, Seafarers routing is used at game start (islands, fog,
  // pirate, gold-resource pick on production). When false, the map runs as
  // a base-game scenario.
  seafarers: boolean;
  // Seafarers-only: hexes that start under fog. Each entry must reference a
  // land hex listed in `layout.positions`. They take their terrain + token
  // from `fogPools` (NOT from `layout.pools`) at game start, so reveals
  // surface random-but-fair resources without leaking the main map's pool.
  fogHexes: { q: number; r: number }[];
  // Seafarers-only: separate terrain + token pool used to populate fog
  // tiles. `fogPools.terrainCounts` sums to `fogHexes.length`; tokens
  // length equals fogHexes.length minus pool-drawn non-producing
  // terrains (desert / etc.), same rule as the main pool.
  fogPools?: FogPools;
  // The actual board layout (positions, port anchors, pools). See
  // [src/game/board/scenarioTypes.ts] for the shape.
  layout: ScenarioLayout;
}

export const CUSTOM_MAP_SCHEMA = 'catan-custom-map' as const;
export const CUSTOM_MAP_FILE_VERSION = 1;

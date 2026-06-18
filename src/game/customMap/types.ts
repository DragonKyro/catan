import type { ScenarioLayout } from '../board/scenarioTypes';

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
  // land hex listed in `layout.positions`.
  fogHexes: { q: number; r: number }[];
  // The actual board layout (positions, port anchors, pools). See
  // [src/game/board/scenarioTypes.ts] for the shape.
  layout: ScenarioLayout;
}

export const CUSTOM_MAP_SCHEMA = 'catan-custom-map' as const;
export const CUSTOM_MAP_FILE_VERSION = 1;

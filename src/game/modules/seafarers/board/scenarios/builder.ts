import type {
  Scenario,
  ScenarioHexDef,
  ScenarioPortDef,
  ScenarioTribeTokenDef,
} from '../types';
import { fillSea } from './helpers';

export interface ScenarioBlueprint {
  id: string;
  name: string;
  defaultIslandBonusVp: number;
  defaultVpToWin: number;
  // Optional VP override for the 5-6 player layout (official scenarios add
  // ~1-2 VP because the larger board has more island-bonus chips to claim).
  // Falls back to `defaultVpToWin` when absent.
  defaultVpToWin5_6?: number;
  // Player-count window. `maxPlayers` is implicitly capped at 4 unless a 5-6
  // layout is supplied below.
  minPlayers: number;
  maxPlayers: number;
  // Optional. Defaults to 'mainIslandOnly' (the standard Seafarers rule:
  // starting settlements go on the main island, outer islands are won by
  // expansion). Scenarios that explicitly allow multi-island starts (Four
  // Islands) override this.
  startingPlacementZone?: 'mainIslandOnly' | 'anyIsland';
  // Optional. When true, desert hexes act as island boundaries (used by
  // Through the Desert so the far side earns an outer-island chip).
  desertIsBoundary?: boolean;
  // Optional. Forgotten Tribe token placements.
  tribeTokens?: ScenarioTribeTokenDef[];
  tribeTokens5_6?: ScenarioTribeTokenDef[];
  // Optional. Fog Island hex coordinates (hidden at start, revealed on
  // adjacent build).
  fogHexes?: { q: number; r: number }[];
  fogHexes5_6?: { q: number; r: number }[];
  // Optional. Pirate Islands fleet anchor + initial strength.
  pirateFleet?: { q: number; r: number; strength: number };
  pirateFleet5_6?: { q: number; r: number; strength: number };
  // Optional. Cloth for Catan: hexes that produce cloth on roll.
  clothHexes?: { q: number; r: number }[];
  clothHexes5_6?: { q: number; r: number }[];
  // 3-4 player layout.
  land: ScenarioHexDef[];
  ports: ScenarioPortDef[];
  // Optional 5-6 player layout. If provided, used when numPlayers >= 5.
  // Provide either the full `land5_6` (replaces land) OR `landExtra5_6`
  // (added on top of `land`); the builder concatenates and de-duplicates.
  land5_6?: ScenarioHexDef[];
  landExtra5_6?: ScenarioHexDef[];
  ports5_6?: ScenarioPortDef[];
}

const BASE_RADIUS = 3;
const LARGE_RADIUS = 4;

export function buildScenario(bp: ScenarioBlueprint): Scenario {
  const land34 = bp.land;
  const hexes = [...land34, ...fillSea(land34, BASE_RADIUS)];

  let hexes5_6: ScenarioHexDef[] | undefined;
  let ports5_6: ScenarioPortDef[] | undefined;
  if (bp.land5_6 || bp.landExtra5_6) {
    const seen = new Set<string>();
    const combined: ScenarioHexDef[] = [];
    for (const h of bp.land5_6 ?? [...land34, ...(bp.landExtra5_6 ?? [])]) {
      const key = `${h.q},${h.r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(h);
    }
    hexes5_6 = [...combined, ...fillSea(combined, LARGE_RADIUS)];
    ports5_6 = bp.ports5_6 ?? bp.ports;
  }

  const scenario: Scenario = {
    id: bp.id,
    name: bp.name,
    hexes,
    ports: bp.ports,
    defaultIslandBonusVp: bp.defaultIslandBonusVp,
    defaultVpToWin: bp.defaultVpToWin,
    minPlayers: bp.minPlayers,
    maxPlayers: bp.maxPlayers,
    startingPlacementZone: bp.startingPlacementZone ?? 'mainIslandOnly',
  };
  if (hexes5_6) scenario.hexes5_6 = hexes5_6;
  if (ports5_6) scenario.ports5_6 = ports5_6;
  if (bp.defaultVpToWin5_6 != null) scenario.defaultVpToWin5_6 = bp.defaultVpToWin5_6;
  if (bp.desertIsBoundary) scenario.desertIsBoundary = true;
  if (bp.tribeTokens) scenario.tribeTokens = bp.tribeTokens;
  if (bp.tribeTokens5_6) scenario.tribeTokens5_6 = bp.tribeTokens5_6;
  if (bp.fogHexes) scenario.fogHexes = bp.fogHexes;
  if (bp.fogHexes5_6) scenario.fogHexes5_6 = bp.fogHexes5_6;
  if (bp.pirateFleet) scenario.pirateFleet = bp.pirateFleet;
  if (bp.pirateFleet5_6) scenario.pirateFleet5_6 = bp.pirateFleet5_6;
  if (bp.clothHexes) scenario.clothHexes = bp.clothHexes;
  if (bp.clothHexes5_6) scenario.clothHexes5_6 = bp.clothHexes5_6;
  return scenario;
}

import type { Scenario, ScenarioHexDef, ScenarioPortDef } from '../types';
import { fillSea } from './helpers';

export interface ScenarioBlueprint {
  id: string;
  name: string;
  defaultIslandBonusVp: number;
  defaultVpToWin: number;
  // Player-count window. `maxPlayers` is implicitly capped at 4 unless a 5-6
  // layout is supplied below.
  minPlayers: number;
  maxPlayers: number;
  // Optional. Defaults to 'mainIslandOnly' (the standard Seafarers rule:
  // starting settlements go on the main island, outer islands are won by
  // expansion). Scenarios that explicitly allow multi-island starts (Four
  // Islands) override this.
  startingPlacementZone?: 'mainIslandOnly' | 'anyIsland';
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
  return scenario;
}

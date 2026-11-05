import type {
  Scenario,
  ScenarioHexDef,
  ScenarioLayout,
  ScenarioPortDef,
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
  startingPlacementZone?: Scenario['startingPlacementZone'];
  bonusOnEveryIsland?: boolean;
  noPirate?: boolean;
  noLongestRoad?: boolean;
  noLargestArmy?: boolean;
  setupRounds?: 3;
  numberedHexesOnly?: boolean;
  extras3_4?: Scenario['extras3_4'];
  extras5_6?: Scenario['extras5_6'];
  // Optional. When true, desert hexes act as island boundaries (used by
  // Through the Desert so the far side earns an outer-island chip).
  desertIsBoundary?: boolean;
  // Optional. Fog Island hex coordinates (hidden at start, revealed on
  // adjacent build).
  fogHexes?: { q: number; r: number }[];
  fogHexes5_6?: { q: number; r: number }[];
  // Optional. Separate terrain + token pool consumed by fog cells.
  fogPools?: import('../../../../board/fogPoolInjection').FogPoolDef;
  fogPools5_6?: import('../../../../board/fogPoolInjection').FogPoolDef;
  // ----- Legacy fixed layout (per-hex terrain + token). Kept for scenarios
  // that haven't migrated to the modular format yet. ----------------------
  land?: ScenarioHexDef[];
  ports?: ScenarioPortDef[];
  land5_6?: ScenarioHexDef[];
  landExtra5_6?: ScenarioHexDef[];
  ports5_6?: ScenarioPortDef[];
  // ----- Modular layouts (frame + pools). When provided, take priority
  // over `land`/`ports`. `layout4p` defaults to `layout3p` when absent. ---
  layout3p?: ScenarioLayout;
  layout4p?: ScenarioLayout;
  layout5_6p?: ScenarioLayout;
}

const BASE_RADIUS = 3;
const LARGE_RADIUS = 4;

export function buildScenario(bp: ScenarioBlueprint): Scenario {
  const isModular = bp.layout3p != null;
  if (!isModular && !bp.land) {
    throw new Error(
      `Scenario "${bp.id}": must provide either a modular layout3p or a legacy land array`,
    );
  }

  // Legacy path — fill sea hexes inside the radius and emit fixed-content
  // ScenarioHexDef arrays as before. Modular scenarios skip this; their
  // hexes get materialised by the generator at game-start from their pools.
  let hexes: ScenarioHexDef[] = [];
  let hexes5_6: ScenarioHexDef[] | undefined;
  let ports5_6: ScenarioPortDef[] | undefined;
  if (!isModular) {
    const land34 = bp.land!;
    hexes = [...land34, ...fillSea(land34, BASE_RADIUS)];

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
  }

  const scenario: Scenario = {
    id: bp.id,
    name: bp.name,
    hexes,
    ports: bp.ports ?? [],
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
  if (bp.fogHexes) scenario.fogHexes = bp.fogHexes;
  if (bp.fogHexes5_6) scenario.fogHexes5_6 = bp.fogHexes5_6;
  if (bp.fogPools) scenario.fogPools = bp.fogPools;
  if (bp.fogPools5_6) scenario.fogPools5_6 = bp.fogPools5_6;
  if (bp.bonusOnEveryIsland) scenario.bonusOnEveryIsland = true;
  if (bp.noPirate) scenario.noPirate = true;
  if (bp.noLongestRoad) scenario.noLongestRoad = true;
  if (bp.noLargestArmy) scenario.noLargestArmy = true;
  if (bp.setupRounds) scenario.setupRounds = bp.setupRounds;
  if (bp.numberedHexesOnly) scenario.numberedHexesOnly = true;
  if (bp.extras3_4) scenario.extras3_4 = bp.extras3_4;
  if (bp.extras5_6) scenario.extras5_6 = bp.extras5_6;
  if (bp.layout3p) scenario.layout3p = bp.layout3p;
  if (bp.layout4p) scenario.layout4p = bp.layout4p;
  if (bp.layout5_6p) scenario.layout5_6p = bp.layout5_6p;
  return scenario;
}

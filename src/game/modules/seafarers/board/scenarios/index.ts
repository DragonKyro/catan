import type { Scenario } from '../types';
import { headingForNewShores } from './headingForNewShores';
import { fourIslands } from './fourIslands';
import { fogIsland } from './fogIsland';
import { throughTheDesert } from './throughTheDesert';
import { newWorld } from './newWorld';
import { pirateIslands } from './pirateIslands';
import { forgottenTribe } from './forgottenTribe';
import { clothForCatan } from './clothForCatan';
import { wondersOfCatan } from './wondersOfCatan';

const SCENARIO_LIST: Scenario[] = [
  headingForNewShores,
  fourIslands,
  fogIsland,
  throughTheDesert,
  newWorld,
  pirateIslands,
  forgottenTribe,
  clothForCatan,
  wondersOfCatan,
];

export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(
  SCENARIO_LIST.map((s) => [s.id, s]),
);

// Preserve the canonical display order so the UI dropdown lines up with
// rulebook ordering (intro scenario first, themed scenarios after).
export const SCENARIO_ORDER: { id: string; label: string }[] = SCENARIO_LIST.map(
  (s) => ({ id: s.id, label: s.name }),
);

export const DEFAULT_SCENARIO_ID = headingForNewShores.id;

export function getScenario(id: string | undefined): Scenario {
  if (!id) return SCENARIOS[DEFAULT_SCENARIO_ID]!;
  const s = SCENARIOS[id];
  if (!s) throw new Error(`Unknown Seafarers scenario: ${id}`);
  return s;
}

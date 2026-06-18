import type { Scenario } from '../types';
import { headingForNewShores } from './headingForNewShores';
import { headingForNewShores2 } from './headingForNewShores2';
import { fourIslands } from './fourIslands';
import { fourIslands2 } from './fourIslands2';
import { fogIsland } from './fogIsland';
import { fogIsland2 } from './fogIsland2';
import { throughTheDesert } from './throughTheDesert';
import { throughTheDesert2 } from './throughTheDesert2';
import { newWorld } from './newWorld';
import { pirateIslands } from './pirateIslands';
import { forgottenTribe } from './forgottenTribe';
import { clothForCatan } from './clothForCatan';
import { wondersOfCatan } from './wondersOfCatan';

const SCENARIO_LIST: Scenario[] = [
  headingForNewShores,
  headingForNewShores2,
  fourIslands,
  fourIslands2,
  fogIsland,
  fogIsland2,
  throughTheDesert,
  throughTheDesert2,
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

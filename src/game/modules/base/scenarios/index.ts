import { standard } from './standard';
import { goldRush } from './goldRush';
import { volcano } from './volcano';
import { blackForest } from './blackForest';
import { diamond } from './diamond';
import { gear } from './gear';
import { lakes } from './lakes';
import { pond } from './pond';
import { twirl } from './twirl';
import type { BaseScenario } from './types';

// Registry of base-game scenarios. The "Standard" entry produces the legacy
// hardcoded board; everything else is a colonist.io-style Fun Map shipped
// through the modular layout system.
//
// Order here is the order shown in the lobby dropdown: Standard first (the
// default), then Fun Maps roughly grouped by "shape variants" then "mechanic
// variants."

const BASE_SCENARIO_LIST: BaseScenario[] = [
  standard,
  goldRush,
  volcano,
  blackForest,
  diamond,
  gear,
  lakes,
  pond,
  twirl,
];

export const BASE_SCENARIOS: Record<string, BaseScenario> = Object.fromEntries(
  BASE_SCENARIO_LIST.map((s) => [s.id, s]),
);

export const BASE_SCENARIO_ORDER: { id: string; label: string }[] =
  BASE_SCENARIO_LIST.map((s) => ({ id: s.id, label: s.name }));

export const DEFAULT_BASE_SCENARIO_ID = standard.id;

export function getBaseScenario(id: string | undefined): BaseScenario {
  if (!id) return standard;
  const s = BASE_SCENARIOS[id];
  if (!s) throw new Error(`Unknown base scenario: ${id}`);
  return s;
}

export type { BaseScenario };

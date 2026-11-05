import { standard } from './standard';
import { beginner } from './beginner';
import { goldRush } from './goldRush';
import { volcano } from './volcano';
import { blackForest } from './blackForest';
import { diamond } from './diamond';
import { gear } from './gear';
import { lakes } from './lakes';
import { pond } from './pond';
import { twirl } from './twirl';
import { ckFirstGame } from '../../citiesAndKnights/board/firstGame';
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
  // The rulebooks' fixed board with printed starting pieces.
  beginner,
  goldRush,
  volcano,
  blackForest,
  diamond,
  gear,
  lakes,
  pond,
  twirl,
  ckFirstGame,
];

export const BASE_SCENARIOS: Record<string, BaseScenario> = Object.fromEntries(
  BASE_SCENARIO_LIST.map((s) => [s.id, s]),
);

export const BASE_SCENARIO_ORDER: { id: string; label: string }[] =
  BASE_SCENARIO_LIST.map((s) => ({ id: s.id, label: s.name }));

export const DEFAULT_BASE_SCENARIO_ID = standard.id;

// May this map be played with the given expansions?
export function baseScenarioAllowed(s: BaseScenario, expansions: readonly string[]): boolean {
  if (s.onlyWithExpansion && !expansions.includes(s.onlyWithExpansion)) return false;
  return !(s.notWithExpansions ?? []).some((e) => expansions.includes(e));
}

export function getBaseScenario(id: string | undefined): BaseScenario {
  if (!id) return standard;
  const s = BASE_SCENARIOS[id];
  if (!s) throw new Error(`Unknown base scenario: ${id}`);
  return s;
}

export type { BaseScenario };

import type { TradersScenario } from './types';
import { riversOfCatan } from './riversOfCatan';

const TRADERS_SCENARIO_LIST: TradersScenario[] = [riversOfCatan];

export const TRADERS_SCENARIOS: Record<string, TradersScenario> = Object.fromEntries(
  TRADERS_SCENARIO_LIST.map((s) => [s.id, s]),
);

export const TRADERS_SCENARIO_ORDER: { id: string; label: string }[] =
  TRADERS_SCENARIO_LIST.map((s) => ({ id: s.id, label: s.name }));

export function getTradersScenario(id: string): TradersScenario {
  const s = TRADERS_SCENARIOS[id];
  if (!s) throw new Error(`Unknown traders scenario: ${id}`);
  return s;
}

export type { TradersScenario };

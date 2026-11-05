import type { ScenarioPosition } from '../../../../board/scenarioTypes';
import { standardLand5_6 } from '../../../base/scenarios/standardShape';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';

// Shared geometry for the Traders & Barbarians 5-6 boards (2025 T&B 5-6
// rulebook pp. 5-8): the CATAN 5-6 island (30 hexes, rows 3-4-5-6-5-4-3)
// inside its frame. Map facts per scenario are in TB56-MAP-SPEC.

// All 28 number discs of CATAN 5-6: two 2s, two 12s, three of every other
// number. (Barbarian Attack 5-6 "returns the number 2 disc and the number
// 12 disc" and prints one of each on its map, so the set has two of each.)
// Same set as the base game's NUMBER_TOKENS_5_6 (src/game/board/generator.ts).
export const TB_DISCS_5_6: number[] = [
  2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6,
  8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12,
];

// The 16 hexes on the island's coast, clockwise from the top-left.
export const TB_OUTER_RING_5_6: Array<{ q: number; r: number }> = [
  { q: 0, r: -3 },
  { q: 1, r: -3 },
  { q: 2, r: -3 },
  { q: 2, r: -2 },
  { q: 2, r: -1 },
  { q: 2, r: 0 },
  { q: 1, r: 1 },
  { q: 0, r: 2 },
  { q: -1, r: 3 },
  { q: -2, r: 3 },
  { q: -3, r: 3 },
  { q: -3, r: 2 },
  { q: -3, r: 1 },
  { q: -3, r: 0 },
  { q: -2, r: -1 },
  { q: -1, r: -2 },
];

const OUTER = new Set(TB_OUTER_RING_5_6.map((c) => `${c.q},${c.r}`));

// The 14 hexes inside the coast.
export function isInner5_6(q: number, r: number): boolean {
  return !OUTER.has(`${q},${r}`) && standardLand5_6().some((p) => p.q === q && p.r === r);
}

// Land positions with per-hex tweaks, plus the sea frame (radius 4).
export function tbPositions5_6(
  tweak: (p: ScenarioPosition) => ScenarioPosition = (p) => p,
): ScenarioPosition[] {
  const land = standardLand5_6().map(tweak);
  return [...land, ...seaPositionsInDisk(land, 4)];
}

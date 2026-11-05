import type { Hex } from '../types';

// A hex's production numbers. Almost every hex has at most one (its number
// disc); a few scenario hexes carry several through `Hex.extraNumbers`
// (Traders & Barbarians: Rivers of Catan's 2 + 12 hex, Fishing on Catan's
// lake with its printed 2 / 3 / 11 / 12). Production, the robber block, the
// AI's pip math and the renderer all read numbers through these helpers so a
// multi-number hex behaves the same everywhere.

export function hexNumbers(hex: Pick<Hex, 'numberToken' | 'extraNumbers'>): number[] {
  const out: number[] = [];
  if (hex.numberToken !== null) out.push(hex.numberToken);
  if (hex.extraNumbers) out.push(...hex.extraNumbers);
  return out;
}

// Does this hex produce when `roll` is rolled?
export function hexRollsOn(
  hex: Pick<Hex, 'numberToken' | 'extraNumbers'>,
  roll: number,
): boolean {
  if (hex.numberToken === roll) return true;
  return hex.extraNumbers?.includes(roll) ?? false;
}

// Dice combinations (out of 36) that make `n`: the "pips" printed under a
// number disc.
export function numberPips(n: number | null): number {
  if (n === null || n < 2 || n > 12) return 0;
  return 6 - Math.abs(7 - n);
}

// Pips summed over all of a hex's numbers.
export function hexPips(hex: Pick<Hex, 'numberToken' | 'extraNumbers'>): number {
  let pips = 0;
  for (const n of hexNumbers(hex)) pips += numberPips(n);
  return pips;
}

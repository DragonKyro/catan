import type { GameState, PlayerId } from '../types';

// Largest Army holder rules:
// - Awarded to the player with the most knights played, minimum 3.
// - Strict greater-than to take from current holder (ties: holder keeps).
export function calculateLargestArmy(
  state: GameState,
): { holder: PlayerId; size: number } | null {
  const current = state.largestArmy;
  let bestHolder: PlayerId | null = current?.holder ?? null;
  let bestSize = current?.size ?? 2; // threshold to first claim is 3 → start at 2

  for (const p of state.players) {
    const k = p.devCards.playedKnights;
    if (k > bestSize) {
      bestSize = k;
      bestHolder = p.id;
    }
  }

  return bestHolder ? { holder: bestHolder, size: bestSize } : null;
}

import type { GameState, PlayerId } from '../types';

const LONGEST_ROAD_MIN_LENGTH = 5;

// Total victory points for a player.
// `includeHidden` controls whether held VP dev cards are counted (true at
// win-check time and for the player themselves; false when displaying to
// opponents in the UI).
export function calculateVictoryPoints(
  state: GameState,
  playerId: PlayerId,
  includeHidden: boolean,
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  let vp = 0;
  vp += player.settlements.length;
  vp += player.cities.length * 2;
  if (player.hasLongestRoad) vp += 2;
  if (player.hasLargestArmy) vp += 2;
  if (includeHidden) vp += player.devCards.victoryPoints;
  return vp;
}

// Determines the Longest Road holder: the player with the longest road of
// length >= 5. Ties: current holder keeps. If no one qualifies, no holder.
export function calculateLongestRoadHolder(
  state: GameState,
  lengths: Map<PlayerId, number>,
): { holder: PlayerId; length: number } | null {
  const current = state.longestRoad;
  let bestHolder: PlayerId | null = current?.holder ?? null;
  let bestLength = current?.length ?? LONGEST_ROAD_MIN_LENGTH - 1;

  // The current holder's length may have shrunk; recompute their entry.
  if (current) {
    const currentLen = lengths.get(current.holder) ?? 0;
    if (currentLen < LONGEST_ROAD_MIN_LENGTH) {
      bestHolder = null;
      bestLength = LONGEST_ROAD_MIN_LENGTH - 1;
    } else {
      bestLength = currentLen;
    }
  }

  for (const [pid, len] of lengths) {
    if (len < LONGEST_ROAD_MIN_LENGTH) continue;
    if (len > bestLength) {
      bestLength = len;
      bestHolder = pid;
    }
  }

  return bestHolder ? { holder: bestHolder, length: bestLength } : null;
}

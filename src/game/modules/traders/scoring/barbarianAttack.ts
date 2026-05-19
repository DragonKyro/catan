import type { GameState, PlayerId } from '../../../types';

// Sum every defender VP this player has accumulated across all castles
// in the Barbarian Attack scenario. Defender VP is awarded 1 per knight
// brought to a successful defense and stored on `castle.defenderVp`.
// Visible VP — counts toward the public total and the win condition.
export function calculateBarbarianDefenderVp(
  state: GameState,
  playerId: PlayerId,
): number {
  if (!state.castles?.length) return 0;
  let total = 0;
  for (const c of state.castles) {
    total += c.defenderVp[playerId] ?? 0;
  }
  return total;
}

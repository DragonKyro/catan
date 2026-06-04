import type { Action, GameState, PlayerId } from '@/game/types';
import { hasShipAdjacentToFleet } from '@/game/modules/seafarers/actions/attackPirateFleet';

// Pirate Islands: free +2 VP on the killing blow. The attack action costs
// nothing — no resources, no card. Always take it when conditions are met.
// One-per-turn cap is enforced by the engine via `attackedPirateThisTurn`.
export function tryAttackPirateFleet(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  if (!state.pirateFleet) return null;
  if (state.pirateFleet.defeatedBy !== null) return null;
  if (state.attackedPirateThisTurn) return null;
  if (!hasShipAdjacentToFleet(state, playerId)) return null;
  return { type: 'attackPirateFleet', playerId };
}

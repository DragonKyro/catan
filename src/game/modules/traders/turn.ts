import type { GameState, EndTurnAction } from '../../types';
import { handleEndTurn as baseHandleEndTurn } from '../../actions/turn';
import { handleEndTurnWithWagonVote } from './merchantTrains/turn';
import { advanceBarbarians } from './barbarianAttack/advance';
import { resolveCombat } from './barbarianAttack/combat';
import { currentPlayerId } from '../../helpers';

// Unified T&B endTurn wrapper. Routes to the active scenario's flow:
//   - Merchant Trains: opens the wagon-voting phase when a piece was
//     built this turn (handled by `handleEndTurnWithWagonVote`).
//   - Barbarian Attack: advance every barbarian one hex, resolve any
//     combats that just landed, then call the base endTurn to rotate
//     the turn. Combat is inline (no new phase) so the UI sees the
//     post-combat board on the next acting player's turn.
//   - Otherwise (Rivers / Fishing / variant-only games): pass through
//     to the base endTurn.
export function handleEndTurnTraders(
  state: GameState,
  action: EndTurnAction,
): GameState {
  // Merchant Trains takes precedence — the voting phase needs to fire
  // before the turn rotates and would be skipped otherwise. The wrapper
  // itself falls through to base when Merchant Trains isn't active.
  if (state.wateringHoleHexId) {
    return handleEndTurnWithWagonVote(state, action);
  }
  // Barbarian Attack: only the active player's endTurn drives the
  // barbarian-advance loop. Phase/player guards mirror the base handler's
  // first checks so we don't double-advance on bogus calls.
  if (
    state.castles?.length &&
    state.phase === 'main' &&
    action.playerId === currentPlayerId(state) &&
    state.hasRolledThisTurn
  ) {
    let next = advanceBarbarians(state);
    next = resolveCombat(next);
    return baseHandleEndTurn(next, action);
  }
  return baseHandleEndTurn(state, action);
}

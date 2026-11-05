import type { GameState, EndTurnAction } from '../../types';
import { handleEndTurn as baseHandleEndTurn } from '../../actions/turn';
import { handleEndTurnWithWagonVote } from './merchantTrains/turn';
import { handleEndTurnBarbarianAttack } from './barbarianAttack/turn';

// Unified T&B endTurn wrapper. Routes to the active scenario's flow:
//   - Merchant Trains: opens the wagon-voting phase when a piece was
//     built this turn (handled by `handleEndTurnWithWagonVote`).
//   - Barbarian Attack: the end-of-turn knight moves, then the expel
//     step, then the base endTurn (see barbarianAttack/turn.ts).
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
  if (state.barbarianAttack) return handleEndTurnBarbarianAttack(state, action);
  return baseHandleEndTurn(state, action);
}

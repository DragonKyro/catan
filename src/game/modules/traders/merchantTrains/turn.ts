import type { GameState, EndTurnAction } from '../../../types';
import { handleEndTurn as baseHandleEndTurn } from '../../../actions/turn';
import { currentPlayerId } from '../../../helpers';

// Merchant Trains endTurn wrapper. When the active player has built at
// least one piece this turn, open the wagon-voting phase instead of
// advancing the turn immediately. Voting + placement eventually call
// `handleEndTurn` themselves, so the turn does advance — just after the
// wagon lands.
export function handleEndTurnWithWagonVote(
  state: GameState,
  action: EndTurnAction,
): GameState {
  // Merchant-trains scenarios only — fall through to base for the others.
  if (!state.wateringHoleHexId) {
    return baseHandleEndTurn(state, action);
  }
  if (!state.builtThisTurn) {
    return baseHandleEndTurn(state, action);
  }
  if (state.phase !== 'main') {
    // Hand off to base so it can throw the correct phase error.
    return baseHandleEndTurn(state, action);
  }
  if (action.playerId !== currentPlayerId(state)) {
    return baseHandleEndTurn(state, action);
  }
  if (!state.hasRolledThisTurn) {
    return baseHandleEndTurn(state, action);
  }
  // Out of supply? Just end the turn normally — no point opening voting.
  if ((state.wagonSupply ?? 0) <= 0) {
    return baseHandleEndTurn(state, { ...action, type: 'endTurn' });
  }
  return {
    ...state,
    phase: 'wagonVoting',
    wagonVote: {
      acquirerId: action.playerId,
      bids: {},
    },
  };
}

import type { GameState, EndTurnAction } from '../../../types';
import { handleEndTurn as baseHandleEndTurn } from '../../../actions/turn';
import { currentPlayerId } from '../../../helpers';
import { openWagonVote, placeAndFinish } from './voting';
import { legalWagonPlacements } from './trains';

// Merchant Trains endTurn wrapper. A player who built a building in their
// Action phase collected a wagon; ending the turn opens the voting round
// for it. Voting + placement end the turn themselves once the wagon lands.
// With only one place the wagon could go there's nothing to vote on, and
// with none (or an empty supply) the wagon is simply lost.
export function handleEndTurnWithWagonVote(
  state: GameState,
  action: EndTurnAction,
): GameState {
  const legalEnd =
    state.phase === 'main' &&
    action.playerId === currentPlayerId(state) &&
    state.hasRolledThisTurn;
  // Bad calls: let the base handler throw its usual error.
  if (!state.wateringHoleHexId || !legalEnd) return baseHandleEndTurn(state, action);
  if (!state.builtThisTurn) return baseHandleEndTurn(state, action);
  const options = legalWagonPlacements(state);
  if (options.length === 0) {
    return baseHandleEndTurn({ ...state, builtThisTurn: false }, action);
  }
  if (options.length === 1) {
    return placeAndFinish(state, options[0]!, 'onlyOption', null);
  }
  return openWagonVote(state, action.playerId);
}

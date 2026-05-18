import type { GameState, EndTurnAction, WagonVoteState } from '../../../types';
import { handleEndTurn as baseHandleEndTurn } from '../../../actions/turn';
import { currentPlayerId } from '../../../helpers';
import { forceResolveVoting } from './voting';

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
  // Auto-fill AI bids with an abstain (engine handles AI voting at phase
  // entry so the AIDriver — which only fires for the acting player — doesn't
  // need to drive every seat). Humans still see the dialog. If only one
  // human remains and they're absent (e.g. AI-only game), force-resolve.
  const initialVote: WagonVoteState = {
    acquirerId: action.playerId,
    bids: {},
  };
  for (const p of state.players) {
    if (p.isAI) initialVote.bids[p.id] = { cards: {}, target: null };
  }
  const next: GameState = {
    ...state,
    phase: 'wagonVoting',
    wagonVote: initialVote,
  };
  // If all players are AI (or all but the acquirer), resolution is
  // already mathematically determined — kick it now.
  if (Object.keys(initialVote.bids).length === state.players.length) {
    return forceResolveVoting(next);
  }
  return next;
}

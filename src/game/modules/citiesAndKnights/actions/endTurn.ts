import type { EndTurnAction, GameState, KnightRecord, VertexId } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { handleEndTurn as baseHandleEndTurn } from '../../../actions/turn';
import { progressHandSize } from '../progress/hand';
import { PROGRESS_CARD_HAND_LIMIT } from '../constants';

// End of the Action phase (p.10): the active player must be down to 4
// progress cards. Over the limit, the engine asks for the discards first
// (progressCardDiscard phase) and ends the turn once they're in.
export function handleEndTurnCK(state: GameState, action: EndTurnAction): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot end turn in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.hasRolledThisTurn) throw new Error('Must roll dice before ending turn');
  return endTurnCK(state);
}

export function endTurnCK(state: GameState): GameState {
  const pid = currentPlayerId(state);
  const player = state.players.find((p) => p.id === pid)!;
  const over = progressHandSize(player) - PROGRESS_CARD_HAND_LIMIT;
  if (over > 0) {
    return {
      ...state,
      phase: 'progressCardDiscard',
      progressCardDiscardRequired: { [pid]: over },
      endTurnAfterProgressDiscard: true,
    };
  }
  const next = baseHandleEndTurn(state, { type: 'endTurn', playerId: pid });
  // Per-turn knight flags and this turn's Commercial Harbor end here.
  const knights: Record<VertexId, KnightRecord> = {};
  for (const [vid, k] of Object.entries(next.knights ?? {})) {
    if (!k.activatedThisTurn && !k.promotedThisTurn) {
      knights[vid] = k;
      continue;
    }
    const { activatedThisTurn: _a, promotedThisTurn: _p, ...rest } = k;
    knights[vid] = rest;
  }
  return {
    ...next,
    knights,
    activatedKnightsThisTurn: [],
    commercialHarbor: undefined,
    endTurnAfterProgressDiscard: undefined,
  };
}

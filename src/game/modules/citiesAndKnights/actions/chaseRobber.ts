import type { ChaseRobberAction, GameState } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { knightAt, vertexAdjacentToRobber } from '../knights/state';

// "Chase the Robber" — an active knight adjacent to the robber triggers a
// robber move. The knight becomes inactive immediately, and the engine
// enters the standard moveRobber phase so the player picks the destination
// + steal target. Returns to main afterwards.
//
// Only legal once the robber is active (post-first-barbarian-attack).
export function handleChaseRobber(
  state: GameState,
  action: ChaseRobberAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot chase robber in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.robberActive) {
    throw new Error("Robber isn't active yet — wait for the first barbarian attack");
  }
  const k = knightAt(state, action.vertex);
  if (!k) throw new Error('No knight at that vertex');
  if (k.playerId !== action.playerId) throw new Error('Not your knight');
  if (!k.active) throw new Error('Knight is not active');
  if (state.activatedKnightsThisTurn?.includes(action.vertex)) {
    throw new Error("Knight was activated this turn — it can't act yet");
  }
  if (!vertexAdjacentToRobber(state, action.vertex)) {
    throw new Error('Knight is not adjacent to the robber');
  }

  return {
    ...state,
    // Knight goes inactive even before the moveRobber phase resolves —
    // the action's "cost" is the knight standing down.
    knights: {
      ...(state.knights ?? {}),
      [action.vertex]: { ...k, active: false },
    },
    phase: 'moveRobber',
    pendingRobberMove: { reason: 'knight', returnTo: 'main' },
  };
}

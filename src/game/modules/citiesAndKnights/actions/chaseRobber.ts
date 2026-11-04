import type { ChaseRobberAction, GameState } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { knightAt, vertexAdjacentToRobber } from '../knights/state';
import { knightCanAct } from '../knights/legal';

// Chase away the robber (p.10): an acting knight on a corner of the robber's
// hex "Activates the Robber" — the player moves it and steals as on a 7 —
// and is laid down. Only once the robber is on the board.
export function handleChaseRobber(state: GameState, action: ChaseRobberAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot chase robber in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.robberActive) {
    throw new Error("The robber isn't on the board until the first barbarian attack");
  }
  const k = knightAt(state, action.vertex);
  if (!k) throw new Error('No knight at that vertex');
  if (k.playerId !== action.playerId) throw new Error('Not your knight');
  if (!k.active) throw new Error('Knight is not active');
  if (!knightCanAct(state, action.vertex)) {
    throw new Error("Knight was activated this turn — it can't act yet");
  }
  if (!vertexAdjacentToRobber(state, action.vertex)) {
    throw new Error('Knight is not next to the robber');
  }
  return {
    ...state,
    knights: { ...(state.knights ?? {}), [action.vertex]: { ...k, active: false } },
    phase: 'moveRobber',
    pendingRobberMove: { reason: 'knight', returnTo: 'main' },
  };
}

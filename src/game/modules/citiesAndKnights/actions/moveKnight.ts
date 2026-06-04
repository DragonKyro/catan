import type { GameState, MoveKnightAction } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { knightAt } from '../knights/state';
import { reachableEmptyVertices } from '../knights/graph';

// Move an active knight along your network to an empty intersection. After
// the move the knight is laid down (inactive). A knight may not act on the
// turn it was activated (rulebook p.9).
export function handleMoveKnight(
  state: GameState,
  action: MoveKnightAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot move knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const k = knightAt(state, action.from);
  if (!k) throw new Error('No knight at the source vertex');
  if (k.playerId !== action.playerId) throw new Error('Not your knight');
  if (!k.active) throw new Error('Knight is not active');
  if (state.activatedKnightsThisTurn?.includes(action.from)) {
    throw new Error("Knight was activated this turn — it can't act yet");
  }

  const dests = reachableEmptyVertices(state, action.playerId, action.from);
  if (!dests.has(action.to)) {
    throw new Error('Destination is not reachable from this knight');
  }

  const next: GameState = {
    ...state,
    knights: {
      ...(state.knights ?? {}),
      [action.to]: { ...k, active: false },
    },
  };
  // Remove the source entry without leaving an undefined slot in the map.
  delete next.knights![action.from];
  return next;
}

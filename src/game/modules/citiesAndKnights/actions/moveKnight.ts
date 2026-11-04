import type { GameState, MoveKnightAction } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { knightAt } from '../knights/state';
import { knightCanAct, legalKnightMoves } from '../knights/legal';

// Move a knight (p.9): an acting knight travels along your continuous
// routes, past your own buildings and knights but not other players'
// pieces, and stops on an empty intersection. It is then laid down.
export function handleMoveKnight(state: GameState, action: MoveKnightAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot move knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const k = knightAt(state, action.from);
  if (!k) throw new Error('No knight at the source vertex');
  if (k.playerId !== action.playerId) throw new Error('Not your knight');
  if (!k.active) throw new Error('Knight is not active');
  if (!knightCanAct(state, action.from)) {
    throw new Error("Knight was activated this turn — it can't act yet");
  }
  if (!legalKnightMoves(state, action.from).includes(action.to)) {
    throw new Error('Destination is not reachable from this knight');
  }
  const knights = { ...(state.knights ?? {}) };
  delete knights[action.from];
  knights[action.to] = { ...k, active: false };
  return { ...state, knights };
}

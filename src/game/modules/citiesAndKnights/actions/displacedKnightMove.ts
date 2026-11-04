import type { DisplacedKnightMoveAction, GameState, PlayerId, VertexId } from '../../../types';
import { reachableEmptyVertices } from '../knights/graph';
import { resumeFlow } from '../flow';

// Where a displaced knight may go (p.10): the "Move a Knight" rules from the
// intersection it was knocked off — along its owner's routes, past their own
// pieces, onto an empty intersection.
export function displacedKnightDestinations(state: GameState): VertexId[] {
  const ctx = state.pendingKnightMove;
  if (!ctx) return [];
  return [...reachableEmptyVertices(state, ctx.playerId as PlayerId, ctx.sourceVertex)];
}

// The displaced knight's owner puts it back on the board (status unchanged).
export function handleDisplacedKnightMove(
  state: GameState,
  action: DisplacedKnightMoveAction,
): GameState {
  if (state.phase !== 'displacedKnightMove') {
    throw new Error(`Cannot move displaced knight in phase ${state.phase}`);
  }
  const ctx = state.pendingKnightMove;
  if (!ctx) throw new Error('No pending displaced knight');
  if (action.playerId !== ctx.playerId) throw new Error('Not the displaced knight owner');
  if (!ctx.knightStrength) throw new Error('Pending knight has no recorded strength');
  if (!displacedKnightDestinations(state).includes(action.to)) {
    throw new Error('Destination is not reachable from where the knight stood');
  }
  return resumeFlow({
    ...state,
    knights: {
      ...(state.knights ?? {}),
      [action.to]: {
        playerId: action.playerId,
        strength: ctx.knightStrength,
        active: ctx.knightActive ?? false,
      },
    },
    pendingKnightMove: undefined,
  });
}

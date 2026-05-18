import type { DisplacedKnightMoveAction, GameState } from '../../../types';
import { reachableEmptyVertices } from '../knights/graph';

// Forced follow-up to a displaceKnight: the displaced piece's owner picks
// an empty vertex reachable along their network, and the engine drops the
// knight back on the board at that vertex (status unchanged from before
// the displacement).
export function handleDisplacedKnightMove(
  state: GameState,
  action: DisplacedKnightMoveAction,
): GameState {
  if (state.phase !== 'displacedKnightMove') {
    throw new Error(`Cannot move displaced knight in phase ${state.phase}`);
  }
  if (!state.pendingKnightMove) throw new Error('No pending displaced knight');
  if (action.playerId !== state.pendingKnightMove.playerId) {
    throw new Error('Not the displaced knight owner');
  }
  const strength = state.pendingKnightMove.knightStrength;
  const wasActive = state.pendingKnightMove.knightActive ?? false;
  if (!strength) throw new Error('Pending knight has no recorded strength');

  // Use the SOURCE vertex as the BFS origin — the rulebook says the piece
  // moves from where it stood, even though the attacker now occupies that
  // spot. Our graph helper treats opposing pieces as blockers, so we
  // temporarily reuse the source vertex (the attacker already sits there
  // — the BFS would normally not be able to leave it, but knights move
  // through their owner's pieces, so this is fine because the BFS starts
  // at the source unconditionally).
  const dests = reachableEmptyVertices(
    state,
    action.playerId,
    state.pendingKnightMove.sourceVertex,
  );
  if (!dests.has(action.to)) {
    throw new Error('Destination is not reachable from the displaced source');
  }

  const next: GameState = {
    ...state,
    knights: {
      ...(state.knights ?? {}),
      [action.to]: {
        playerId: action.playerId,
        strength,
        active: wasActive,
      },
    },
    phase: state.pendingKnightMove.returnTo,
    pendingKnightMove: undefined,
  };
  return next;
}

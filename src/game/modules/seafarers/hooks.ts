import type { EdgeId, GameState, PlayerId, VertexId } from '../../types';
import { updatePlayer } from '../../helpers';
import { revealFogAroundEdge } from './actions/fog';
import { claimIslandBonus, markHomeIslands } from './islandBonus';
import { claimTribeTokensOnEdge, maybeStartTribePortPlacement } from './tribe';
import { updateClothRelations } from './cloth';

// Every Seafarers placement path (build, move, setup, Road Building) runs
// through one of these, so a scenario effect can't be skipped by one path.

// A ship was just placed on `edge` (built, moved, setup, or Road Building).
// `built` = it's a new ship, so it may not move again this turn.
export function afterShipPlaced(
  state: GameState,
  playerId: PlayerId,
  edge: EdgeId,
  opts: { built: boolean },
): GameState {
  let next = state;
  if (opts.built) {
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      builtShipsThisTurn: [...(p.builtShipsThisTurn ?? []), edge],
    }));
  }
  next = claimTribeTokensOnEdge(next, playerId, edge);
  next = updateClothRelations(next);
  next = revealFogAroundEdge(next, edge, playerId);
  next = maybeStartTribePortPlacement(next, playerId);
  return next;
}

export function afterRoadPlaced(
  state: GameState,
  playerId: PlayerId,
  edge: EdgeId,
): GameState {
  let next = updateClothRelations(state);
  next = revealFogAroundEdge(next, edge, playerId);
  return next;
}

export function afterSettlementPlaced(
  state: GameState,
  playerId: PlayerId,
  vertex: VertexId,
  opts: { setup: boolean },
): GameState {
  let next = opts.setup
    ? markHomeIslands(state, playerId, vertex)
    : claimIslandBonus(state, playerId, vertex);
  next = updateClothRelations(next);
  next = maybeStartTribePortPlacement(next, playerId);
  return next;
}

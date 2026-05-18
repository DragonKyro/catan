import type { GameState, MoveShipAction, EdgeId } from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import { canBuildShip, isPirateAdjacent } from '../validation/shipPlacement';
import { revealAdjacentFog } from './fog';

// A ship is "movable" if at least one of its endpoint vertices is an "open
// end" of the player's ship/road network — i.e. has no other piece of the
// player attached (no ship, no road) and no own settlement/city pinning it.
// Pieces at a settled vertex are anchored and cannot be moved (per official
// rule: "ships at a settlement or city cannot be moved").
export function isShipMovable(
  state: GameState,
  playerId: string,
  edgeId: EdgeId,
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  if (!player.ships.includes(edgeId)) return false;
  const edge = state.board.edges[edgeId];
  if (!edge) return false;

  for (const v of edge.vertices) {
    if (player.settlements.includes(v) || player.cities.includes(v)) continue;
    if (vertexBlockedByOpponent(state, playerId, v)) continue;

    // Count player pieces at this vertex other than the source ship.
    let attachments = 0;
    const vDef = state.board.vertices[v]!;
    for (const eid of vDef.edges) {
      if (eid === edgeId) continue;
      if (player.roads.includes(eid)) attachments++;
      if (player.ships.includes(eid)) attachments++;
    }
    if (attachments === 0) return true;
  }
  return false;
}

function vertexBlockedByOpponent(
  state: GameState,
  playerId: string,
  vertexId: string,
): boolean {
  for (const p of state.players) {
    if (p.id === playerId) continue;
    if (p.settlements.includes(vertexId) || p.cities.includes(vertexId)) return true;
  }
  return false;
}

export function handleMoveShip(state: GameState, action: MoveShipAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot move ship in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.movedShipThisTurn) throw new Error('Already moved a ship this turn');
  if (action.from === action.to) throw new Error('Source and destination must differ');
  if (!isShipMovable(state, action.playerId, action.from)) {
    throw new Error('That ship is not movable (must be an open end of your route)');
  }
  if (isPirateAdjacent(state, action.to)) {
    throw new Error('Cannot move a ship adjacent to the pirate');
  }

  // Remove the ship from source first, then check destination validity.
  // Without the removal, canBuildShip would see the source ship and might
  // accept a destination it shouldn't.
  const withoutSource: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === action.playerId
        ? { ...p, ships: p.ships.filter((e) => e !== action.from) }
        : p,
    ),
  };
  if (!canBuildShip(withoutSource, action.playerId, action.to)) {
    throw new Error('Invalid ship move destination');
  }

  let next = updatePlayer(withoutSource, action.playerId, (p) => ({
    ...p,
    ships: [...p.ships, action.to],
    movedShipThisTurn: true,
  }));
  const adj = next.board.edges[action.to]?.hexes ?? [];
  next = revealAdjacentFog(next, adj, action.playerId);
  return next;
}

import type { GameState, PlayerId, EdgeId, VertexId } from '../../../types';
import { classifyEdge } from '../board/edges';

// Seafarers ship rules (rulebook p.2):
//   - Ships go on empty edges of sea hexes (any edge touching a sea hex).
//     Ships and roads may not share an edge.
//   - A new ship must connect to one of your existing ships or buildings —
//     NOT to a road. Roads and ships only meet at your buildings.
//   - Like roads, a ship can't be built past an opponent's building.
//   - No new ship on an edge of the hex occupied by the pirate.
export function canBuildShip(
  state: GameState,
  playerId: PlayerId,
  edgeId: EdgeId,
): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  if (!isShipEdge(state, edgeId)) return false;
  if (isPirateAdjacent(state, edgeId)) return false;
  if (edgeOccupied(state, edgeId)) return false;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  for (const v of edge.vertices) {
    if (player.settlements.includes(v) || player.cities.includes(v)) return true;
    if (vertexBlockedByOpponent(state, playerId, v)) continue;
    if (hasOwnShipAtVertex(state, playerId, v, edgeId)) return true;
  }
  return false;
}

// An edge a ship may ever stand on: one that borders a sea hex, or runs
// along the sea frame (an outer edge with a single hex). The Forgotten
// Tribe's tokens and the Pirate Islands fortresses sit on frame edges, so
// ships must be able to sail there. Edges touching unexplored fog aren't on
// the table yet (and can't be reached before the fog lifts anyway).
export function isShipEdge(state: GameState, edgeId: EdgeId): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  const fog = state.unrevealedFogHexes;
  if (fog && edge.hexes.some((h) => fog.includes(h))) return false;
  if (edge.hexes.length === 1) return true;
  return classifyEdge(state.board, edgeId) !== 'land';
}

export function edgeOccupied(state: GameState, edgeId: EdgeId): boolean {
  for (const p of state.players) {
    if (p.roads.includes(edgeId)) return true;
    if (p.ships.includes(edgeId)) return true;
    if (p.bridges?.includes(edgeId)) return true;
  }
  return false;
}

export function vertexBlockedByOpponent(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
): boolean {
  for (const p of state.players) {
    if (p.id === playerId) continue;
    if (p.settlements.includes(vertexId) || p.cities.includes(vertexId)) return true;
  }
  return false;
}

function hasOwnShipAtVertex(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
  excludingEdge: EdgeId,
): boolean {
  const player = state.players.find((p) => p.id === playerId)!;
  const v = state.board.vertices[vertexId]!;
  for (const eid of v.edges) {
    if (eid === excludingEdge) continue;
    if (player.ships.includes(eid)) return true;
  }
  return false;
}

// True when this edge sits on the pirate's hex — i.e. one of the six sides
// of the pirate's sea hex. Ships may neither be built on these edges nor
// moved to or from them.
export function isPirateAdjacent(state: GameState, edgeId: EdgeId): boolean {
  const pirateHex = state.board.pirateHex;
  if (!pirateHex) return false;
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  return edge.hexes.includes(pirateHex);
}

// Can `playerId` pick up the ship on `edgeId` this turn (ignoring the
// once-per-turn limit)? Rulebook p.2:
//   - not a ship built this turn;
//   - not on an edge of the pirate's hex;
//   - one of its ends is "open": not next to another of your ships or one
//     of your buildings. (Roads don't count — roads and ships only connect
//     at buildings.) A ship with an open end can never sit on a line of
//     ships between two of your buildings, so this also covers the
//     "closed route" rule, including routes an opponent's building cuts.
//   - Cloth for Catan: a route to a village is closed too, so village
//     intersections count like your own buildings here.
export function isShipMovable(
  state: GameState,
  playerId: PlayerId,
  edgeId: EdgeId,
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  if (!player.ships.includes(edgeId)) return false;
  if (player.builtShipsThisTurn?.includes(edgeId)) return false;
  if (isPirateAdjacent(state, edgeId)) return false;
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  const villageVertices = new Set((state.clothVillages ?? []).map((v) => v.vertex));

  for (const v of edge.vertices) {
    if (player.settlements.includes(v) || player.cities.includes(v)) continue;
    if (villageVertices.has(v)) continue;
    if (hasOwnShipAtVertex(state, playerId, v, edgeId)) continue;
    return true;
  }
  return false;
}

// Legal destinations for moving the ship on `from`. Uses the board with the
// ship already lifted, so a destination can't rely on the ship itself.
export function shipMoveDestinations(
  state: GameState,
  playerId: PlayerId,
  from: EdgeId,
): EdgeId[] {
  const lifted = liftShip(state, playerId, from);
  return state.board.edgeIds.filter(
    (eid) => eid !== from && canBuildShip(lifted, playerId, eid),
  );
}

export function liftShip(state: GameState, playerId: PlayerId, edge: EdgeId): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, ships: p.ships.filter((e) => e !== edge) } : p,
    ),
  };
}

// Setup: a ship placed instead of the starting road must touch the
// settlement just placed and stand on an empty ship edge.
export function canPlaceInitialShip(
  state: GameState,
  placedSettlement: VertexId,
  edgeId: EdgeId,
): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  if (edge.vertices[0] !== placedSettlement && edge.vertices[1] !== placedSettlement) {
    return false;
  }
  if (!isShipEdge(state, edgeId)) return false;
  if (isPirateAdjacent(state, edgeId)) return false;
  return !edgeOccupied(state, edgeId);
}

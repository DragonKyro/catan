import type { GameState, PlayerId, EdgeId } from '../../../types';
import { classifyEdge } from '../board/edges';

// A ship can be placed on edge E for player P if:
//   1. E is a coastal or sea edge (never a pure land edge).
//   2. E is currently empty (no road or ship from any player).
//   3. At least one endpoint vertex V of E provides a "launch point":
//        a) P has a settlement or city at V, OR
//        b) P has an adjacent ship that uses V, OR
//        c) P has an adjacent road that uses V AND V is a "coastal" vertex
//           (touches at least one sea hex). Roads can launch ships only
//           where they meet the sea.
//   4. The launch vertex must not be blocked by an opponent's settlement
//      or city (the standard "broken road" rule applies to ships too —
//      you can't extend through an enemy piece).
export function canBuildShip(
  state: GameState,
  playerId: PlayerId,
  edgeId: EdgeId,
): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  if (classifyEdge(state.board, edgeId) === 'land') return false;

  for (const p of state.players) {
    if (p.roads.includes(edgeId)) return false;
    if (p.ships.includes(edgeId)) return false;
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  for (const v of edge.vertices) {
    if (vertexBlockedByOpponent(state, playerId, v)) continue;
    if (player.settlements.includes(v) || player.cities.includes(v)) return true;
    if (hasOwnShipAtVertex(state, playerId, v, edgeId)) return true;
    if (hasOwnRoadAtVertex(state, playerId, v, edgeId) && vertexIsCoastal(state, v)) {
      return true;
    }
  }
  return false;
}

function vertexBlockedByOpponent(
  state: GameState,
  playerId: PlayerId,
  vertexId: string,
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
  vertexId: string,
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

function hasOwnRoadAtVertex(
  state: GameState,
  playerId: PlayerId,
  vertexId: string,
  excludingEdge: EdgeId,
): boolean {
  const player = state.players.find((p) => p.id === playerId)!;
  const v = state.board.vertices[vertexId]!;
  for (const eid of v.edges) {
    if (eid === excludingEdge) continue;
    if (player.roads.includes(eid)) return true;
  }
  return false;
}

function vertexIsCoastal(state: GameState, vertexId: string): boolean {
  const v = state.board.vertices[vertexId];
  if (!v) return false;
  return v.hexes.some((h) => state.board.hexes[h]?.terrain === 'sea');
}

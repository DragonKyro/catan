import type { GameState, PlayerId, VertexId, EdgeId } from './types';
import { canStartOnIsland } from './modules/seafarers/validation/setupPlacement';

// Placement predicates — shared between action handlers (for validation) and
// the UI (for highlighting legal placements). Pure functions, no mutation.

export function canPlaceSettlement(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
): boolean {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return false;
  // Settlements need at least one adjacent land hex.
  if (!vertex.hexes.some((h) => state.board.hexes[h]!.terrain !== 'sea')) return false;
  for (const p of state.players) {
    if (p.settlements.includes(vertexId) || p.cities.includes(vertexId)) return false;
    for (const n of vertex.neighborVertices) {
      if (p.settlements.includes(n) || p.cities.includes(n)) return false;
    }
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  // Connectivity: a settlement may be placed on the network via a road OR
  // (Seafarers) a ship — both count as a "way to get there".
  for (const eid of vertex.edges) {
    if (player.roads.includes(eid)) return true;
    if (player.ships.includes(eid)) return true;
  }
  return false;
}

export function canPlaceCity(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  return player.settlements.includes(vertexId);
}

export function canConnectRoad(
  state: GameState,
  playerId: PlayerId,
  edgeId: EdgeId,
): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  // Roads cannot be placed on pure-sea edges (those are ship-only).
  if (edge.hexes.every((h) => state.board.hexes[h]!.terrain === 'sea')) return false;
  for (const p of state.players) {
    if (p.roads.includes(edgeId)) return false;
    if (p.ships.includes(edgeId)) return false;
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  const [v1, v2] = edge.vertices;
  for (const v of [v1, v2]) {
    let blocked = false;
    for (const p of state.players) {
      if (p.id === playerId) continue;
      if (p.settlements.includes(v) || p.cities.includes(v)) {
        blocked = true;
        break;
      }
    }
    if (player.settlements.includes(v) || player.cities.includes(v)) return true;
    if (blocked) continue;
    for (const eid of state.board.vertices[v]!.edges) {
      if (eid === edgeId) continue;
      if (player.roads.includes(eid)) return true;
    }
  }
  return false;
}

// During setup: a settlement can go anywhere unoccupied that respects the
// distance rule. There's no road-connectivity requirement (you place your
// road right after). Seafarers scenarios additionally restrict round-1 and
// round-2 starts to the main island unless the scenario opts out.
export function canPlaceInitialSettlement(
  state: GameState,
  vertexId: VertexId,
): boolean {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return false;
  // Settlements need at least one adjacent land hex.
  if (!vertex.hexes.some((h) => state.board.hexes[h]!.terrain !== 'sea')) return false;
  for (const p of state.players) {
    if (p.settlements.includes(vertexId) || p.cities.includes(vertexId)) return false;
    for (const n of vertex.neighborVertices) {
      if (p.settlements.includes(n) || p.cities.includes(n)) return false;
    }
  }
  if (!canStartOnIsland(state, vertexId)) return false;
  return true;
}

// During setup: a road must touch the just-placed settlement and be unoccupied.
export function canPlaceInitialRoad(
  state: GameState,
  placedSettlement: VertexId,
  edgeId: EdgeId,
): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  // Initial roads cannot be placed on a pure-sea edge.
  if (edge.hexes.every((h) => state.board.hexes[h]!.terrain === 'sea')) return false;
  if (edge.vertices[0] !== placedSettlement && edge.vertices[1] !== placedSettlement) {
    return false;
  }
  for (const p of state.players) {
    if (p.roads.includes(edgeId)) return false;
  }
  return true;
}

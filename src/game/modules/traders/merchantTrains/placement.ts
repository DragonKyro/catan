import type { GameState, EdgeId, VertexId } from '../../../types';
import { legalWagonPlacements } from './trains';

// Can the next wagon go on this edge (as a new train on a start edge, or at
// the front of a train)? See `legalWagonPlacements` for the rules.
export function canPlaceWagon(state: GameState, edgeId: EdgeId): boolean {
  return legalWagonPlacements(state).some((p) => p.edge === edgeId);
}

// Count of wagons touching this vertex. A building where 2+ wagon edges
// meet is "between 2 wagons" (+1 VP).
export function wagonDegreeAtVertex(
  state: GameState,
  vertexId: VertexId,
): number {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return 0;
  const wagons = state.wagons ?? [];
  let degree = 0;
  for (const w of wagons) {
    if (vertex.edges.includes(w.edge)) degree++;
  }
  return degree;
}

import type { GameState, EdgeId, VertexId } from '../../../types';

// Is this edge a legal merchant-train extension?
// Rules summary:
//   - Edge cannot already have a wagon.
//   - Edge must be adjacent to the watering hole hex, OR share a vertex
//     with an existing wagon at an open endpoint (vertex with exactly
//     one incident wagon).
//   - Merchant trains do not branch — a vertex that already has 2 incident
//     wagons is no longer a valid extension point (it's a merge).
export function canPlaceWagon(state: GameState, edgeId: EdgeId): boolean {
  if (!state.wateringHoleHexId) return false;
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  if ((state.wagonSupply ?? 0) <= 0) return false;
  const wagons = state.wagons ?? [];
  if (wagons.some((w) => w.edge === edgeId)) return false;

  // 1) Watering-hole adjacency: edge touches the watering hole hex.
  if (edge.hexes.includes(state.wateringHoleHexId)) return true;

  // 2) Endpoint adjacency: at least one of the edge's vertices is a
  //    train endpoint — a vertex with exactly 1 incident wagon AND not
  //    on the watering hole (which has its own slots).
  for (const v of edge.vertices) {
    const degree = wagonDegreeAtVertex(state, v);
    if (degree === 1) return true;
  }
  return false;
}

// Count of wagons touching this vertex.
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

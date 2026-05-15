import type { BoardState, EdgeId } from '../../../types';

export type EdgeClassification = 'land' | 'coastal' | 'sea';

// Classify a board edge for ship/road eligibility:
//   - 'land'     — every adjacent hex is non-sea (or the edge has no
//                  adjacent hexes). Roads only.
//   - 'sea'      — every adjacent hex is sea, or there are no land hexes
//                  adjacent. Ships only.
//   - 'coastal'  — at least one land and at least one sea hex. Either
//                  roads or ships, and the only place a road network can
//                  meet a ship network.
//
// Note: edges with no adjacent hexes don't exist in any board we generate
// (every edge is between exactly 1 or 2 hexes), but the classifier handles
// them by treating "no neighbours" as land for robustness.
export function classifyEdge(board: BoardState, edgeId: EdgeId): EdgeClassification {
  const edge = board.edges[edgeId];
  if (!edge) throw new Error(`Unknown edge: ${edgeId}`);

  let landCount = 0;
  let seaCount = 0;
  for (const hexId of edge.hexes) {
    const t = board.hexes[hexId]?.terrain;
    if (t === 'sea') seaCount++;
    else landCount++;
  }

  if (landCount > 0 && seaCount === 0) return 'land';
  if (seaCount > 0 && landCount === 0) return 'sea';
  return 'coastal';
}

export function canBuildRoadOnEdge(board: BoardState, edgeId: EdgeId): boolean {
  return classifyEdge(board, edgeId) !== 'sea';
}

export function canBuildShipOnEdge(board: BoardState, edgeId: EdgeId): boolean {
  return classifyEdge(board, edgeId) !== 'land';
}

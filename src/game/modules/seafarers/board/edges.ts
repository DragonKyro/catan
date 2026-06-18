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

// Whether an edge can host a port. Coastal (land+sea) edges qualify, AND so
// do disk-perimeter edges whose single adjacent hex is land — those represent
// a main-island face that opens onto the painted water border (no sea hex
// tile behind it), exactly like base-game port placements. Ships still cannot
// build on perimeter edges (canBuildShipOnEdge is unchanged), but settlements
// on a perimeter port's vertices can still claim it via the road network.
export function isPortEligibleEdge(board: BoardState, edgeId: EdgeId): boolean {
  const edge = board.edges[edgeId];
  if (!edge) return false;
  const c = classifyEdge(board, edgeId);
  if (c === 'coastal') return true;
  if (edge.hexes.length === 1) {
    const t = board.hexes[edge.hexes[0]!]?.terrain;
    return t !== undefined && t !== 'sea';
  }
  return false;
}

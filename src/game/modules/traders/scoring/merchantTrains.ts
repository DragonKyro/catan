import type { GameState, PlayerId, VertexId } from '../../../types';

// Merchant Trains scoring: +1 VP per building (settle or city) whose vertex
// is "between 2 wagons" — i.e. has at least 2 incident wagon edges. A
// vertex with 3+ wagons (a merge point) still only earns +1 VP per
// building (the rulebook bonus tops out at "between 2 wagons").
export function calculateMerchantTrainsVp(
  state: GameState,
  playerId: PlayerId,
): number {
  const wagons = state.wagons;
  if (!wagons || wagons.length < 2) return 0;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  let vp = 0;
  for (const vid of [...player.settlements, ...player.cities]) {
    if (wagonDegreeAtVertex(state, vid) >= 2) vp += 1;
  }
  return vp;
}

function wagonDegreeAtVertex(
  state: GameState,
  vertexId: VertexId,
): number {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return 0;
  let degree = 0;
  for (const w of state.wagons ?? []) {
    if (vertex.edges.includes(w.edge)) degree++;
  }
  return degree;
}

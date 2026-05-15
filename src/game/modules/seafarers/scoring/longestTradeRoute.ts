import type { GameState, PlayerId, VertexId, EdgeId } from '../../../types';

// Seafarers Longest Trade Route: longest contiguous path through the
// player's roads AND ships combined.
//
// Path-continuation rule at an intermediate vertex V (not the path start
// or end): the player may pass through V using two edges of the SAME type
// (road+road or ship+ship). Mixing a road and a ship at V is only allowed
// when V hosts the player's own settlement or city — otherwise the road
// network and ship network only meet at "harbours" (own pieces). This is
// the standard 4th-edition Catan ruling.
//
// As in base Longest Road: an opponent's settlement/city at V blocks
// throughput (paths may end there, just not continue).
export function calculateLongestTradeRoute(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  if (player.roads.length === 0 && player.ships.length === 0) return 0;

  type EdgeKind = 'road' | 'ship';
  const kindOf = new Map<EdgeId, EdgeKind>();
  for (const eid of player.roads) kindOf.set(eid, 'road');
  for (const eid of player.ships) kindOf.set(eid, 'ship');

  // vertex -> [{ edge, to, kind }]
  const adj = new Map<VertexId, Array<{ edge: EdgeId; to: VertexId; kind: EdgeKind }>>();
  for (const [eid, kind] of kindOf) {
    const edge = state.board.edges[eid];
    if (!edge) continue;
    const [a, b] = edge.vertices;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ edge: eid, to: b, kind });
    adj.get(b)!.push({ edge: eid, to: a, kind });
  }

  // Opponent settlements/cities block path throughput (not start/end).
  const blockedByOpponent = new Set<VertexId>();
  for (const p of state.players) {
    if (p.id === playerId) continue;
    for (const v of p.settlements) blockedByOpponent.add(v);
    for (const v of p.cities) blockedByOpponent.add(v);
  }

  // Own settlements/cities — required to "transfer" between road and ship.
  const ownPiece = new Set<VertexId>();
  for (const v of player.settlements) ownPiece.add(v);
  for (const v of player.cities) ownPiece.add(v);

  let best = 0;
  const used = new Set<EdgeId>();

  function dfs(current: VertexId, depth: number, arrivedBy: EdgeKind | null): void {
    if (depth > best) best = depth;
    // Throughput rules apply when we've already entered this vertex via an
    // edge (depth > 0). At depth 0 we're at the path's start vertex.
    if (depth > 0 && blockedByOpponent.has(current)) return;

    for (const { edge, to, kind } of adj.get(current) ?? []) {
      if (used.has(edge)) continue;

      // Road↔ship transition only legal at the player's own settlement/city.
      if (
        arrivedBy !== null &&
        arrivedBy !== kind &&
        !ownPiece.has(current)
      ) {
        continue;
      }

      used.add(edge);
      dfs(to, depth + 1, kind);
      used.delete(edge);
    }
  }

  for (const start of adj.keys()) {
    dfs(start, 0, null);
  }

  return best;
}

import type { GameState, PlayerId, VertexId, EdgeId } from '../types';

// Returns the length of the longest road for a player.
//
// Rules:
// - Roads are graph edges; the player's roads form a subgraph.
// - An opponent's settlement or city at a vertex prevents the player's path
//   from passing THROUGH that vertex (paths can end there, just not continue).
// - Edges may not repeat; vertices may repeat (loops are allowed).
// - Traders & Barbarians: bridges count as roads for Longest Road, so they
//   are unioned into the path graph here.
export function calculateLongestRoad(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;

  const ownRoads = new Set<EdgeId>([
    ...player.roads,
    ...(player.bridges ?? []),
  ]);
  if (ownRoads.size === 0) return 0;

  // Build adjacency: vertex -> [{ edge, other }]
  const adj = new Map<VertexId, Array<{ edge: EdgeId; to: VertexId }>>();
  for (const eid of ownRoads) {
    const edge = state.board.edges[eid];
    if (!edge) continue;
    const [a, b] = edge.vertices;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ edge: eid, to: b });
    adj.get(b)!.push({ edge: eid, to: a });
  }

  // Vertices occupied by opponents (block path throughput).
  const blocked = new Set<VertexId>();
  for (const p of state.players) {
    if (p.id === playerId) continue;
    for (const v of p.settlements) blocked.add(v);
    for (const v of p.cities) blocked.add(v);
  }

  let best = 0;
  const used = new Set<EdgeId>();

  function dfs(current: VertexId, depth: number): void {
    if (depth > best) best = depth;
    // Can arrive at a blocked vertex (counts as path end) but can't traverse through.
    if (depth > 0 && blocked.has(current)) return;
    for (const { edge, to } of adj.get(current) ?? []) {
      if (used.has(edge)) continue;
      used.add(edge);
      dfs(to, depth + 1);
      used.delete(edge);
    }
  }

  for (const start of adj.keys()) {
    dfs(start, 0);
  }

  return best;
}

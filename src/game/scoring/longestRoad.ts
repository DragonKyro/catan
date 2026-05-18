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
// - T&B Merchant Trains: when a wagon shares an edge with one of your
//   roads, that edge contributes 2 to the path length instead of 1
//   (rulebook: "A wagon on the same edge as a road counts as an
//   additional road for determining the Longest Route").
export function calculateLongestRoad(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;

  const ownRoads = new Set<EdgeId>([
    ...player.roads,
    ...(player.bridges ?? []),
  ]);
  if (ownRoads.size === 0) return 0;

  // Edges that carry a "+1" bonus from a wagon co-occupying the same edge.
  const wagonEdges = new Set<EdgeId>();
  for (const w of state.wagons ?? []) wagonEdges.add(w.edge);

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

  // Vertices occupied by opponents (block path throughput). C&K knights
  // (active or inactive) also block opposing roads per rulebook p.9.
  const blocked = new Set<VertexId>();
  for (const p of state.players) {
    if (p.id === playerId) continue;
    for (const v of p.settlements) blocked.add(v);
    for (const v of p.cities) blocked.add(v);
  }
  for (const [vid, k] of Object.entries(state.knights ?? {})) {
    if (k.playerId !== playerId) blocked.add(vid);
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
      // Merchant Trains: traversing an edge with a co-located wagon counts
      // as 2 segments instead of 1. The wagon doesn't extend the path
      // graph (only roads/bridges form edges), it just makes each used
      // road-edge worth more.
      const step = wagonEdges.has(edge) ? 2 : 1;
      dfs(to, depth + step);
      used.delete(edge);
    }
  }

  for (const start of adj.keys()) {
    dfs(start, 0);
  }

  return best;
}

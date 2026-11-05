import type { Action, EdgeId, GameState, PlayerId, VertexId } from '@/game/types';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canConnectRoad, canPlaceSettlement, hasSettleableLand } from '@/game/placement';
import { tryBuildRoad } from '../main';
import { vertexScore } from '../value';
import { firstLegal, handSizeCK, playerById } from './common';

// Roads in C&K. The base step only builds a road whose new end is itself a
// settlement site (or chases Longest Road). In C&K a seat boxed in by
// neighbours would then never expand again — so when the base step finds
// nothing and we have no open site, plan up to three roads ahead to the best
// reachable site and lay the first one.

const MAX_DEPTH = 3;

function buildingOwner(state: GameState, v: VertexId): PlayerId | null {
  for (const p of state.players) {
    if (p.settlements.includes(v) || p.cities.includes(v)) return p.id;
  }
  return null;
}

// Could anyone ever settle `v` (distance rule, land, no knight)?
function settleSite(state: GameState, v: VertexId): boolean {
  if (!hasSettleableLand(state, v)) return false;
  if (state.knights?.[v]) return false;
  if (buildingOwner(state, v)) return false;
  for (const n of state.board.vertices[v]?.neighborVertices ?? []) {
    if (buildingOwner(state, n)) return false;
  }
  return true;
}

function edgeTaken(state: GameState, e: EdgeId): boolean {
  if (state.riverEdges?.includes(e)) return true;
  return state.players.some(
    (p) => p.roads.includes(e) || p.ships.includes(e) || (p.bridges ?? []).includes(e),
  );
}

function blocksUs(state: GameState, playerId: PlayerId, v: VertexId): boolean {
  const owner = buildingOwner(state, v);
  if (owner && owner !== playerId) return true;
  const k = state.knights?.[v];
  return !!k && k.playerId !== playerId;
}

function hasOpenSite(state: GameState, playerId: PlayerId): boolean {
  const p = playerById(state, playerId);
  for (const eid of p.roads) {
    for (const v of state.board.edges[eid]?.vertices ?? []) {
      if (canPlaceSettlement(state, playerId, v)) return true;
    }
  }
  return false;
}

export function tryBuildRoadCK(state: GameState, playerId: PlayerId): Action | null {
  const base = tryBuildRoad(state, playerId);
  if (base) return firstLegal(state, [base]);

  const p = playerById(state, playerId);
  if (!canAfford(p.resources, COSTS.road) || p.roads.length >= 15) return null;
  if (p.settlements.length >= 5) return null;
  if (hasOpenSite(state, playerId)) return null;

  // Frontier: corners of our network we can extend from.
  const start = new Set<VertexId>([...p.settlements, ...p.cities]);
  for (const eid of p.roads) {
    for (const v of state.board.edges[eid]?.vertices ?? []) {
      if (!blocksUs(state, playerId, v)) start.add(v);
    }
  }
  // BFS over unbuilt edges; remember the first edge of each path.
  const firstEdge = new Map<VertexId, EdgeId | null>();
  const depth = new Map<VertexId, number>();
  let frontier: VertexId[] = [];
  for (const v of start) {
    firstEdge.set(v, null);
    depth.set(v, 0);
    frontier.push(v);
  }
  let best: { edge: EdgeId; score: number } | null = null;
  for (let d = 1; d <= MAX_DEPTH && frontier.length > 0; d++) {
    const next: VertexId[] = [];
    for (const v of frontier) {
      for (const eid of state.board.vertices[v]?.edges ?? []) {
        if (edgeTaken(state, eid)) continue;
        const edge = state.board.edges[eid]!;
        if (edge.hexes.every((h) => state.board.hexes[h]?.terrain === 'sea')) continue;
        const w = edge.vertices[0] === v ? edge.vertices[1] : edge.vertices[0];
        if (depth.has(w)) continue;
        const first = firstEdge.get(v) ?? eid;
        depth.set(w, d);
        firstEdge.set(w, first);
        if (settleSite(state, w)) {
          let enemyRoads = 0;
          for (const ne of state.board.vertices[w]?.edges ?? []) {
            if (state.players.some((o) => o.id !== playerId && o.roads.includes(ne))) enemyRoads++;
          }
          const score = vertexScore(state, w, playerId) - 1.6 * (d - 1) - 1.5 * enemyRoads;
          if (!best || score > best.score) best = { edge: first, score };
        }
        if (!blocksUs(state, playerId, w)) next.push(w);
      }
    }
    frontier = next;
  }
  if (!best) return null;
  const threshold = handSizeCK(p) >= 7 ? 2.0 : 3.0;
  if (best.score < threshold) return null;
  if (!canConnectRoad(state, playerId, best.edge)) return null;
  return firstLegal(state, [{ type: 'buildRoad', playerId, edge: best.edge }]);
}

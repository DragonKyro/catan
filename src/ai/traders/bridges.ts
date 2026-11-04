import type { Action, GameState, PlayerId, VertexId } from '@/game/types';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canPlaceBridge } from '@/game/placement';
import { BRIDGE_GOLD_REWARD, MAX_BRIDGES } from '@/game/modules/traders/constants';
import { vertexScore } from '../value';
import { goldValue } from './gold';

// A bridge must lead somewhere: its far end (or a corner one step past it)
// must score at least this as a settlement spot, after counting the 3 gold
// it pays. Below the road threshold (4.5) because of that gold.
const BRIDGE_TARGET_THRESHOLD = 3.5;

// Rivers of Catan: build a bridge (2 brick + 1 lumber, +3 gold) across a
// river toward a good settlement spot.
export function tryBuildBridge(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if ((state.riverEdges?.length ?? 0) === 0) return null;
  if (!canAfford(player.resources, COSTS.bridge)) return null;
  if ((player.bridges?.length ?? 0) >= MAX_BRIDGES) return null;
  const goldBonus = goldValue(state, playerId, BRIDGE_GOLD_REWARD);

  let bestEdge: string | null = null;
  let bestScore = -Infinity;
  for (const eid of state.riverEdges ?? []) {
    if (!canPlaceBridge(state, playerId, eid)) continue;
    const edge = state.board.edges[eid];
    if (!edge) continue;
    let edgeScore = -Infinity;
    for (const vid of edge.vertices) {
      if (ownsOrTouches(state, playerId, vid)) continue;
      edgeScore = Math.max(edgeScore, reachScore(state, playerId, vid));
    }
    if (edgeScore > bestScore) {
      bestScore = edgeScore;
      bestEdge = eid;
    }
  }
  if (!bestEdge || bestScore === -Infinity) return null;
  if (bestScore + goldBonus < BRIDGE_TARGET_THRESHOLD) return null;
  return { type: 'buildBridge', playerId, edge: bestEdge };
}

// Settlement value of a bridge's far end: the corner itself if a settlement
// could go there, else the best corner one road further (discounted).
function reachScore(state: GameState, playerId: PlayerId, vid: VertexId): number {
  if (settleable(state, vid)) return vertexScore(state, vid, playerId);
  if (taken(state, vid)) return -Infinity;
  let best = -Infinity;
  for (const n of state.board.vertices[vid]!.neighborVertices) {
    if (settleable(state, n)) best = Math.max(best, vertexScore(state, n, playerId) - 1.5);
  }
  return best;
}

function taken(state: GameState, vid: VertexId): boolean {
  return state.players.some((p) => p.settlements.includes(vid) || p.cities.includes(vid));
}

// Free corner on land that respects the distance rule.
function settleable(state: GameState, vid: VertexId): boolean {
  const v = state.board.vertices[vid];
  if (!v || taken(state, vid)) return false;
  if (v.neighborVertices.some((n) => taken(state, n))) return false;
  return v.hexes.some((h) => state.board.hexes[h]?.terrain !== 'sea');
}

function ownsOrTouches(state: GameState, playerId: PlayerId, vid: VertexId): boolean {
  const player = state.players.find((p) => p.id === playerId)!;
  if (player.settlements.includes(vid) || player.cities.includes(vid)) return true;
  const v = state.board.vertices[vid]!;
  return v.edges.some((e) => player.roads.includes(e) || (player.bridges ?? []).includes(e));
}

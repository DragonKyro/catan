import type { Action, GameState, PlayerId } from '@/game/types';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canPlaceBridge } from '@/game/placement';
import { vertexScore } from '../value';

// Threshold: a bridge target vertex (the unblocked far-side endpoint) must
// score at least this much for us to bother spanning the river. Below the
// road threshold (4.5) because bridges pay +3 gold on build — even an
// average crossing is worth it.
const BRIDGE_TARGET_THRESHOLD = 3.5;

// Attempt to build a bridge. Returns an action when a high-value river
// crossing is available; null otherwise. Skips when the player is out of
// bridge tokens, can't afford the cost, or no river edge is on the map.
export function tryBuildBridge(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if ((state.riverEdges?.length ?? 0) === 0) return null;
  if (!canAfford(player.resources, COSTS.bridge)) return null;
  if ((player.bridges?.length ?? 0) >= 3) return null;

  let bestEdge: string | null = null;
  let bestScore = -Infinity;
  for (const eid of state.riverEdges ?? []) {
    if (!canPlaceBridge(state, playerId, eid)) continue;
    const edge = state.board.edges[eid];
    if (!edge) continue;
    // Score = max vertex score across the two endpoints. Picks the side
    // we'd actually want to settle. Skip endpoints already controlled by us
    // (no expansion benefit) unless the other side is good.
    let edgeScore = -Infinity;
    for (const vid of edge.vertices) {
      const occupied = state.players.some(
        (p) => p.settlements.includes(vid) || p.cities.includes(vid),
      );
      if (occupied) continue;
      const score = vertexScore(state, vid, playerId);
      if (score > edgeScore) edgeScore = score;
    }
    if (edgeScore > bestScore) {
      bestScore = edgeScore;
      bestEdge = eid;
    }
  }
  if (!bestEdge) return null;
  if (bestScore < BRIDGE_TARGET_THRESHOLD) return null;
  return { type: 'buildBridge', playerId, edge: bestEdge };
}

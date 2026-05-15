import type { GameState, PlayerId, VertexId, EdgeId } from '@/game/types';
import {
  canPlaceInitialSettlement,
  canPlaceInitialRoad,
} from '@/game/placement';
import { vertexScore } from './value';

export function chooseSetupSettlement(state: GameState, playerId: PlayerId): VertexId {
  let bestVid: VertexId | null = null;
  let bestScore = -Infinity;
  for (const vid of state.board.vertexIds) {
    if (!canPlaceInitialSettlement(state, vid)) continue;
    const s = vertexScore(state, vid, playerId);
    if (s > bestScore) {
      bestScore = s;
      bestVid = vid;
    }
  }
  if (!bestVid) {
    // Should never happen — at least one vertex should be available
    throw new Error('AI could not find a setup settlement spot');
  }
  return bestVid;
}

export function chooseSetupRoad(
  state: GameState,
  playerId: PlayerId,
  settlementVid: VertexId,
): EdgeId {
  const v = state.board.vertices[settlementVid];
  if (!v) throw new Error('AI: setup road from invalid vertex');
  let bestEid: EdgeId | null = null;
  let bestNextScore = -Infinity;
  for (const eid of v.edges) {
    if (!canPlaceInitialRoad(state, settlementVid, eid)) continue;
    const edge = state.board.edges[eid]!;
    const otherVid =
      edge.vertices[0] === settlementVid ? edge.vertices[1] : edge.vertices[0];
    const otherVertex = state.board.vertices[otherVid]!;
    // Base value: what could be settled here (or extended toward) next?
    let nextScore = vertexScore(state, otherVid, playerId);
    // Setup-time risk penalties. Pointing the starter road at a vertex
    // that's already adjacent to an opponent's settle is a wasted road —
    // we can never settle on that vertex, AND the opponent can race us
    // to anything further along that direction. Big penalty so we'd only
    // pick such a road if literally every other option is worse.
    for (const n of otherVertex.neighborVertices) {
      for (const p of state.players) {
        if (p.id === playerId) continue;
        if (p.settlements.includes(n) || p.cities.includes(n)) {
          nextScore -= 4;
        }
      }
    }
    for (const ne of otherVertex.edges) {
      if (ne === eid) continue;
      for (const p of state.players) {
        if (p.id === playerId) continue;
        if (p.roads.includes(ne)) nextScore -= 2;
      }
    }
    if (nextScore > bestNextScore) {
      bestNextScore = nextScore;
      bestEid = eid;
    }
  }
  if (!bestEid) throw new Error('AI could not find a setup road');
  return bestEid;
}

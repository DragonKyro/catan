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
    // Look at what the next settlement spot from there could score
    const nextScore = vertexScore(state, otherVid, playerId);
    if (nextScore > bestNextScore) {
      bestNextScore = nextScore;
      bestEid = eid;
    }
  }
  if (!bestEid) throw new Error('AI could not find a setup road');
  return bestEid;
}

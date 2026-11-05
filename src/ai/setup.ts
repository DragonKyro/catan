import type { GameState, PlayerId, VertexId, EdgeId } from '@/game/types';
import {
  canPlaceInitialSettlement,
  canPlaceInitialRoad,
} from '@/game/placement';
import { vertexScore } from './value';
import { canPlaceInitialShip } from '@/game/modules/seafarers/validation/shipPlacement';
import { pirateIslandsShipViolation } from '@/game/modules/seafarers/pirateIslands';
import { shipEdgeBonus } from './seafarers/scenarios';

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

// The starting road — or, from a coastal settlement in Seafarers, a ship
// instead. Both are scored by where they lead.
export function chooseSetupRoad(
  state: GameState,
  playerId: PlayerId,
  settlementVid: VertexId,
): { edge: EdgeId; ship: boolean } {
  const v = state.board.vertices[settlementVid];
  if (!v) throw new Error('AI: setup road from invalid vertex');
  const seafarers = state.settings.expansions.includes('seafarers');
  let bestEid: EdgeId | null = null;
  let bestShip = false;
  let bestNextScore = -Infinity;
  for (const eid of v.edges) {
    const asRoad = canPlaceInitialRoad(state, settlementVid, eid);
    const asShip =
      seafarers &&
      canPlaceInitialShip(state, settlementVid, eid) &&
      pirateIslandsShipViolation(state, playerId, eid) === null;
    if (!asRoad && !asShip) continue;
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
    // A road on land keeps both options open later (ships launch from the
    // settlement anyway), so prefer it on ties; a ship wins where it heads
    // somewhere a road can't (open sea, scenario targets).
    const options: Array<{ ship: boolean; score: number }> = [];
    if (asRoad) options.push({ ship: false, score: nextScore + 0.25 });
    if (asShip) options.push({ ship: true, score: nextScore + shipEdgeBonus(state, playerId, eid) });
    for (const o of options) {
      if (o.score > bestNextScore) {
        bestNextScore = o.score;
        bestEid = eid;
        bestShip = o.ship;
      }
    }
  }
  if (!bestEid) throw new Error('AI could not find a setup road');
  return { edge: bestEid, ship: bestShip };
}

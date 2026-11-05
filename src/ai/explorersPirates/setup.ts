import type { Action, EdgeId, EpShip, GameState, PlayerId, VertexId } from '@/game/types';
import { canPlaceInitialRoad, canPlaceInitialSettlement } from '@/game/placement';
import { epSetupShipEdges } from '@/game/modules/explorersPirates/setup';
import { canFoundAt, hiddenHexesAtEdge, isCoastalVertex } from '@/game/modules/explorersPirates/state';
import { firstLegal } from './common';
import { epVertexValue, exploreValue } from './value';
import { planShip } from './ships';

// Setup for the Explorers & Pirates AI (Rulebook p. 7, three rounds):
//   round 1: the harbor settlement on a marked east-coast intersection, by
//            production;
//   round 2: the island settlement by production (gaps in what the harbor
//            makes count extra), coastal spots a little more (a future
//            harbor settlement);
//   round 3: the road toward the best open intersection two steps out, then
//            the ship (with its settler) on the harbor edge with the best
//            plan — turning hexes over right away pays at once.

export function chooseEpSetupAction(state: GameState, pid: PlayerId): Action | null {
  const step = state.setupState?.step;
  if (step === 'settlement') {
    const coastalBonus = state.phase === 'setupRound2' ? 1.0 : 0;
    const ranked = state.board.vertexIds
      .filter((v) => canPlaceInitialSettlement(state, v))
      .map((v) => ({
        v,
        score: epVertexValue(state, v, pid) + (isCoastalVertex(state, v) ? coastalBonus : 0),
      }))
      .sort((a, b) => b.score - a.score);
    return firstLegal(
      state,
      ranked.map((x) => ({ type: 'placeInitialSettlement' as const, playerId: pid, vertex: x.v })),
    );
  }
  if (step === 'road') {
    const anchor = state.setupState?.lastPlacedSettlement;
    if (!anchor) return null;
    const ranked = state.board.vertices[anchor]!.edges
      .filter((e) => canPlaceInitialRoad(state, anchor, e))
      .map((e) => ({ e, score: roadLead(state, pid, anchor, e) }))
      .sort((a, b) => b.score - a.score);
    return firstLegal(
      state,
      ranked.map((x) => ({ type: 'placeInitialRoad' as const, playerId: pid, edge: x.e })),
    );
  }
  if (step === 'ship') {
    const ranked = epSetupShipEdges(state, pid)
      .map((e) => ({ e, score: shipEdgeScore(state, pid, e) }))
      .sort((a, b) => b.score - a.score);
    return firstLegal(
      state,
      ranked.map((x) => ({ type: 'placeInitialShip' as const, playerId: pid, edge: x.e })),
    );
  }
  return null;
}

// Best open intersection the road leads to (one road further out).
function roadLead(state: GameState, pid: PlayerId, anchor: VertexId, edge: EdgeId): number {
  const far = state.board.edges[edge]!.vertices.find((v) => v !== anchor)!;
  let best = 0;
  for (const n of state.board.vertices[far]!.neighborVertices) {
    if (n === anchor) continue;
    if (canFoundAt(state, pid, n)) best = Math.max(best, epVertexValue(state, n, pid));
  }
  return best;
}

function shipEdgeScore(state: GameState, pid: PlayerId, edge: EdgeId): number {
  const probe: EpShip = { id: '__setup__', owner: pid, edge, cargo: ['settler'] };
  let score = planShip(state, probe)?.score ?? 0;
  for (const h of hiddenHexesAtEdge(state, edge)) score += exploreValue(state, h);
  return score;
}

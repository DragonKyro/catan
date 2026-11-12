import type { GameState, PlayerId, Resource, VertexId, EdgeId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import {
  canPlaceInitialSettlement,
  canPlaceInitialRoad,
} from '@/game/placement';
import { getPortAtVertex } from '@/game/board/adjacency';
import { pipsByResource, vertexScore } from './value';
import { canPlaceInitialShip } from '@/game/modules/seafarers/validation/shipPlacement';
import { pirateIslandsShipViolation } from '@/game/modules/seafarers/pirateIslands';
import { shipEdgeBonus } from './seafarers/scenarios';
import { activePersona, cornerDistance, cornerPips, harborCorners, portFocus } from './persona';

// ---- placement styles (persona.ts) -----------------------------------------
//
// The all-rounder scores setup corners with vertexScore (production weighted
// by resource, diversity, harbors, missing-resource bonuses). Each placement
// style below replaces that with its own priority, keeping the common sense
// bits (no value for desert / sea, diminishing returns on a resource it
// already has) so it still makes a playable start.

type Weights = Record<Resource, number>;

/** Weighted pips at `v`, with the same diminishing returns as vertexScore. */
function weightedPips(state: GameState, v: VertexId, id: PlayerId, w: Weights): number {
  const pips = cornerPips(state, v);
  const have = pipsByResource(state, id);
  let s = 0;
  for (const r of RESOURCES) s += (pips[r] * w[r]) / (1 + have[r] * 0.15);
  return s;
}

/** Bonus for picking up resources it produces none of (scaled by pips, like vertexScore). */
function coverage(state: GameState, v: VertexId, id: PlayerId, bonus: Partial<Weights>): number {
  const pips = cornerPips(state, v);
  const have = pipsByResource(state, id);
  let s = 0;
  for (const r of RESOURCES) if (have[r] === 0 && pips[r] > 0) s += (bonus[r] ?? 0) * (0.5 + pips[r] / 5);
  return s;
}

function harborBonus(state: GameState, v: VertexId, wanted: readonly Resource[], generic = 1): number {
  const port = getPortAtVertex(state.board, v);
  if (!port) return 0;
  if (port === 'generic') return generic;
  return wanted.includes(port) ? 2.5 : 0;
}

/** Opponent buildings two corners away (as close as the distance rule allows) and hexes shared with them. */
function crowding(state: GameState, v: VertexId, id: PlayerId): { near: number; sharedHexes: number } {
  const rivals = state.players.filter((p) => p.id !== id).flatMap((p) => [...p.settlements, ...p.cities]);
  let near = 0;
  for (const b of rivals) if (cornerDistance(state, v, [b], 2) === 2) near++;
  const theirHexes = new Set(rivals.flatMap((b) => state.board.vertices[b]!.hexes));
  const sharedHexes = state.board.vertices[v]!.hexes.filter((h) => {
    const hex = state.board.hexes[h]!;
    return theirHexes.has(h) && hex.numberToken !== null;
  }).length;
  return { near, sharedHexes };
}

const OWS: Weights = { ore: 2.2, wheat: 2.2, sheep: 1.6, wood: 0.6, brick: 0.6 };
const WOOD_BRICK: Weights = { wood: 2.2, brick: 2.2, wheat: 1.0, sheep: 0.7, ore: 0.3 };
const EVEN: Weights = { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 1 };

/** How the active persona rates `v` as a starting corner (or a starting road's far end). */
export function placementScore(state: GameState, v: VertexId, id: PlayerId): number {
  const me = state.players.find((p) => p.id === id)!;
  switch (activePersona().placement) {
    case 'oreWheatSheep':
      return (
        weightedPips(state, v, id, OWS) +
        coverage(state, v, id, { ore: 2.5, wheat: 2.5, sheep: 2 }) +
        harborBonus(state, v, ['ore', 'wheat', 'sheep'])
      );
    case 'woodBrick':
      return (
        weightedPips(state, v, id, WOOD_BRICK) +
        coverage(state, v, id, { wood: 2.5, brick: 2.5, wheat: 1.5 }) +
        harborBonus(state, v, ['wood', 'brick'])
      );
    case 'allFive': {
      const pips = cornerPips(state, v);
      const have = pipsByResource(state, id);
      const fresh = RESOURCES.filter((r) => have[r] === 0 && pips[r] > 0).length;
      const after = RESOURCES.filter((r) => have[r] > 0 || pips[r] > 0).length;
      // Coverage first; with two corners down, completing all five is the whole point.
      const complete = me.settlements.length + me.cities.length >= 1 && after === 5 ? 6 : 0;
      return weightedPips(state, v, id, EVEN) * 0.6 + fresh * 3.5 + complete;
    }
    case 'highPips': {
      const pips = cornerPips(state, v);
      // Raw pips; resource weights only break ties.
      return RESOURCES.reduce((s, r) => s + pips[r], 0) + weightedPips(state, v, id, EVEN) * 0.01;
    }
    case 'portStack': {
      const focus = portFocus(state, id);
      if (!focus) return vertexScore(state, v, id);
      // Stack the focus resource, keep enough of the rest to build with.
      const w: Weights = { wood: 0.8, brick: 0.8, sheep: 0.8, wheat: 1.0, ore: 0.8 };
      w[focus] = 2.2;
      // Toward the harbor: the settlement on it, or a road / second corner close to it.
      const d = cornerDistance(state, v, harborCorners(state, focus), 3);
      const toHarbor = d === 0 ? 5 : d === 1 ? 2.5 : d === 2 ? 1 : 0;
      return weightedPips(state, v, id, w) + toHarbor + coverage(state, v, id, { wheat: 1.5, ore: 1 });
    }
    case 'grief': {
      const { near, sharedHexes } = crowding(state, v, id);
      const first = me.settlements.length + me.cities.length === 0;
      // No rival on the board yet (first to place): just take a strong corner.
      if (first && near === 0 && sharedHexes === 0) return vertexScore(state, v, id);
      // First corner: as close to a rival as the rules allow, on their hexes.
      // Second: wood / brick to road out fast and cut them off.
      return first
        ? vertexScore(state, v, id) + near * 3 + sharedHexes * 1.5
        : weightedPips(state, v, id, WOOD_BRICK) + coverage(state, v, id, { wood: 2.5, brick: 2.5, wheat: 1.5 }) + near * 2 + sharedHexes;
    }
    default:
      return vertexScore(state, v, id);
  }
}

export function chooseSetupSettlement(state: GameState, playerId: PlayerId): VertexId {
  let bestVid: VertexId | null = null;
  let bestScore = -Infinity;
  for (const vid of state.board.vertexIds) {
    if (!canPlaceInitialSettlement(state, vid)) continue;
    const s = placementScore(state, vid, playerId);
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
    // (Placement styles rate it their way: toward their harbor, a rival, …)
    let nextScore = placementScore(state, otherVid, playerId);
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

import type { Action, EdgeId, GameState, PlayerId, VertexId } from '@/game/types';
import { canAfford } from '@/game/resources';
import {
  canBuildShip,
  edgeOccupied,
  isShipEdge,
  isShipMovable,
  liftShip,
} from '@/game/modules/seafarers/validation/shipPlacement';
import {
  pirateIslandsSettlementAllowed,
  pirateIslandsShipViolation,
  shipAdvancesLine,
} from '@/game/modules/seafarers/pirateIslands';
import { hasSettleableLand } from '@/game/placement';
import { islandBonusAt } from '@/game/modules/seafarers/islandBonus';
import { SHIP_COST, MAX_SHIPS } from '@/game/modules/seafarers/constants';
import { vertexScore } from '../value';
import { scenarioTargetValue, shipEdgeBonus } from './scenarios';

// Build threshold — same intuition as ROAD_TARGET_THRESHOLD but a touch
// lower because ships are cheaper (wood+sheep instead of wood+brick) and
// unlock the island-bonus path, so a marginal ship is still useful when
// bank-trade alternatives are worse.
const SHIP_TARGET_THRESHOLD = 4.0;
// A ship move must beat the ship's current spot by this much.
const SHIP_MOVE_GAIN = 3.0;
// Look-ahead: a settlement spot this many ship-steps away still counts,
// discounted per step.
const NAV_DEPTH = 5;
const NAV_STEP_COST = 1.1;

// Value of a vertex as a future settlement spot (-Infinity when nobody
// could ever build there now). Memoised per decision.
type SpotValue = (v: VertexId) => number;
function spotValuer(state: GameState, playerId: PlayerId): SpotValue {
  const memo = new Map<VertexId, number>();
  const occupied = new Set<VertexId>();
  for (const p of state.players) for (const v of [...p.settlements, ...p.cities]) occupied.add(v);
  return (v) => {
    const hit = memo.get(v);
    if (hit !== undefined) return hit;
    let value = -Infinity;
    const vertex = state.board.vertices[v];
    if (
      vertex &&
      hasSettleableLand(state, v) &&
      !occupied.has(v) &&
      !vertex.neighborVertices.some((n) => occupied.has(n)) &&
      pirateIslandsSettlementAllowed(state, playerId, v)
    ) {
      value = vertexScore(state, v, playerId);
    }
    value = Math.max(value, scenarioTargetValue(state, playerId, v));
    memo.set(v, value);
    return value;
  };
}

// Best discounted settlement spot reachable by sea from `from`.
function navValue(state: GameState, playerId: PlayerId, from: VertexId, spot: SpotValue): number {
  let best = spot(from);
  const seen = new Set<VertexId>([from]);
  let frontier: VertexId[] = [from];
  for (let d = 1; d <= NAV_DEPTH && frontier.length > 0; d++) {
    const next: VertexId[] = [];
    for (const v of frontier) {
      if (d > 1 && state.players.some((p) => p.id !== playerId && (p.settlements.includes(v) || p.cities.includes(v)))) {
        continue;
      }
      for (const e of state.board.vertices[v]?.edges ?? []) {
        if (!isShipEdge(state, e)) continue;
        const own = state.players.find((p) => p.id === playerId)?.ships.includes(e);
        if (!own && edgeOccupied(state, e)) continue;
        const edge = state.board.edges[e]!;
        const u = edge.vertices[0] === v ? edge.vertices[1] : edge.vertices[0];
        if (seen.has(u)) continue;
        seen.add(u);
        next.push(u);
        best = Math.max(best, spot(u) - d * NAV_STEP_COST);
      }
    }
    frontier = next;
  }
  return best;
}

// Value of a ship on `eid` for `playerId` (or -Infinity when it leads
// nowhere new). `state` must already reflect any lifted ship.
function shipEdgeValue(
  state: GameState,
  playerId: PlayerId,
  eid: EdgeId,
  spot: SpotValue = spotValuer(state, playerId),
): number {
  const edge = state.board.edges[eid]!;
  // The new endpoint — the one not already in our ship network. Loops (both
  // ends already in the network) don't progress the route.
  let newVid: VertexId | null = null;
  for (const v of edge.vertices) {
    if (!isInOurShipNetwork(state, playerId, v, eid)) {
      newVid = v;
      break;
    }
  }
  if (newVid === null) return -Infinity;
  const settledByOpp = state.players.some(
    (p) => p.id !== playerId && (p.settlements.includes(newVid!) || p.cities.includes(newVid!)),
  );
  if (settledByOpp) return -Infinity;
  // Score where the ship leads: the best settlement spot within a few more
  // ship-steps (vertexScore includes the island bonus and gold weight) —
  // but only if this ship gets us closer than we already are.
  const nearVid = edge.vertices.find((v) => v !== newVid)!;
  const ahead = navValue(state, playerId, newVid, spot);
  const behind = navValue(state, playerId, nearVid, spot);
  let score = ahead > behind ? ahead : Math.min(ahead, vertexScore(state, newVid, playerId));
  score += islandProximityBonus(state, playerId, newVid);
  score += shipEdgeBonus(state, playerId, eid);
  // Pirate Islands: the line to the fortress is the win condition — every
  // step of it is worth a ship even across empty sea.
  if (shipAdvancesLine(state, playerId, eid)) score = Math.max(score, SHIP_TARGET_THRESHOLD + 2);
  return score;
}

export function tryBuildShip(state: GameState, playerId: PlayerId): Action | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (!canAfford(player.resources, SHIP_COST)) return null;
  if (player.ships.length >= MAX_SHIPS) return null;

  let bestEid: EdgeId | null = null;
  let bestScore = -Infinity;
  const spot = spotValuer(state, playerId);
  for (const eid of state.board.edgeIds) {
    if (!canBuildShip(state, playerId, eid)) continue;
    if (pirateIslandsShipViolation(state, playerId, eid)) continue;
    const score = shipEdgeValue(state, playerId, eid, spot);
    if (score > bestScore) {
      bestScore = score;
      bestEid = eid;
    }
  }
  if (bestEid && bestScore >= SHIP_TARGET_THRESHOLD) {
    return { type: 'buildShip', playerId, edge: bestEid };
  }
  return null;
}

// Is there a ship worth building (ignoring whether we can pay for it)?
// Drives the 'ship' trading goal in reportNeeds.
export function hasShipGoal(state: GameState, playerId: PlayerId): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.ships.length >= MAX_SHIPS) return false;
  const spot = spotValuer(state, playerId);
  for (const eid of state.board.edgeIds) {
    if (!canBuildShip(state, playerId, eid)) continue;
    if (pirateIslandsShipViolation(state, playerId, eid)) continue;
    if (shipEdgeValue(state, playerId, eid, spot) >= SHIP_TARGET_THRESHOLD) return true;
  }
  return false;
}

// Move one ship (once per turn) when an open-ended ship can go somewhere
// clearly better — e.g. a dead-end ship re-routed toward a tribe token, a
// village, or an island bonus.
export function tryMoveShip(state: GameState, playerId: PlayerId): Action | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.movedShipThisTurn) return null;
  let best: { from: EdgeId; to: EdgeId; gain: number } | null = null;
  for (const from of player.ships) {
    if (!isShipMovable(state, playerId, from)) continue;
    const lifted = liftShip(state, playerId, from);
    const here = shipEdgeValue(lifted, playerId, from);
    const current = Number.isFinite(here) ? here : 0;
    for (const to of state.board.edgeIds) {
      if (to === from) continue;
      if (!canBuildShip(lifted, playerId, to)) continue;
      if (pirateIslandsShipViolation(lifted, playerId, to)) continue;
      const gain = shipEdgeValue(lifted, playerId, to) - current;
      if (gain >= SHIP_MOVE_GAIN && (!best || gain > best.gain)) best = { from, to, gain };
    }
  }
  return best ? { type: 'moveShip', playerId, from: best.from, to: best.to } : null;
}

// Is `v` already part of the player's ship network: one of their
// buildings, or touched by another of their ships? (Roads don't count —
// roads and ships only connect at buildings.)
function isInOurShipNetwork(
  state: GameState,
  playerId: PlayerId,
  v: VertexId,
  excludeEid: EdgeId,
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  if (player.settlements.includes(v) || player.cities.includes(v)) return true;
  const vertex = state.board.vertices[v];
  if (!vertex) return false;
  for (const e of vertex.edges) {
    if (e === excludeEid) continue;
    if (player.ships.includes(e)) return true;
  }
  return false;
}

// Small bonus when a neighbouring vertex would earn us an island bonus —
// encourages the connector ships that lead there.
function islandProximityBonus(state: GameState, playerId: PlayerId, vertexId: VertexId): number {
  if (!state.islandChips || state.islandChips.length === 0) return 0;
  if (islandBonusAt(state, playerId, vertexId) > 0) return 0; // scored directly
  const v = state.board.vertices[vertexId];
  if (!v) return 0;
  for (const n of v.neighborVertices) {
    if (islandBonusAt(state, playerId, n) > 0) return 1.5;
  }
  return 0;
}

import type { Action, EdgeId, GameState, PlayerId, VertexId } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canBuildShip } from '@/game/modules/seafarers/validation/shipPlacement';
import { SHIP_COST, MAX_SHIPS } from '@/game/modules/seafarers/constants';
import { vertexScore } from '../value';

// Build threshold — same intuition as ROAD_TARGET_THRESHOLD but a touch
// lower because ships are cheaper (wood+sheep instead of wood+brick) and
// unlock the chip-VP path which is strictly outer-island progress, so a
// marginal ship is still useful when bank-trade alternatives are worse.
const SHIP_TARGET_THRESHOLD = 4.0;

// Try to build a useful ship. Returns the action when at least one
// candidate clears the threshold, otherwise null (caller falls through
// to the next priority step).
export function tryBuildShip(state: GameState, playerId: PlayerId): Action | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (!canAfford(player.resources, SHIP_COST)) return null;
  if (player.ships.length >= MAX_SHIPS) return null;

  let bestEid: EdgeId | null = null;
  let bestScore = -Infinity;

  for (const eid of state.board.edgeIds) {
    if (!canBuildShip(state, playerId, eid)) continue;
    const edge = state.board.edges[eid]!;

    // Identify the new endpoint — the one not already in our maritime/road
    // network. Loops (both ends already in network) get skipped because
    // they don't progress the route.
    let newVid: VertexId | null = null;
    for (const v of edge.vertices) {
      if (!isInOurMarineNetwork(state, playerId, v, eid)) {
        newVid = v;
        break;
      }
    }
    if (newVid === null) continue;

    // Dead-end check: if the new endpoint is already settled by anyone,
    // we can't continue through it (broken-road rule applies to ships).
    const settledHere = state.players.some(
      (p) => p.settlements.includes(newVid!) || p.cities.includes(newVid!),
    );
    // Settling on the new endpoint is the immediate payoff. If it's already
    // settled by an opponent we can't proceed; if it's our own settle the
    // ship goes nowhere new — both cases get scored low so the threshold
    // filters them out unless desperate.
    const settledByOpp = state.players.some(
      (p) =>
        p.id !== playerId &&
        (p.settlements.includes(newVid!) || p.cities.includes(newVid!)),
    );
    if (settledByOpp) continue;

    // Score the new endpoint as a future settlement. vertexScore already
    // bakes in the outer-island chip bonus and the boosted gold weight —
    // so the better the future settle here, the more this ship is worth.
    let score = vertexScore(state, newVid, playerId);

    // Penalty for routing into our own already-settled vertex: the ship
    // does nothing for VP today, only opens a fork. Worth less than a
    // road that unlocks an actual settle next tick.
    if (settledHere) score -= 2.0;

    // Bonus for endpoints adjacent to outer-island land hexes — the ship
    // is one step from claiming the chip even if THIS vertex isn't the
    // chip-claim spot itself. Use a soft "near a chip" radius so the AI
    // builds the connector ships even when they don't directly score.
    score += chipProximityBonus(state, newVid);

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

// True when `v` is already part of `playerId`'s combined road+ship network
// (a settle/city, or any of their roads/ships touch it, excluding the
// candidate edge being evaluated).
function isInOurMarineNetwork(
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
    if (player.roads.includes(e)) return true;
    if (player.ships.includes(e)) return true;
  }
  return false;
}

// Small bonus per neighbouring vertex (at one hop) that touches an
// unclaimed outer-island chip. Encourages connector ships that aren't
// themselves on the chip vertex but lead to it.
function chipProximityBonus(state: GameState, vertexId: VertexId): number {
  if (!state.islandChips || !state.board.islandOfHex) return 0;
  const unclaimedIslandIds = new Set(
    state.islandChips.filter((c) => c.firstSettler === null).map((c) => c.islandId),
  );
  if (unclaimedIslandIds.size === 0) return 0;

  const v = state.board.vertices[vertexId];
  if (!v) return 0;
  // Direct hit (this vertex already on the chip) is already scored by
  // vertexScore; we only add the "neighbour leads to chip" reward.
  const touchesChipDirectly = v.hexes.some((h) => {
    const id = state.board.islandOfHex![h];
    return id && unclaimedIslandIds.has(id);
  });
  if (touchesChipDirectly) return 0;

  for (const nVid of v.neighborVertices) {
    const nv = state.board.vertices[nVid];
    if (!nv) continue;
    for (const h of nv.hexes) {
      const id = state.board.islandOfHex[h];
      if (id && unclaimedIslandIds.has(id)) return 1.5;
    }
  }
  return 0;
}

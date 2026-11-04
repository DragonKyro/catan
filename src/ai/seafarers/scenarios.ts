import type { EdgeId, GameState, PlayerId, Resource, VertexId } from '@/game/types';
import { totalResources } from '@/game/resources';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { validTribePortEdges } from '@/game/modules/seafarers/tribe';
import {
  stealResourceCandidates,
  fortressOf,
  shipAdvancesLine,
} from '@/game/modules/seafarers/pirateIslands';
import { probabilityDots } from '../value';

// Scenario-specific AI choices for Seafarers. Pure, like the rest of src/ai.

// Extra value of putting a ship on `edge` for the scenario at hand, on top
// of where the ship leads (the caller scores the far endpoint).
export function shipEdgeBonus(state: GameState, playerId: PlayerId, edge: EdgeId): number {
  let bonus = 0;
  const e = state.board.edges[edge];
  if (!e) return 0;

  // Forgotten Tribe: pick up whatever the tribe left on this edge, and
  // steer toward edges that still hold something.
  for (const t of state.tribeTokens ?? []) {
    if (t.claimedBy !== null) continue;
    if (t.edge === edge) {
      bonus += t.type === 'victoryPoint' ? 6 : t.type === 'devCard' ? 3.5 : 3;
    } else if (state.board.edges[t.edge]?.vertices.some((v) => e.vertices.includes(v))) {
      bonus += 1.5;
    }
  }

  // Cloth for Catan: reach villages we don't trade with yet.
  for (const village of state.clothVillages ?? []) {
    if (village.partners.includes(playerId)) continue;
    const worth = village.supply > 0 ? 6 + probabilityDots(village.number) * 0.4 : 1;
    if (e.vertices.includes(village.vertex)) bonus += worth;
    else if (e.vertices.some((v) => state.board.vertices[v]?.neighborVertices.includes(village.vertex))) {
      bonus += worth * 0.35;
    }
  }

  // Pirate Islands: every legal ship off the main island is a step of the
  // line to the fortress (the engine only allows shortest-path steps). Hold
  // the final step until we have enough warships to win the assault.
  const pi = state.pirateIslands;
  const fortress = fortressOf(state, playerId);
  if (pi && fortress && fortress.lairs > 0) {
    if (shipAdvancesLine(state, playerId, edge)) bonus += 5;
    if (e.vertices.includes(fortress.vertex)) {
      const warships = state.players.find((p) => p.id === playerId)?.warships?.length ?? 0;
      if (warships < 4) bonus -= 12;
    }
  }
  return bonus;
}

// Value of reaching vertex `v` by ship for scenario reasons (a Cloth for
// Catan village, a Forgotten Tribe pickup on an edge there), for the ship
// look-ahead. -Infinity when there's nothing.
export function scenarioTargetValue(state: GameState, playerId: PlayerId, v: VertexId): number {
  let best = -Infinity;
  for (const village of state.clothVillages ?? []) {
    if (village.vertex !== v || village.partners.includes(playerId) || village.supply <= 0) continue;
    best = Math.max(best, 7 + probabilityDots(village.number) * 0.4);
  }
  for (const t of state.tribeTokens ?? []) {
    if (t.claimedBy !== null) continue;
    if (!state.board.edges[t.edge]?.vertices.includes(v)) continue;
    best = Math.max(best, t.type === 'victoryPoint' ? 6 : t.type === 'devCard' ? 4 : 3.5);
  }
  return best;
}

// Forgotten Tribe: where to put a port taken from the tribe. A 2:1 port
// goes next to the building that produces most of its resource; a 3:1 port
// anywhere valid.
export function chooseTribePortEdge(state: GameState, playerId: PlayerId): EdgeId | null {
  const edges = validTribePortEdges(state, playerId);
  if (edges.length === 0) return null;
  const portType = state.pendingTribePort?.portType;
  if (!portType || portType === 'generic') return edges[0]!;
  const player = state.players.find((p) => p.id === playerId)!;
  const own = new Set<VertexId>([...player.settlements, ...player.cities]);
  let best = edges[0]!;
  let bestScore = -Infinity;
  for (const eid of edges) {
    let score = 0;
    for (const v of state.board.edges[eid]!.vertices) {
      if (!own.has(v)) continue;
      for (const h of state.board.vertices[v]!.hexes) {
        const hex = state.board.hexes[h]!;
        if (hex.terrain === (portType as Resource)) score += probabilityDots(hex.numberToken);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = eid;
    }
  }
  return best;
}

// Pirate Islands 7: rob the player with the most cards, breaking ties
// toward the VP leader.
export function chooseStealResourceTarget(state: GameState, playerId: PlayerId): PlayerId | null {
  const candidates = stealResourceCandidates(state, playerId);
  let best: PlayerId | null = null;
  let bestKey = [-1, -1];
  for (const pid of candidates) {
    const p = state.players.find((x) => x.id === pid)!;
    const key = [totalResources(p.resources), calculateVictoryPoints(state, pid, false)];
    if (key[0]! > bestKey[0]! || (key[0] === bestKey[0] && key[1]! > bestKey[1]!)) {
      best = pid;
      bestKey = key;
    }
  }
  return best;
}

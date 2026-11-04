import type {
  BarbarianEdgeColor,
  EdgeId,
  GameState,
  HexId,
  PlayerId,
} from '../../../types';
import {
  BARBARIAN_KNIGHTS_PER_PLAYER,
  BARBARIAN_KNIGHT_MOVE,
  BARBARIAN_KNIGHT_MOVE_BOOSTED,
} from '../constants';
import { hexEdgeIds } from './state';

// Barbarian Attack knights: each player's 6 knights stand on edges (one
// knight per edge, roads and buildings don't matter). They enter the board
// through Knighthood (a free castle edge) and Swift Knight (any edge without
// a knight), move at the end of their owner's turn, and fight the barbarians
// on the coastal hexes whose edges they stand on.

export function knightOwner(state: GameState, edgeId: EdgeId): PlayerId | undefined {
  return state.barbarianAttack?.knights[edgeId];
}

export function playerKnightEdges(state: GameState, playerId: PlayerId): EdgeId[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  return Object.keys(ba.knights).filter((e) => ba.knights[e] === playerId);
}

export function knightsInSupply(state: GameState, playerId: PlayerId): number {
  if (!state.barbarianAttack) return 0;
  return BARBARIAN_KNIGHTS_PER_PLAYER - playerKnightEdges(state, playerId).length;
}

// Knights live on the island's edges (coast edges included), never out on
// the open sea frame.
export function isKnightEdge(state: GameState, edgeId: EdgeId): boolean {
  const e = state.board.edges[edgeId];
  if (!e) return false;
  return e.hexes.some((h) => state.board.hexes[h]?.terrain !== 'sea');
}

export function castleEdgeIds(state: GameState): EdgeId[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  return hexEdgeIds(state, ba.castleHex);
}

export function isCastleEdge(state: GameState, edgeId: EdgeId): boolean {
  const ba = state.barbarianAttack;
  if (!ba) return false;
  return state.board.edges[edgeId]?.hexes.includes(ba.castleHex) ?? false;
}

// Knights on a hex's six edges, per player.
export function knightsOnHex(state: GameState, hexId: HexId): Record<PlayerId, number> {
  const ba = state.barbarianAttack;
  const out: Record<PlayerId, number> = {};
  if (!ba) return out;
  for (const e of hexEdgeIds(state, hexId)) {
    const owner = ba.knights[e];
    if (owner) out[owner] = (out[owner] ?? 0) + 1;
  }
  return out;
}

export function knightCountOnHex(state: GameState, hexId: HexId): number {
  let n = 0;
  for (const c of Object.values(knightsOnHex(state, hexId))) n += c;
  return n;
}

// Edge orientation, matching the castle tile's coloured edge pairs: purple
// = "/" (parallel to the NW and SE edges), green = "\" (NE and SW), brown =
// the vertical W / E edges.
export function edgeColor(state: GameState, edgeId: EdgeId): BarbarianEdgeColor {
  const e = state.board.edges[edgeId]!;
  const a = state.board.vertices[e.vertices[0]]!.position;
  const b = state.board.vertices[e.vertices[1]]!.position;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1) return 'brown';
  return dx * dy < 0 ? 'purple' : 'green';
}

// Knight-loss die: 1 or 6 purple, 2 or 5 green, 3 or 4 brown.
export function dieToEdgeColor(die: number): BarbarianEdgeColor {
  if (die === 1 || die === 6) return 'purple';
  if (die === 2 || die === 5) return 'green';
  return 'brown';
}

// Steps from `from` to every island edge within `max` steps (edges are
// connected when they share an intersection). Knights ignore every piece
// while moving, so this is plain distance on the edge graph.
export function knightDistances(
  state: GameState,
  from: EdgeId,
  max: number = BARBARIAN_KNIGHT_MOVE_BOOSTED,
): Map<EdgeId, number> {
  const dist = new Map<EdgeId, number>([[from, 0]]);
  let frontier: EdgeId[] = [from];
  for (let d = 1; d <= max && frontier.length > 0; d++) {
    const next: EdgeId[] = [];
    for (const e of frontier) {
      for (const n of state.board.edges[e]?.neighborEdges ?? []) {
        if (dist.has(n) || !isKnightEdge(state, n)) continue;
        dist.set(n, d);
        next.push(n);
      }
    }
    frontier = next;
  }
  return dist;
}

export interface KnightMoveTarget {
  edge: EdgeId;
  distance: number;
  // Needs the 1-wheat boost (4 or 5 edges away).
  boost: boolean;
}

// Where the knight on `from` may end its move: within 3 edges (5 with the
// wheat boost), on an edge without another knight, never on a castle edge.
export function knightMoveTargets(state: GameState, from: EdgeId): KnightMoveTarget[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  const out: KnightMoveTarget[] = [];
  for (const [edge, distance] of knightDistances(state, from)) {
    if (distance === 0) continue;
    if (ba.knights[edge]) continue;
    if (isCastleEdge(state, edge)) continue;
    out.push({ edge, distance, boost: distance > BARBARIAN_KNIGHT_MOVE });
  }
  return out;
}

// The acting player's knights that may still move this turn.
export function movableKnights(state: GameState, playerId: PlayerId): EdgeId[] {
  const moved = new Set(state.barbarianAttack?.movedKnights ?? []);
  return playerKnightEdges(state, playerId).filter(
    (e) => !moved.has(e) && knightMoveTargets(state, e).length > 0,
  );
}

// Knights on a castle edge must move this turn (when they can).
export function knightsThatMustMove(state: GameState, playerId: PlayerId): EdgeId[] {
  return movableKnights(state, playerId).filter((e) => isCastleEdge(state, e));
}

// Knighthood: a castle edge with no knight on it.
export function freeCastleEdges(state: GameState): EdgeId[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  return castleEdgeIds(state).filter((e) => !ba.knights[e]);
}

// Swift Knight: any island edge with no knight on it.
export function freeKnightEdges(state: GameState): EdgeId[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  return state.board.edgeIds.filter((e) => !ba.knights[e] && isKnightEdge(state, e));
}

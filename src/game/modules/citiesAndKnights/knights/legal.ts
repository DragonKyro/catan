import type { GameState, KnightStrength, PlayerId, VertexId } from '../../../types';
import { COSTS } from '../../../types';
import { canAfford } from '../../../resources';
import {
  knightAt,
  mightyAllowed,
  supplyAvailable,
  vertexAdjacentToRobber,
  vertexConnectedToOwnNetwork,
  vertexIsOccupied,
} from './state';
import { enemyKnightDisplacementTargets, reachableEmptyVertices } from './graph';

// Pure legality helpers for Cities & Knights knights (p.9-10). Shared by the
// engine handlers, the board overlay and the AI so all three agree.

// May the knight on `vertex` take a knight action (move / displace / chase
// the robber) now? It must be active and must not have been stood up this
// turn: only knights active at the start of the Action phase may act.
export function knightCanAct(state: GameState, vertex: VertexId): boolean {
  const k = knightAt(state, vertex);
  if (!k || !k.active) return false;
  if (k.activatedThisTurn) return false;
  return !(state.activatedKnightsThisTurn ?? []).includes(vertex);
}

// Recruit placement (p.9): an empty intersection (no building, no knight)
// touching one of the player's roads. No distance rule.
export function canRecruitKnightAt(state: GameState, playerId: PlayerId, vertex: VertexId): boolean {
  if (!state.board.vertices[vertex]) return false;
  if (vertexIsOccupied(state, vertex)) return false;
  return vertexConnectedToOwnNetwork(state, playerId, vertex);
}

// Recruit a basic knight at all: a basic knight in the supply + the cost.
export function canRecruitKnight(state: GameState, playerId: PlayerId): boolean {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return false;
  return supplyAvailable(state, playerId, 1) > 0 && canAfford(p.resources, COSTS.knight);
}

export function recruitSpots(state: GameState, playerId: PlayerId): VertexId[] {
  return state.board.vertexIds.filter((v) => canRecruitKnightAt(state, playerId, v));
}

// Promote placement rules (p.9), cost aside (Smithing promotes for free):
// your knight, below mighty, not promoted yet this turn, the next strength
// in your supply, and mighty needs politics level 3 (Fortress).
export function canPromoteKnightAt(state: GameState, playerId: PlayerId, vertex: VertexId): boolean {
  const k = knightAt(state, vertex);
  if (!k || k.playerId !== playerId) return false;
  if (k.strength >= 3 || k.promotedThisTurn) return false;
  const nextStrength = (k.strength + 1) as KnightStrength;
  if (nextStrength === 3 && !mightyAllowed(state, playerId)) return false;
  return supplyAvailable(state, playerId, nextStrength) > 0;
}

export function canActivateKnightAt(state: GameState, playerId: PlayerId, vertex: VertexId): boolean {
  const k = knightAt(state, vertex);
  return !!k && k.playerId === playerId && !k.active;
}

// Empty intersections the knight on `vertex` can move to (p.9).
export function legalKnightMoves(state: GameState, vertex: VertexId): VertexId[] {
  const k = knightAt(state, vertex);
  if (!k || !knightCanAct(state, vertex)) return [];
  return [...reachableEmptyVertices(state, k.playerId, vertex)];
}

// Opposing knights the knight on `vertex` can displace (p.10): reachable
// along its owner's routes and strictly weaker.
export function legalDisplaceTargets(state: GameState, vertex: VertexId): VertexId[] {
  const k = knightAt(state, vertex);
  if (!k || !knightCanAct(state, vertex)) return [];
  return [...enemyKnightDisplacementTargets(state, k.playerId, vertex, k.strength)];
}

// Chase away the robber (p.10): an acting knight on a corner of the
// robber's hex, once the robber is on the board.
export function canChaseRobberFrom(state: GameState, vertex: VertexId): boolean {
  if (!state.robberActive) return false;
  return knightCanAct(state, vertex) && vertexAdjacentToRobber(state, vertex);
}

// Intrigue (p.15): opposing knights standing on an intersection connected to
// one of the player's routes.
export function legalIntrigueTargets(state: GameState, playerId: PlayerId): VertexId[] {
  const out: VertexId[] = [];
  for (const [vid, k] of Object.entries(state.knights ?? {})) {
    if (k.playerId === playerId) continue;
    if (vertexConnectedToOwnNetwork(state, playerId, vid)) out.push(vid);
  }
  return out;
}

// Treason (p.16): where the attacker may place their knight (normal
// placement rules: empty, on one of their roads).
export function treasonPlacementSpots(state: GameState, playerId: PlayerId): VertexId[] {
  return recruitSpots(state, playerId);
}

// Strengths the Treason attacker could place: <= the removed knight, in
// their supply. A removed mighty knight lets them place a mighty one even
// without the politics level 3.
export function treasonPlaceableStrengths(state: GameState): KnightStrength[] {
  const t = state.pendingTreason;
  if (!t?.removedStrength) return [];
  const out: KnightStrength[] = [];
  for (const s of [1, 2, 3] as KnightStrength[]) {
    if (s > t.removedStrength) continue;
    if (supplyAvailable(state, t.attackerId, s) > 0) out.push(s);
  }
  return out;
}

// Does any knight of `playerId` have a legal knight action right now?
export function hasKnightAction(state: GameState, playerId: PlayerId): boolean {
  for (const [vid, k] of Object.entries(state.knights ?? {})) {
    if (k.playerId !== playerId || !knightCanAct(state, vid)) continue;
    if (legalKnightMoves(state, vid).length > 0) return true;
    if (legalDisplaceTargets(state, vid).length > 0) return true;
    if (canChaseRobberFrom(state, vid)) return true;
  }
  return false;
}

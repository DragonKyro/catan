import type { Action, GameState, Player, PlayerId, Resource, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { applyAction } from '@/game/engine';
import { totalResources } from '@/game/resources';
import { calculateVictoryPoints } from '@/game/scoring/points';

// Shared helpers for the Explorers & Pirates heuristic AI. Pure: no React,
// no store, no randomness. The engine is the authority on legality — every
// action the AI returns goes through the reducer first (`firstLegal`).

export function isLegal(state: GameState, action: Action): boolean {
  try {
    applyAction(state, action);
    return true;
  } catch {
    return false;
  }
}

// First action in `candidates` the engine accepts, or null.
export function firstLegal(state: GameState, candidates: Iterable<Action | null | undefined>): Action | null {
  for (const a of candidates) {
    if (a && isLegal(state, a)) return a;
  }
  return null;
}

export function playerOf(state: GameState, pid: PlayerId): Player {
  const p = state.players.find((x) => x.id === pid);
  if (!p) throw new Error(`Unknown player ${pid}`);
  return p;
}

export function goldOf(state: GameState, pid: PlayerId): number {
  return playerOf(state, pid).gold ?? 0;
}

export function handSize(state: GameState, pid: PlayerId): number {
  return totalResources(playerOf(state, pid).resources);
}

export function publicVp(state: GameState, pid: PlayerId): number {
  return calculateVictoryPoints(state, pid, false);
}

// Cards still missing to pay `cost` from `hand`.
export function shortfall(hand: ResourceBank, cost: Partial<ResourceBank>): Record<Resource, number> {
  const out: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  for (const r of RESOURCES) out[r] = Math.max(0, (cost[r] ?? 0) - hand[r]);
  return out;
}

export function sumShort(s: Record<Resource, number>): number {
  return RESOURCES.reduce((n, r) => n + s[r], 0);
}

// Does paying `cost` out of `hand` leave what `keep` needs from the cards we
// hold now? (A lower-priority build must not eat the cards of the build
// we're closest to.)
export function leavesReserve(
  hand: ResourceBank,
  cost: Partial<ResourceBank>,
  keep: Partial<ResourceBank> | null,
): boolean {
  if (!keep) return true;
  for (const r of RESOURCES) {
    const after = hand[r] - (cost[r] ?? 0);
    if (after < Math.min(hand[r], keep[r] ?? 0)) return false;
  }
  return true;
}

// Seats other than `pid`, in turn order.
export function opponents(state: GameState, pid: PlayerId): PlayerId[] {
  return state.playerOrder.filter((p) => p !== pid);
}

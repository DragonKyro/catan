import type { Action, GameState, PlayerId } from '@/game/types';
import { chooseRobberMove } from '../robber';
import { assessThreats } from '../threats';
import { firstLegal, handSizeCK, hexCorners, playerById } from './common';

// Robber moves in C&K. The hex choice is the base heuristic's; the steal
// pool is resources + commodities (a commodity-only hand can be robbed and
// MUST be picked when it's the only one on the hex).
export function chooseRobberMoveCK(state: GameState, playerId: PlayerId): Action | null {
  const { hex } = chooseRobberMove(state, playerId);
  const threats = assessThreats(state);
  const victims = new Set<PlayerId>();
  for (const v of hexCorners(state, hex)) {
    for (const p of state.players) {
      if (p.id === playerId) continue;
      if ((p.settlements.includes(v) || p.cities.includes(v)) && handSizeCK(p) > 0) victims.add(p.id);
    }
  }
  const ranked = [...victims].sort((a, b) => {
    const score = (id: PlayerId) =>
      handSizeCK(playerById(state, id)) + (threats[id]?.closeToWin ? 100 : 0) + (threats[id]?.isLeader ? 20 : 0);
    return score(b) - score(a);
  });
  const candidates: Action[] = ranked.map((stealFrom) => ({ type: 'moveRobber', playerId, hex, stealFrom }));
  candidates.push({ type: 'moveRobber', playerId, hex, stealFrom: null });
  const legal = firstLegal(state, candidates);
  if (legal) return legal;
  // The engine refused that hex (scenario rule we don't model): any legal one.
  for (const h of state.board.hexIds) {
    if (h === state.board.robberHex) continue;
    const a = firstLegal(state, [
      { type: 'moveRobber', playerId, hex: h, stealFrom: null },
      ...state.players
        .filter((p) => p.id !== playerId)
        .map((p) => ({ type: 'moveRobber' as const, playerId, hex: h, stealFrom: p.id })),
    ]);
    if (a) return a;
  }
  return null;
}

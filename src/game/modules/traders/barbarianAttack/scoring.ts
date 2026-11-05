import type { GameState, PlayerId } from '../../../types';
import { BARBARIAN_PRISONERS_PER_VP } from '../constants';
import { conqueredBuildingVertices, prisonersOf } from './state';

// Barbarian Attack VP adjustments: every 2 prisoners = 1 VP, and conquered
// buildings are worth nothing (their usual 1 / 2 VP is taken back).
export function calculateBarbarianAttackVp(state: GameState, playerId: PlayerId): number {
  if (!state.barbarianAttack) return 0;
  let vp = Math.floor(prisonersOf(state, playerId) / BARBARIAN_PRISONERS_PER_VP);
  const conquered = conqueredBuildingVertices(state);
  if (conquered.size > 0) {
    const p = state.players.find((pl) => pl.id === playerId);
    if (p) {
      for (const v of p.settlements) if (conquered.has(v)) vp -= 1;
      for (const v of p.cities) if (conquered.has(v)) vp -= 2;
    }
  }
  return vp;
}

import type { ChoosePillagedCityAction, GameState } from '../../../types';
import { pillageableCities, pillageCity } from '../barbarian';
import { resumeFlow } from '../flow';

// Barbarians won (p.11): a losing player with more than one pillageable city
// picks which one is reduced to a settlement. Answered in turn order from
// the active player; then the roll carries on (production, 7, …).
export function handleChoosePillagedCity(
  state: GameState,
  action: ChoosePillagedCityAction,
): GameState {
  if (state.phase !== 'choosePillage') {
    throw new Error(`Cannot choose a pillaged city in phase ${state.phase}`);
  }
  const queue = state.pendingPillage ?? [];
  if (queue[0] !== action.playerId) throw new Error('Not your choice to make');
  if (!pillageableCities(state, action.playerId).includes(action.vertex)) {
    throw new Error('Pick one of your cities without a metropolis');
  }
  const next = pillageCity(state, action.playerId, action.vertex);
  return resumeFlow({ ...next, pendingPillage: queue.slice(1) });
}

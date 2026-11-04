import type { GameState, KnightStrength, PlayerId, RecruitKnightAction } from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { supplyAvailable } from '../knights/state';
import { canRecruitKnightAt } from '../knights/legal';

// Recruit a basic knight (p.9). Cost: 1 wool + 1 ore. It's placed lying
// down (inactive) on an empty intersection connected to one of your roads;
// knights ignore the Distance Rule. Only basic knights are recruited: with
// none left in your supply you must promote one first.
export function handleRecruitKnight(state: GameState, action: RecruitKnightAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot recruit knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (supplyAvailable(state, action.playerId, 1) <= 0) {
    throw new Error('No basic knights left in supply — promote one instead');
  }
  if (!canAfford(player.resources, COSTS.knight)) {
    throw new Error('Cannot afford to recruit a knight (1 wool + 1 ore)');
  }
  if (!canRecruitKnightAt(state, action.playerId, action.vertex)) {
    throw new Error('A knight goes on an empty intersection next to one of your roads');
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, COSTS.knight),
  }));
  next = {
    ...next,
    bank: addResources(next.bank, COSTS.knight),
    knights: {
      ...(next.knights ?? {}),
      [action.vertex]: { playerId: action.playerId, strength: 1, active: false },
    },
  };
  return adjustSupply(next, action.playerId, 1, -1);
}

// Add `delta` knights of `strength` to a player's supply.
export function adjustSupply(
  state: GameState,
  playerId: PlayerId,
  strength: KnightStrength,
  delta: number,
): GameState {
  const cur = state.knightSupply?.[playerId] ?? { 1: 0, 2: 0, 3: 0 };
  return {
    ...state,
    knightSupply: {
      ...(state.knightSupply ?? {}),
      [playerId]: { ...cur, [strength]: (cur[strength] ?? 0) + delta },
    },
  };
}

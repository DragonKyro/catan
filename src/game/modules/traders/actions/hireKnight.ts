import type { GameState, HireKnightAction } from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import { canAfford, subtractResources, addResources } from '../../../resources';
import { canPlaceKnight } from '../barbarianAttack/placement';

// T&B / Barbarian Attack: hire a defender knight on a castle-adjacent
// edge. Costs 1 wheat + 1 ore (see `COSTS.hireKnight`); consumes one
// token from the shared `state.barbarianKnightSupply`.
export function handleHireKnight(
  state: GameState,
  action: HireKnightAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot hire knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) {
    throw new Error('Not your turn');
  }
  if (!state.castles?.length) {
    throw new Error('Barbarian Attack scenario not active');
  }
  if ((state.barbarianKnightSupply ?? 0) <= 0) {
    throw new Error('No defender knights left in the supply');
  }
  if (!canPlaceKnight(state, action.edge, action.playerId)) {
    throw new Error('Invalid knight placement');
  }
  const player = getPlayer(state, action.playerId);
  if (!canAfford(player.resources, COSTS.hireKnight)) {
    throw new Error('Cannot afford knight (1 wheat + 1 ore)');
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    defenderKnights: [...(p.defenderKnights ?? []), action.edge],
    resources: subtractResources(p.resources, COSTS.hireKnight),
  }));
  next = {
    ...next,
    bank: addResources(next.bank, COSTS.hireKnight),
    barbarianKnightSupply: (next.barbarianKnightSupply ?? 0) - 1,
  };
  return next;
}

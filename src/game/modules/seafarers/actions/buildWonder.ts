import type { GameState, BuildWonderAction, ClaimWonderAction } from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import { canAfford, subtractResources, addResources } from '../../../resources';
import { claimedWonderOf, getWonder, WONDER_LEVELS } from '../wonders/catalogue';

// Wonders of Catan (rulebook p.18): "Before you can begin a wonder, you must
// meet the requirements shown on its tile. When you do so, you may claim it
// ... No other player may then claim or build that wonder. You may only
// claim 1 wonder."
export function handleClaimWonder(state: GameState, action: ClaimWonderAction): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot claim a wonder in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.wonders) throw new Error('Wonders are not in this game');
  const wonder = state.wonders.find((w) => w.id === action.wonderId);
  if (!wonder) throw new Error(`Unknown wonder: ${action.wonderId}`);
  const def = getWonder(action.wonderId);
  if (wonder.claimedBy !== null) throw new Error(`${def.name} is already claimed`);
  if (claimedWonderOf(state, action.playerId)) {
    throw new Error('You may only claim one wonder');
  }
  if (!def.requirementMet(state, action.playerId)) {
    throw new Error(`Requirement not met: ${def.requirement}`);
  }
  return {
    ...state,
    wonders: state.wonders.map((w) =>
      w.id === action.wonderId ? { ...w, claimedBy: action.playerId } : w,
    ),
  };
}

// "To start building a wonder, pay the cost shown at the top of the tile,
// then place your wonder marker on space 1. Each of the four levels of a
// wonder costs the same 5 resources ... You may build as many levels on a
// turn as you want and can afford ... When you reach level 4, your wonder
// is complete" — and you win at once.
//
// Building a level of an unclaimed wonder claims it first (requirements are
// checked by the claim).
export function handleBuildWonder(state: GameState, action: BuildWonderAction): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot build a wonder in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.wonders) throw new Error('Wonders are not in this game');

  let next = state;
  const target = state.wonders.find((w) => w.id === action.wonderId);
  if (!target) throw new Error(`Unknown wonder: ${action.wonderId}`);
  const def = getWonder(action.wonderId);
  if (target.claimedBy === null) {
    next = handleClaimWonder(next, { type: 'claimWonder', playerId: action.playerId, wonderId: action.wonderId });
  } else if (target.claimedBy !== action.playerId) {
    throw new Error(`${def.name} belongs to another player`);
  }
  const wonder = next.wonders!.find((w) => w.id === action.wonderId)!;
  if (wonder.level >= WONDER_LEVELS) throw new Error(`${def.name} is already complete`);

  const player = getPlayer(next, action.playerId);
  if (!canAfford(player.resources, def.costPerLevel)) {
    throw new Error(`Cannot afford ${def.name} level ${wonder.level + 1}`);
  }
  next = updatePlayer(next, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, def.costPerLevel),
  }));
  next = { ...next, bank: addResources(next.bank, def.costPerLevel) };

  const level = wonder.level + 1;
  next = {
    ...next,
    wonders: next.wonders!.map((w) => (w.id === action.wonderId ? { ...w, level } : w)),
  };
  if (level >= WONDER_LEVELS) {
    next = { ...next, winner: action.playerId, phase: 'gameOver' };
  }
  return next;
}

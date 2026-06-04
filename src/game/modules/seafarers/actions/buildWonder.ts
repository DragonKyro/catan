import type { GameState, BuildWonderAction } from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import { canAfford, subtractResources, addResources } from '../../../resources';
import { getWonder } from '../wonders/catalogue';

// Build (or progress) a wonder. Validates phase, current player, wonder
// state (not maxed, not claimed by someone else), prereq, and cost. The
// engine's win check sees the new level on the next recomputeDerived
// pass — when a wonder hits its max level we set winner+phase ourselves
// so completion wins immediately, regardless of VP total (Wonders of
// Catan rulebook: "first to finish a wonder wins").
export function handleBuildWonder(
  state: GameState,
  action: BuildWonderAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot build wonder in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.wonders) throw new Error('Wonders are not active in this game');

  const wonderState = state.wonders.find((w) => w.id === action.wonderId);
  if (!wonderState) throw new Error(`Unknown wonder: ${action.wonderId}`);
  const def = getWonder(action.wonderId);

  if (wonderState.builtBy !== null && wonderState.builtBy !== action.playerId) {
    throw new Error(`${def.name} is being built by another player`);
  }
  if (wonderState.level >= def.maxLevel) {
    throw new Error(`${def.name} is already complete`);
  }
  if (!def.prereqMet(state, action.playerId)) {
    throw new Error(`Prerequisite not met: ${def.prereqLabel}`);
  }

  const player = getPlayer(state, action.playerId);
  if (!canAfford(player.resources, def.costPerLevel)) {
    throw new Error(`Cannot afford ${def.name} level ${wonderState.level + 1}`);
  }

  let next: GameState = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, def.costPerLevel),
  }));
  next = { ...next, bank: addResources(next.bank, def.costPerLevel) };

  const newLevel = wonderState.level + 1;
  next = {
    ...next,
    wonders: next.wonders!.map((w) =>
      w.id === action.wonderId
        ? { ...w, builtBy: action.playerId, level: newLevel }
        : w,
    ),
  };

  // Completing a wonder is an instant win — short-circuit the normal VP
  // check by setting winner + gameOver right here.
  if (newLevel >= def.maxLevel) {
    next = { ...next, winner: action.playerId, phase: 'gameOver' };
  }

  return next;
}

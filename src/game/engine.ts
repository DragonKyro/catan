import type { GameState, Action, PlayerId } from './types';
import type { RuleModule } from './modules/types';
import { baseModule } from './modules/base';
import { seafarersModule } from './modules/seafarers';
import { SEAFARERS_EXPANSION_ID } from './modules/seafarers/constants';
import { calculateLongestTradeRoute } from './modules/seafarers/scoring/longestTradeRoute';
import { calculateLongestRoad } from './scoring/longestRoad';
import { calculateLargestArmy } from './scoring/largestArmy';
import {
  calculateLongestRoadHolder,
  calculateVictoryPoints,
} from './scoring/points';

// Modules are ordered most-specific first. The first module with a handler
// for the action type wins, so expansion modules can intercept base actions
// (used for the Seafarers buildSettlement island-chip intercept in phase 6).
export function getActiveModules(state: GameState): RuleModule[] {
  const out: RuleModule[] = [];
  if (state.settings.expansions.includes(SEAFARERS_EXPANSION_ID)) {
    out.push(seafarersModule);
  }
  out.push(baseModule);
  return out;
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase === 'gameOver') {
    throw new Error('Game is over');
  }
  for (const mod of getActiveModules(state)) {
    const handler = mod.handlers[action.type];
    if (handler) {
      const next = handler(state, action);
      return recomputeDerived(next);
    }
  }
  throw new Error(`No handler for action type: ${action.type}`);
}

function recomputeDerived(state: GameState): GameState {
  const useTradeRoute = state.settings.expansions.includes(SEAFARERS_EXPANSION_ID);
  const lengths = new Map<PlayerId, number>();
  for (const p of state.players) {
    lengths.set(
      p.id,
      useTradeRoute
        ? calculateLongestTradeRoute(state, p.id)
        : calculateLongestRoad(state, p.id),
    );
  }
  const longestRoad = calculateLongestRoadHolder(state, lengths);
  const largestArmy = calculateLargestArmy(state);

  const players = state.players.map((p) => ({
    ...p,
    hasLongestRoad: longestRoad?.holder === p.id,
    hasLargestArmy: largestArmy?.holder === p.id,
  }));

  let next: GameState = { ...state, players, longestRoad, largestArmy };

  // Win check — only mid-game / main phases, and only for the turn holder.
  // During Special Build Phase the acting player can earn VP but cannot win
  // (official rule: you can only win on your own turn). We key off
  // turnHolderIndex when present so SBP-builders are excluded from the check.
  if (
    next.phase !== 'setupRound1' &&
    next.phase !== 'setupRound2' &&
    next.phase !== 'specialBuildPhase' &&
    next.phase !== 'gameOver'
  ) {
    const idx = next.turnHolderIndex ?? next.currentPlayerIndex;
    const currentId = next.playerOrder[idx]!;
    const vp = calculateVictoryPoints(next, currentId, true);
    if (vp >= next.settings.victoryPointsToWin) {
      next = { ...next, winner: currentId, phase: 'gameOver' };
    }
  }

  return next;
}

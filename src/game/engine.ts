import type { GameState, Action, PlayerId } from './types';
import { baseModule } from './modules/base';
import { calculateLongestRoad } from './scoring/longestRoad';
import { calculateLargestArmy } from './scoring/largestArmy';
import {
  calculateLongestRoadHolder,
  calculateVictoryPoints,
} from './scoring/points';

const ACTIVE_MODULES = [baseModule];

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase === 'gameOver') {
    throw new Error('Game is over');
  }
  for (const mod of ACTIVE_MODULES) {
    const handler = mod.handlers[action.type];
    if (handler) {
      const next = handler(state, action);
      return recomputeDerived(next);
    }
  }
  throw new Error(`No handler for action type: ${action.type}`);
}

function recomputeDerived(state: GameState): GameState {
  const lengths = new Map<PlayerId, number>();
  for (const p of state.players) {
    lengths.set(p.id, calculateLongestRoad(state, p.id));
  }
  const longestRoad = calculateLongestRoadHolder(state, lengths);
  const largestArmy = calculateLargestArmy(state);

  const players = state.players.map((p) => ({
    ...p,
    hasLongestRoad: longestRoad?.holder === p.id,
    hasLargestArmy: largestArmy?.holder === p.id,
  }));

  let next: GameState = { ...state, players, longestRoad, largestArmy };

  // Win check — only mid-game / main phases, and only for the current player.
  if (
    next.phase !== 'setupRound1' &&
    next.phase !== 'setupRound2' &&
    next.phase !== 'gameOver'
  ) {
    const currentId = next.playerOrder[next.currentPlayerIndex]!;
    const vp = calculateVictoryPoints(next, currentId, true);
    if (vp >= next.settings.victoryPointsToWin) {
      next = { ...next, winner: currentId, phase: 'gameOver' };
    }
  }

  return next;
}

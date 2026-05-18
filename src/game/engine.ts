import type { GameState, Action, PlayerId, MoveRobberAction } from './types';
import type { RuleModule } from './modules/types';
import { baseModule } from './modules/base';
import { seafarersModule } from './modules/seafarers';
import { citiesAndKnightsModule } from './modules/citiesAndKnights';
import { tradersModule } from './modules/traders';
import { SEAFARERS_EXPANSION_ID } from './modules/seafarers/constants';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from './modules/citiesAndKnights/constants';
import { TRADERS_EXPANSION_ID } from './modules/traders/constants';
import { calculateLongestTradeRoute } from './modules/seafarers/scoring/longestTradeRoute';
import { calculateLongestRoad } from './scoring/longestRoad';
import { calculateLargestArmy } from './scoring/largestArmy';
import {
  calculateLongestRoadHolder,
  calculateVictoryPoints,
} from './scoring/points';

// Modules are ordered most-specific first. The first module with a handler
// for the action type wins, so expansion modules can intercept base actions
// (used for the Seafarers buildSettlement island-chip intercept in phase 6,
// the T&B build wrappers that grant river-gold, and Cities & Knights'
// full overrides of rollDice / discard / etc.).
export function getActiveModules(state: GameState): RuleModule[] {
  const out: RuleModule[] = [];
  if (state.settings.expansions.includes(TRADERS_EXPANSION_ID)) {
    out.push(tradersModule);
  }
  if (state.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID)) {
    out.push(citiesAndKnightsModule);
  }
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
  // Module-level validators run before the dispatched handler. A non-null
  // return aborts the action with a thrown error — handlers never see the
  // rejected action. Currently only T&B's Friendly Robber registers one.
  if (action.type === 'moveRobber') {
    for (const mod of getActiveModules(state)) {
      const err = mod.validators?.moveRobber?.(
        state,
        action as MoveRobberAction,
      );
      if (err) throw new Error(err);
    }
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

  // Win check — only mid-game / main phases, and only the acting seat can win.
  // For 5+ player paired-player rules the acting seat is whichever of
  // Player 1 / Player 2 is currently `currentPlayerIndex`, so this naturally
  // gives Player 1 the simultaneous-10 tiebreak: P1's actions are processed
  // first, so the game is already 'gameOver' before P2 takes their part.
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

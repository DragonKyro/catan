import type { GameState, Action, PlayerId, MoveRobberAction, HexId } from './types';
import type { RuleModule } from './modules/types';
import { baseModule } from './modules/base';
import { seafarersModule } from './modules/seafarers';
import { citiesAndKnightsModule } from './modules/citiesAndKnights';
import { tradersModule } from './modules/traders';
import { explorersPiratesModule } from './modules/explorersPirates';
import { EXPLORERS_PIRATES_EXPANSION_ID } from './modules/explorersPirates/constants';
import { SEAFARERS_EXPANSION_ID } from './modules/seafarers/constants';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from './modules/citiesAndKnights/constants';
import { TRADERS_EXPANSION_ID } from './modules/traders/constants';
import { tradersVariantModules } from './modules/traders/variants';
import { canMoveRobberTo } from './placement';
import { totalResources } from './resources';
import { calculateLongestRoad } from './scoring/longestRoad';
import { isSetupPhase } from './actions/setup';
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
  // Traders & Barbarians variants (Friendly Robber, Strongest Ports, Catan
  // Event Cards) layer on top of any rule set, so they go first; a variant
  // that wraps an action hands it on with `applyNextModuleHandler`.
  const out: RuleModule[] = tradersVariantModules(state.settings);
  if (state.settings.expansions.includes(EXPLORERS_PIRATES_EXPANSION_ID)) {
    out.push(explorersPiratesModule);
  }
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

// Run `action` through the first module AFTER `moduleId` that handles it —
// for a variant module that wraps an action (Event Cards wraps the roll) and
// then lets whichever rule set is in play do the rest. Returns the raw next
// state; the outer applyAction recomputes derived state.
export function applyNextModuleHandler(
  state: GameState,
  action: Action,
  moduleId: string,
): GameState {
  const mods = getActiveModules(state);
  const from = mods.findIndex((m) => m.id === moduleId);
  for (const mod of mods.slice(from + 1)) {
    const handler = mod.handlers[action.type];
    if (handler) return handler(state, action);
  }
  throw new Error(`No handler for action type: ${action.type}`);
}

// May `moverId` put the robber on `hexId`? The board rule (`canMoveRobberTo`)
// plus every active module's moveRobber validator (Friendly Robber, …).
// Shared by the robber handler's callers, the board highlights and the AI.
export function robberHexAllowed(
  state: GameState,
  hexId: HexId,
  moverId: PlayerId,
): boolean {
  if (!canMoveRobberTo(state, hexId)) return false;
  const probe: MoveRobberAction = { type: 'moveRobber', playerId: moverId, hex: hexId, stealFrom: null };
  return getActiveModules(state).every((m) => !m.validators?.moveRobber?.(state, probe));
}

// Players `moverId` may rob after moving the robber to `hexId`: opponents
// with a building on the hex and at least one card, minus anyone a module
// rules out (Friendly Robber: 2 VPs or fewer).
export function robberStealCandidates(
  state: GameState,
  moverId: PlayerId,
  hexId: HexId,
): PlayerId[] {
  const corners = new Set(state.board.hexes[hexId]?.corners ?? []);
  const mods = getActiveModules(state);
  return state.players
    .filter(
      (p) =>
        p.id !== moverId &&
        (p.settlements.some((v) => corners.has(v)) || p.cities.some((v) => corners.has(v))) &&
        // Cities & Knights: commodity cards can be stolen too.
        totalResources(p.resources) +
          (p.commodities ? p.commodities.paper + p.commodities.cloth + p.commodities.coin : 0) >
          0 &&
        mods.every((m) => !m.validators?.robberVictim?.(state, hexId, p.id)),
    )
    .map((p) => p.id);
}

// Longest Road / Route length for a player under the active rules.
export function calculateRouteLength(state: GameState, playerId: PlayerId): number {
  for (const mod of getActiveModules(state)) {
    if (mod.routeLength) return mod.routeLength(state, playerId);
  }
  return calculateLongestRoad(state, playerId);
}

// Has the acting seat won? Scenario modules may replace the plain VP check.
export function hasPlayerWon(state: GameState, playerId: PlayerId): boolean {
  const vp = calculateVictoryPoints(state, playerId, true);
  for (const mod of getActiveModules(state)) {
    const verdict = mod.hasWon?.(state, playerId, vp);
    if (verdict !== undefined) return verdict;
  }
  // Traders & Barbarians / Fishing on Catan: the old boot holder needs +1 VP
  // to win. Per-player win threshold so the rest of the table is unaffected.
  const bootTax = state.oldBootHolder === playerId ? 1 : 0;
  return vp >= state.settings.victoryPointsToWin + bootTax;
}

function recomputeDerived(state: GameState): GameState {
  const lengths = new Map<PlayerId, number>();
  for (const p of state.players) {
    lengths.set(p.id, calculateRouteLength(state, p.id));
  }
  // Some scenarios return the Longest Route / Largest Army tiles to the box.
  const longestRoad = state.noLongestRoad ? null : calculateLongestRoadHolder(state, lengths);
  const largestArmy = state.noLargestArmy ? null : calculateLargestArmy(state);

  const players = state.players.map((p) => ({
    ...p,
    hasLongestRoad: longestRoad?.holder === p.id,
    hasLargestArmy: largestArmy?.holder === p.id,
  }));

  let next: GameState = { ...state, players, longestRoad, largestArmy };
  for (const mod of getActiveModules(next)) {
    if (mod.derive) next = mod.derive(next);
  }

  // Win check — only mid-game / main phases, and only the acting seat can win.
  // For 5+ player paired-player rules the acting seat is whichever of
  // Player 1 / Player 2 is currently `currentPlayerIndex`, so this naturally
  // gives Player 1 the simultaneous-10 tiebreak: P1's actions are processed
  // first, so the game is already 'gameOver' before P2 takes their part.
  if (!isSetupPhase(next.phase) && next.phase !== 'gameOver') {
    const currentId = next.playerOrder[next.currentPlayerIndex]!;
    if (hasPlayerWon(next, currentId)) {
      next = { ...next, winner: currentId, phase: 'gameOver' };
    }
  }

  return next;
}

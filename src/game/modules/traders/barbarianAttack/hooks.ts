import type {
  BuildCityAction,
  BuildSettlementAction,
  BuyDevCardAction,
  DiscardAction,
  GameState,
  PlaceInitialSettlementAction,
  RollDiceAction,
} from '../../../types';
import type { ActionHandler } from '../../types';
import { updatePlayer } from '../../../helpers';
import { handleRollDice as baseHandleRollDice } from '../../../actions/dice';
import { handleDiscard as baseHandleDiscard } from '../../../actions/robber';
import { handleBuyDevCard as baseHandleBuyDevCard } from '../../../actions/devcard';
import { conqueredHexes, isBarbarianAttack, vertexTouchesConqueredHex } from './state';
import { resolveBarbarianLanding } from './landing';
import { handleBuyBarbarianCard } from './cards';

// Barbarian Attack hooks around base handlers. Each wrapper passes straight
// through to the wrapped handler outside the scenario.

// Conquered hexes don't produce: hide their number discs from the base dice
// handler for the roll. A 7 has no robber to move — after any discards the
// roller steals 1 random resource from a player of their choice (the
// 'stealResource' phase).
export function handleRollDiceBarbarianAttack(state: GameState, action: RollDiceAction): GameState {
  if (!isBarbarianAttack(state)) return baseHandleRollDice(state, action);
  const conquered = conqueredHexes(state);
  let rollOn = state;
  if (conquered.length > 0) {
    const hexes = { ...state.board.hexes };
    for (const h of conquered) hexes[h] = { ...hexes[h]!, numberToken: null };
    rollOn = { ...state, board: { ...state.board, hexes } };
  }
  const next = baseHandleRollDice(rollOn, action);
  return stealInsteadOfRobber({ ...next, board: state.board });
}

export function handleDiscardBarbarianAttack(state: GameState, action: DiscardAction): GameState {
  return stealInsteadOfRobber(baseHandleDiscard(state, action));
}

function stealInsteadOfRobber(state: GameState): GameState {
  if (!isBarbarianAttack(state) || state.phase !== 'moveRobber') return state;
  return { ...state, phase: 'stealResource' };
}

// "Each time you place a building, you must immediately interrupt your turn
// and resolve a barbarian attack." Cities may not go on a conquered hex's
// intersection either.
export function withBarbarianLandingOnSettlement(
  inner: ActionHandler<BuildSettlementAction>,
): ActionHandler<BuildSettlementAction> {
  return (state, action) => {
    const next = inner(state, action);
    return isBarbarianAttack(next) ? resolveBarbarianLanding(next, action.playerId) : next;
  };
}

export function withBarbarianLandingOnCity(
  inner: ActionHandler<BuildCityAction>,
): ActionHandler<BuildCityAction> {
  return (state, action) => {
    if (isBarbarianAttack(state) && vertexTouchesConqueredHex(state, action.vertex)) {
      throw new Error('You may not build on the intersections of a conquered hex');
    }
    const next = inner(state, action);
    return isBarbarianAttack(next) ? resolveBarbarianLanding(next, action.playerId) : next;
  };
}

// "When placing your starting pieces, your second placement is a city."
// The base handler already pays 1 resource per adjacent hex for it.
export function withBarbarianSetupCity(
  inner: ActionHandler<PlaceInitialSettlementAction>,
): ActionHandler<PlaceInitialSettlementAction> {
  return (state, action) => {
    const secondPlacement = state.phase === 'setupRound2';
    const next = inner(state, action);
    if (!isBarbarianAttack(next) || !secondPlacement) return next;
    return updatePlayer(next, action.playerId, (p) => ({
      ...p,
      settlements: p.settlements.filter((v) => v !== action.vertex),
      cities: [...p.cities, action.vertex],
    }));
  };
}

// The scenario's own deck replaces the base development cards.
export function handleBuyDevCardTraders(state: GameState, action: BuyDevCardAction): GameState {
  if (isBarbarianAttack(state)) return handleBuyBarbarianCard(state, action);
  return baseHandleBuyDevCard(state, action);
}

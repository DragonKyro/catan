import type {
  BuildCityAction,
  BuildRoadAction,
  GameState,
} from '../../../types';
import { COSTS } from '../../../types';
import {
  handleBuildRoad as baseHandleBuildRoad,
  handleBuildCity as baseHandleBuildCity,
} from '../../../actions/build';
import { updatePlayer } from '../../../helpers';
import { addResources } from '../../../resources';

// Cities & Knights — wraps the base build handlers to honour progress-card
// flags. Diplomacy lets the player build one free road after removing one
// of their own; Medicine reduces the next city upgrade from 2+3 to 1+2.

export function handleBuildRoadCK(
  state: GameState,
  action: BuildRoadAction,
): GameState {
  if (!state.diplomacyFreeRoad) {
    return baseHandleBuildRoad(state, action);
  }
  // Let the base handler validate placement + collect the normal cost, then
  // refund and clear the flag.
  const after = baseHandleBuildRoad(state, action);
  let refunded = updatePlayer(after, action.playerId, (p) => ({
    ...p,
    resources: addResources(p.resources, COSTS.road),
  }));
  refunded = {
    ...refunded,
    bank: {
      wood: refunded.bank.wood - (COSTS.road.wood ?? 0),
      brick: refunded.bank.brick - (COSTS.road.brick ?? 0),
      sheep: refunded.bank.sheep,
      wheat: refunded.bank.wheat,
      ore: refunded.bank.ore,
    },
    diplomacyFreeRoad: false,
  };
  return refunded;
}

export function handleBuildCityCK(
  state: GameState,
  action: BuildCityAction,
): GameState {
  if (!state.medicineActive) {
    return baseHandleBuildCity(state, action);
  }
  // Temporarily lower the city cost. Use a god-mode trick: subtract the
  // delta (1 wheat + 1 ore from the rulebook discount) from the cost by
  // gifting the player those resources, then run the base handler.
  const refundResources = {
    wheat: 1,
    ore: 1,
  } as const;
  let primed = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: addResources(p.resources, refundResources),
  }));
  primed = {
    ...primed,
    // Compensate the bank — the base handler will subtract the full city
    // cost and return it to the bank, so this preserves balance.
    bank: {
      wood: primed.bank.wood,
      brick: primed.bank.brick,
      sheep: primed.bank.sheep,
      wheat: primed.bank.wheat - 1,
      ore: primed.bank.ore - 1,
    },
  };
  const after = baseHandleBuildCity(primed, action);
  return { ...after, medicineActive: false };
}

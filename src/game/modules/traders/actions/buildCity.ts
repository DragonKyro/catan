import type { GameState, BuildCityAction } from '../../../types';
import { handleBuildCity as baseHandleBuildCity } from '../../../actions/build';
import { recalcStrongestPorts } from '../scoring/strongestPorts';

// T&B wrapper around the base buildCity. Cities don't earn river gold (only
// roads and settlements do per the rulebook) but upgrading to a city changes
// a player's port-VP weight, so refresh Strongest Ports here too.
export function handleBuildCityWithStrongestPortsRefresh(
  state: GameState,
  action: BuildCityAction,
): GameState {
  let next = baseHandleBuildCity(state, action);
  if (next.strongestPorts) {
    next = { ...next, strongestPorts: recalcStrongestPorts(next) };
  }
  // Merchant Trains: city builds count toward the end-of-turn voting round.
  if (next.wateringHoleHexId) next = { ...next, builtThisTurn: true };
  return next;
}

import type { GameState, BuildSettlementAction } from '../../../types';
import { handleBuildSettlement as baseHandleBuildSettlement } from '../../../actions/build';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { vertexIsOnRiverTile } from './helpers';
import { recalcStrongestPorts } from '../scoring/strongestPorts';
import { addGold } from '../coins/gold';

// T&B wrapper around the base buildSettlement. On success: Rivers of Catan
// grants 1 gold for a settlement on any corner of a river tile; the
// Strongest Ports holder is refreshed regardless (cheap, idempotent).
export function handleBuildSettlementWithRiverGold(
  state: GameState,
  action: BuildSettlementAction,
): GameState {
  let next = baseHandleBuildSettlement(state, action);
  if (vertexIsOnRiverTile(next, action.vertex)) {
    next = addGold(next, action.playerId, RIVER_BUILD_GOLD_REWARD);
  }
  if (next.strongestPorts) {
    next = { ...next, strongestPorts: recalcStrongestPorts(next) };
  }
  // Merchant Trains: building a settlement or city collects the turn's
  // wagon (roads and bridges don't).
  if (next.wateringHoleHexId) next = { ...next, builtThisTurn: true };
  return next;
}

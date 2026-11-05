import type { GameState, BuildRoadAction } from '../../../types';
import { handleBuildRoad as baseHandleBuildRoad } from '../../../actions/build';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { edgeIsOnRiverTile } from './helpers';
import { addGold } from '../coins/gold';

// T&B wrapper around the base buildRoad. Delegates all validation to the
// base handler (which already rejects bridge sites via the placement
// check). Rivers of Catan: a road on any edge of a river tile earns 1 gold
// (and refreshes the wealth tiles).
export function handleBuildRoadWithRiverGold(
  state: GameState,
  action: BuildRoadAction,
): GameState {
  let next = baseHandleBuildRoad(state, action);
  if (edgeIsOnRiverTile(next, action.edge)) {
    next = addGold(next, action.playerId, RIVER_BUILD_GOLD_REWARD);
  }
  return next;
}

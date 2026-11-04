import type { GameState, PlaceInitialRoadAction } from '../../../types';
import { handlePlaceInitialRoad as baseHandlePlaceInitialRoad } from '../../../actions/setup';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { edgeIsOnRiverTile } from './helpers';
import { addGold } from '../coins/gold';

// T&B wrapper around the base placeInitialRoad. Rivers of Catan: a starting
// road on an edge of a river tile earns 1 gold (bridge sites themselves are
// rejected by canPlaceInitialRoad).
export function handlePlaceInitialRoadWithRiverGold(
  state: GameState,
  action: PlaceInitialRoadAction,
): GameState {
  let next = baseHandlePlaceInitialRoad(state, action);
  if (edgeIsOnRiverTile(next, action.edge)) {
    next = addGold(next, action.playerId, RIVER_BUILD_GOLD_REWARD);
  }
  return next;
}

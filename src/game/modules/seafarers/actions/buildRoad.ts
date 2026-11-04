import type {
  GameState,
  BuildRoadAction,
  PlaceInitialRoadAction,
} from '../../../types';
import { handleBuildRoad as baseBuildRoad } from '../../../actions/build';
import { handlePlaceInitialRoad as basePlaceInitialRoad } from '../../../actions/setup';
import { afterRoadPlaced } from '../hooks';

// Seafarers wrappers for the base road handlers: same rules, plus the
// scenario hooks (fog discovery, Cloth trade routes).
export function handleBuildRoadSeafarers(state: GameState, action: BuildRoadAction): GameState {
  const next = baseBuildRoad(state, action);
  return afterRoadPlaced(next, action.playerId, action.edge);
}

export function handlePlaceInitialRoadSeafarers(
  state: GameState,
  action: PlaceInitialRoadAction,
): GameState {
  const next = basePlaceInitialRoad(state, action);
  return afterRoadPlaced(next, action.playerId, action.edge);
}

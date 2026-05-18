import type { GameState, PlaceInitialRoadAction } from '../../../types';
import { handlePlaceInitialRoad as baseHandlePlaceInitialRoad } from '../../../actions/setup';
import { updatePlayer } from '../../../helpers';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { edgeIsOnRiverTile } from './helpers';
import { recalcWealthTiles } from '../scoring/wealthTiles';

// T&B wrapper around the base placeInitialRoad. Roads built on a river-tile
// edge during setup earn 1 gold (river edges themselves are bridge-only and
// already rejected by canPlaceInitialRoad — but rim roads touching swamps
// still qualify).
export function handlePlaceInitialRoadWithRiverGold(
  state: GameState,
  action: PlaceInitialRoadAction,
): GameState {
  // Capture the edge id (the base handler clears setupState.lastPlacedSettlement
  // when it advances the turn, but the edge id is the action payload — safe).
  let next = baseHandlePlaceInitialRoad(state, action);
  if (edgeIsOnRiverTile(next, action.edge)) {
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      gold: (p.gold ?? 0) + RIVER_BUILD_GOLD_REWARD,
    }));
    next = { ...next, wealthTiles: recalcWealthTiles(next) };
  }
  return next;
}

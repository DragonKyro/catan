import type { GameState, BuildRoadAction } from '../../../types';
import { handleBuildRoad as baseHandleBuildRoad } from '../../../actions/build';
import { updatePlayer } from '../../../helpers';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { edgeIsOnRiverTile } from './helpers';
import { recalcWealthTiles } from '../scoring/wealthTiles';

// T&B wrapper around the base buildRoad. Delegates all validation to the
// base handler (which already rejects river edges via the placement check
// we added). On success, if the placed road borders a swamp hex it grants
// +1 gold and refreshes the wealth tiles.
export function handleBuildRoadWithRiverGold(
  state: GameState,
  action: BuildRoadAction,
): GameState {
  let next = baseHandleBuildRoad(state, action);
  if (edgeIsOnRiverTile(next, action.edge)) {
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      gold: (p.gold ?? 0) + RIVER_BUILD_GOLD_REWARD,
    }));
    next = { ...next, wealthTiles: recalcWealthTiles(next) };
  }
  // Merchant Trains: road builds count toward the end-of-turn voting round.
  if (next.wateringHoleHexId) next = { ...next, builtThisTurn: true };
  return next;
}

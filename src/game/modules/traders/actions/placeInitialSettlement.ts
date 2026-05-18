import type { GameState, PlaceInitialSettlementAction } from '../../../types';
import { handlePlaceInitialSettlement as baseHandlePlaceInitialSettlement } from '../../../actions/setup';
import { updatePlayer } from '../../../helpers';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { vertexIsOnRiverTile } from './helpers';
import { recalcWealthTiles } from '../scoring/wealthTiles';

// T&B wrapper. Setup-round settlements that land on a river-tile vertex
// also earn 1 gold (rulebook explicitly lists setup placements in the
// gold-earning rules).
export function handlePlaceInitialSettlementWithRiverGold(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  let next = baseHandlePlaceInitialSettlement(state, action);
  if (vertexIsOnRiverTile(next, action.vertex)) {
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      gold: (p.gold ?? 0) + RIVER_BUILD_GOLD_REWARD,
    }));
    next = { ...next, wealthTiles: recalcWealthTiles(next) };
  }
  return next;
}

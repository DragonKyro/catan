import type { GameState, PlaceInitialSettlementAction } from '../../../types';
import { handlePlaceInitialSettlement as baseHandlePlaceInitialSettlement } from '../../../actions/setup';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { vertexIsOnRiverTile, vertexIsOnFishingWater } from './helpers';
import { grantFish } from '../fishing/production';
import { addGold } from '../coins/gold';

// T&B wrapper for the initial-settlement action. Layers per-scenario setup
// bonuses on top of the base handler:
//   - Rivers of Catan: +1 gold for a settlement on a corner of a river tile.
//   - Fishing on Catan: a second settlement next to the lake or a fishing
//     ground draws 1 random fish token.
export function handlePlaceInitialSettlementWithRiverGold(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  const wasRound2 = state.phase === 'setupRound2';
  let next = baseHandlePlaceInitialSettlement(state, action);
  if (vertexIsOnRiverTile(next, action.vertex)) {
    next = addGold(next, action.playerId, RIVER_BUILD_GOLD_REWARD);
  }
  // Fishing on Catan: round-2 only (rulebook). Round-1 settlements don't
  // earn the starting fish — same shape as the round-2 resource grant.
  if (wasRound2 && vertexIsOnFishingWater(next, action.vertex)) {
    next = grantFish(next, action.playerId, 1).state;
  }
  return next;
}

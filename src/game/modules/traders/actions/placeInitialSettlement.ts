import type { GameState, PlaceInitialSettlementAction } from '../../../types';
import { handlePlaceInitialSettlement as baseHandlePlaceInitialSettlement } from '../../../actions/setup';
import { updatePlayer } from '../../../helpers';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { vertexIsOnRiverTile, vertexIsOnFishingWater } from './helpers';
import { recalcWealthTiles } from '../scoring/wealthTiles';
import { grantFish } from '../fishing/production';

// T&B wrapper for the initial-settlement action. Layers per-scenario setup
// bonuses on top of the base handler:
//   - Rivers of Catan: +1 gold for settlements touching a swamp.
//   - Fishing on Catan: round-2 settlements adjacent to the lake or a
//     fishing ground draw 1 random fish token.
export function handlePlaceInitialSettlementWithRiverGold(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  const wasRound2 = state.phase === 'setupRound2';
  let next = baseHandlePlaceInitialSettlement(state, action);
  if (vertexIsOnRiverTile(next, action.vertex)) {
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      gold: (p.gold ?? 0) + RIVER_BUILD_GOLD_REWARD,
    }));
    next = { ...next, wealthTiles: recalcWealthTiles(next) };
  }
  // Fishing on Catan: round-2 only (rulebook). Round-1 settlements don't
  // earn the starting fish — same shape as the round-2 resource grant.
  if (wasRound2 && vertexIsOnFishingWater(next, action.vertex)) {
    next = grantFish(next, action.playerId, 1);
  }
  return next;
}

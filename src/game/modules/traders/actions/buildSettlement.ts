import type { GameState, BuildSettlementAction } from '../../../types';
import { handleBuildSettlement as baseHandleBuildSettlement } from '../../../actions/build';
import { updatePlayer } from '../../../helpers';
import { RIVER_BUILD_GOLD_REWARD } from '../constants';
import { vertexIsOnRiverTile } from './helpers';
import { recalcWealthTiles } from '../scoring/wealthTiles';
import { recalcStrongestPorts } from '../scoring/strongestPorts';

// T&B wrapper around the base buildSettlement. On success: grant +1 gold
// when the vertex touches a swamp hex (river tile), and refresh the
// Strongest Ports holder regardless (cheap, idempotent).
export function handleBuildSettlementWithRiverGold(
  state: GameState,
  action: BuildSettlementAction,
): GameState {
  let next = baseHandleBuildSettlement(state, action);
  if (vertexIsOnRiverTile(next, action.vertex)) {
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      gold: (p.gold ?? 0) + RIVER_BUILD_GOLD_REWARD,
    }));
    next = { ...next, wealthTiles: recalcWealthTiles(next) };
  }
  if (next.strongestPorts) {
    next = { ...next, strongestPorts: recalcStrongestPorts(next) };
  }
  return next;
}

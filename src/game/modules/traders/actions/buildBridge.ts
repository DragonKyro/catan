import type {
  GameState,
  BuildBridgeAction,
} from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import { canAfford, subtractResources, addResources } from '../../../resources';
import { canPlaceBridge } from '../../../placement';
import { BRIDGE_GOLD_REWARD, MAX_BRIDGES } from '../constants';
import { addGold } from '../coins/gold';

// Rivers of Catan bridge (rulebook p. 12): on an empty bridge site, joined
// to one of your roads, bridges or buildings and not past an opponent's
// building (canPlaceBridge); 2 brick + 1 lumber; 3 per player; +3 gold.
// Road Building can't place one (playRoadBuilding only takes roads, and
// canConnectRoad rejects bridge sites).
export function handleBuildBridge(
  state: GameState,
  action: BuildBridgeAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot build bridge in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.riverEdges?.includes(action.edge)) {
    throw new Error('Bridges may only be built on bridge sites');
  }
  const player = getPlayer(state, action.playerId);
  if ((player.bridges?.length ?? 0) >= MAX_BRIDGES) {
    throw new Error('No bridges left');
  }
  if (!canPlaceBridge(state, action.playerId, action.edge)) {
    throw new Error('Invalid bridge placement');
  }
  if (!canAfford(player.resources, COSTS.bridge)) {
    throw new Error('Cannot afford bridge');
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    bridges: [...(p.bridges ?? []), action.edge],
    resources: subtractResources(p.resources, COSTS.bridge),
  }));
  next = { ...next, bank: addResources(next.bank, COSTS.bridge) };
  next = addGold(next, action.playerId, BRIDGE_GOLD_REWARD);
  return next;
}

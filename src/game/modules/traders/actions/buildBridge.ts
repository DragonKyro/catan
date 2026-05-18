import type {
  GameState,
  BuildBridgeAction,
} from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import { canAfford, subtractResources, addResources } from '../../../resources';
import { canPlaceBridge } from '../../../placement';
import { BRIDGE_GOLD_REWARD } from '../constants';
import { recalcWealthTiles } from '../scoring/wealthTiles';

const MAX_BRIDGES = 3;

export function handleBuildBridge(
  state: GameState,
  action: BuildBridgeAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot build bridge in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.riverEdges?.includes(action.edge)) {
    throw new Error('Bridges may only be built on river edges');
  }
  const player = getPlayer(state, action.playerId);
  if ((player.bridges?.length ?? 0) >= MAX_BRIDGES) {
    throw new Error('No bridge tokens left');
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
    gold: (p.gold ?? 0) + BRIDGE_GOLD_REWARD,
    resources: subtractResources(p.resources, COSTS.bridge),
  }));
  next = { ...next, bank: addResources(next.bank, COSTS.bridge) };
  next = { ...next, wealthTiles: recalcWealthTiles(next) };
  return next;
}

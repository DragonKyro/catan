import type { GameState, BuildShipAction } from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import { canAfford, subtractResources, addResources } from '../../../resources';
import { SHIP_COST, MAX_SHIPS } from '../constants';
import { canBuildShip } from '../validation/shipPlacement';

export function handleBuildShip(state: GameState, action: BuildShipAction): GameState {
  if (state.phase !== 'main' && state.phase !== 'specialBuildPhase') {
    throw new Error(`Cannot build ship in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.ships.length >= MAX_SHIPS) throw new Error('No ship tokens left');
  if (!canBuildShip(state, action.playerId, action.edge)) {
    throw new Error('Invalid ship placement');
  }
  if (!canAfford(player.resources, SHIP_COST)) throw new Error('Cannot afford ship');

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    ships: [...p.ships, action.edge],
    resources: subtractResources(p.resources, SHIP_COST),
  }));
  next = { ...next, bank: addResources(next.bank, SHIP_COST) };
  return next;
}

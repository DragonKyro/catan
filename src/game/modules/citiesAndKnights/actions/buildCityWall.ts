import type { GameState, BuildCityWallAction } from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { MAX_CITY_WALLS } from '../constants';

// Cities & Knights — build a city wall on one of your cities. Costs 2 brick;
// raises this player's 7-roll discard threshold by 2 (max 3 walls → +6).
// The wall is destroyed if the city is pillaged by a barbarian attack.
export function handleBuildCityWall(
  state: GameState,
  action: BuildCityWallAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot build city wall in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');

  const player = getPlayer(state, action.playerId);
  if ((player.cityWalls ?? 0) >= MAX_CITY_WALLS) {
    throw new Error('Already at max city walls (3)');
  }
  if (!player.cities.includes(action.vertex)) {
    throw new Error('City wall must be built on one of your own cities');
  }
  if (state.cityWalls?.[action.vertex]) {
    throw new Error('That city already has a wall');
  }
  // Engineering progress card flag: this wall is free.
  const free = !!state.engineeringActive;
  if (!free && !canAfford(player.resources, COSTS.cityWall)) {
    throw new Error('Cannot afford city wall');
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    cityWalls: (p.cityWalls ?? 0) + 1,
    resources: free
      ? p.resources
      : subtractResources(p.resources, COSTS.cityWall),
  }));
  next = {
    ...next,
    bank: free ? next.bank : addResources(next.bank, COSTS.cityWall),
    cityWalls: { ...(next.cityWalls ?? {}), [action.vertex]: action.playerId },
    engineeringActive: false,
  };
  return next;
}

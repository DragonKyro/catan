import type { GameState, BuildCityWallAction, PlayerId, VertexId } from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { MAX_CITY_WALLS } from '../constants';

// Can `playerId` put a city wall under the city on `vertex` (cost aside)?
// One wall per city, at most 3 walls at a time (p.8).
export function canBuildCityWallAt(state: GameState, playerId: PlayerId, vertex: VertexId): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  if ((player.cityWalls ?? 0) >= MAX_CITY_WALLS) return false;
  if (!player.cities.includes(vertex)) return false;
  return !state.cityWalls?.[vertex];
}

export function cityWallSites(state: GameState, playerId: PlayerId): VertexId[] {
  const player = state.players.find((p) => p.id === playerId);
  return (player?.cities ?? []).filter((v) => canBuildCityWallAt(state, playerId, v));
}

// Build a city wall (p.8). Costs 2 brick (Engineering: free); each wall
// lets its owner hold 2 more cards on a 7. A pillaged city loses its wall,
// which goes back to the owner's supply.
export function handleBuildCityWall(state: GameState, action: BuildCityWallAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot build city wall in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const free = !!state.engineeringActive;
  if (!free && !canAfford(getPlayer(state, action.playerId).resources, COSTS.cityWall)) {
    throw new Error('Cannot afford city wall (2 brick)');
  }
  const next = placeCityWall(state, action.playerId, action.vertex, !free);
  return { ...next, engineeringActive: false };
}

// Put the wall on the board, paying 2 brick when `pay` is set.
export function placeCityWall(
  state: GameState,
  playerId: PlayerId,
  vertex: VertexId,
  pay: boolean,
): GameState {
  const player = getPlayer(state, playerId);
  if ((player.cityWalls ?? 0) >= MAX_CITY_WALLS) {
    throw new Error(`Already at max city walls (${MAX_CITY_WALLS})`);
  }
  if (!player.cities.includes(vertex)) {
    throw new Error('City wall must be built on one of your own cities');
  }
  if (state.cityWalls?.[vertex]) throw new Error('That city already has a wall');
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    cityWalls: (p.cityWalls ?? 0) + 1,
    resources: pay ? subtractResources(p.resources, COSTS.cityWall) : p.resources,
  }));
  next = {
    ...next,
    bank: pay ? addResources(next.bank, COSTS.cityWall) : next.bank,
    cityWalls: { ...(next.cityWalls ?? {}), [vertex]: playerId },
  };
  return next;
}

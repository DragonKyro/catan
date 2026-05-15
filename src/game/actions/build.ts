import type {
  GameState,
  BuildSettlementAction,
  BuildCityAction,
  BuildRoadAction,
} from '../types';
import { COSTS } from '../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../helpers';
import { canAfford, subtractResources, addResources } from '../resources';
import { getPortAtVertex } from '../board/adjacency';
import { canConnectRoad, canPlaceSettlement } from '../placement';

const MAX_SETTLEMENTS = 5;
const MAX_CITIES = 4;
const MAX_ROADS = 15;

export function handleBuildRoad(state: GameState, action: BuildRoadAction): GameState {
  if (state.phase !== 'main' && state.phase !== 'specialBuildPhase') {
    throw new Error(`Cannot build road in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.roads.length >= MAX_ROADS) throw new Error('No road tokens left');
  const edgeDef = state.board.edges[action.edge];
  if (edgeDef) {
    const allSea = edgeDef.hexes.every((h) => state.board.hexes[h]!.terrain === 'sea');
    if (allSea) throw new Error('Cannot place a road on a sea edge');
  }
  if (!canConnectRoad(state, action.playerId, action.edge)) {
    throw new Error('Invalid road placement');
  }
  if (!canAfford(player.resources, COSTS.road)) throw new Error('Cannot afford road');

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    roads: [...p.roads, action.edge],
    resources: subtractResources(p.resources, COSTS.road),
  }));
  next = { ...next, bank: addResources(next.bank, COSTS.road) };
  return next;
}

export function handleBuildSettlement(
  state: GameState,
  action: BuildSettlementAction,
): GameState {
  if (state.phase !== 'main' && state.phase !== 'specialBuildPhase') {
    throw new Error(`Cannot build settlement in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.settlements.length >= MAX_SETTLEMENTS) {
    throw new Error('No settlement tokens left');
  }
  if (!canPlaceSettlement(state, action.playerId, action.vertex)) {
    throw new Error('Invalid settlement placement');
  }
  if (!canAfford(player.resources, COSTS.settlement)) {
    throw new Error('Cannot afford settlement');
  }

  const port = getPortAtVertex(state.board, action.vertex);

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    settlements: [...p.settlements, action.vertex],
    resources: subtractResources(p.resources, COSTS.settlement),
    ports: port && !p.ports.includes(port) ? [...p.ports, port] : p.ports,
  }));
  next = { ...next, bank: addResources(next.bank, COSTS.settlement) };
  return next;
}

export function handleBuildCity(state: GameState, action: BuildCityAction): GameState {
  if (state.phase !== 'main' && state.phase !== 'specialBuildPhase') {
    throw new Error(`Cannot build city in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.cities.length >= MAX_CITIES) throw new Error('No city tokens left');
  if (!player.settlements.includes(action.vertex)) {
    throw new Error('Must upgrade your own settlement');
  }
  if (!canAfford(player.resources, COSTS.city)) throw new Error('Cannot afford city');

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    settlements: p.settlements.filter((v) => v !== action.vertex),
    cities: [...p.cities, action.vertex],
    resources: subtractResources(p.resources, COSTS.city),
  }));
  next = { ...next, bank: addResources(next.bank, COSTS.city) };
  return next;
}

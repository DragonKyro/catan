import type {
  BuildCityAction,
  BuildRoadAction,
  EdgeId,
  GameState,
  PlaceInitialSettlementAction,
  PlayerId,
  ResourceBank,
  VertexId,
} from '../../../types';
import { COSTS } from '../../../types';
import {
  handleBuildRoad as baseHandleBuildRoad,
  handleBuildCity as baseHandleBuildCity,
  MAX_CITIES,
  MAX_ROADS,
} from '../../../actions/build';
import { handlePlaceInitialSettlement as baseHandlePlaceInitialSettlement } from '../../../actions/setup';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { canConnectRoad } from '../../../placement';

// Cities & Knights wrappers around the base build handlers.

// Setup (p.5): round 1 places a settlement, round 2 places a CITY, which
// collects 1 resource per adjacent hex (the base handler already pays the
// round-2 piece that way; we just turn the piece into a city).
export function handlePlaceInitialSettlementCK(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  const next = baseHandlePlaceInitialSettlement(state, action);
  if (state.phase !== 'setupRound2') return next;
  return updatePlayer(next, action.playerId, (p) => ({
    ...p,
    settlements: p.settlements.filter((v) => v !== action.vertex),
    cities: [...p.cities, action.vertex],
  }));
}

// Can `playerId` lay a free road on `edge` (Road Building, Diplomacy)? Same
// placement as a bought road: connected, not past opponents' buildings or
// knights, a road left in the supply.
export function canPlaceFreeRoad(state: GameState, playerId: PlayerId, edge: EdgeId): boolean {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p || p.roads.length >= MAX_ROADS) return false;
  return canConnectRoad(state, playerId, edge);
}

export function placeFreeRoad(state: GameState, playerId: PlayerId, edge: EdgeId): GameState {
  if (!canPlaceFreeRoad(state, playerId, edge)) throw new Error('Invalid road placement');
  return updatePlayer(state, playerId, (p) => ({ ...p, roads: [...p.roads, edge] }));
}

// Diplomacy (p.15): after removing one of your own roads you may build 1
// road at no cost — the next buildRoad is free.
export function handleBuildRoadCK(state: GameState, action: BuildRoadAction): GameState {
  if (!state.diplomacyFreeRoad) return baseHandleBuildRoad(state, action);
  if (state.phase !== 'main') throw new Error(`Cannot build road in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  return { ...placeFreeRoad(state, action.playerId, action.edge), diplomacyFreeRoad: false };
}

// Upgrade a settlement to a city for `cost` (Medicine: 1 wheat + 2 ore).
export function upgradeToCity(
  state: GameState,
  playerId: PlayerId,
  vertex: VertexId,
  cost: Partial<ResourceBank>,
): GameState {
  const player = getPlayer(state, playerId);
  if (player.cities.length >= MAX_CITIES) throw new Error('No city tokens left');
  if (!player.settlements.includes(vertex)) throw new Error('Must upgrade your own settlement');
  if (!canAfford(player.resources, cost)) throw new Error('Cannot afford the city');
  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    settlements: p.settlements.filter((v) => v !== vertex),
    cities: [...p.cities, vertex],
    resources: subtractResources(p.resources, cost),
  }));
  return { ...next, bank: addResources(next.bank, cost) };
}

// Medicine (p.13) played without a target: the next city upgrade this turn
// costs 1 wheat + 2 ore.
export function handleBuildCityCK(state: GameState, action: BuildCityAction): GameState {
  if (!state.medicineActive) return baseHandleBuildCity(state, action);
  if (state.phase !== 'main') throw new Error(`Cannot build city in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const next = upgradeToCity(state, action.playerId, action.vertex, COSTS.cityMedicine);
  return { ...next, medicineActive: false };
}

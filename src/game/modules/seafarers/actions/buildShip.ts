import type {
  GameState,
  BuildShipAction,
  PlaceInitialShipAction,
  PlayRoadBuildingAction,
  EdgeId,
  DevCardType,
} from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import { canAfford, subtractResources, addResources } from '../../../resources';
import { advanceSetupTurn, isSetupPhase } from '../../../actions/setup';
import { canConnectRoad } from '../../../placement';
import { SHIP_COST, MAX_SHIPS } from '../constants';
import { canBuildShip, canPlaceInitialShip } from '../validation/shipPlacement';
import { afterRoadPlaced, afterShipPlaced } from '../hooks';
import { pirateIslandsShipViolation } from '../pirateIslands';

const MAX_ROADS = 15;

export function handleBuildShip(state: GameState, action: BuildShipAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot build ship in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.ships.length >= MAX_SHIPS) throw new Error('No ship tokens left');
  if (!canBuildShip(state, action.playerId, action.edge)) {
    throw new Error('Invalid ship placement');
  }
  const violation = pirateIslandsShipViolation(state, action.playerId, action.edge);
  if (violation) throw new Error(violation);
  if (!canAfford(player.resources, SHIP_COST)) throw new Error('Cannot afford ship');

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    ships: [...p.ships, action.edge],
    resources: subtractResources(p.resources, SHIP_COST),
  }));
  next = { ...next, bank: addResources(next.bank, SHIP_COST) };
  return afterShipPlaced(next, action.playerId, action.edge, { built: true });
}

// Setup: "If you place a starting settlement on the coast, you may place a
// ship on an adjacent empty sea edge instead of a road."
export function handlePlaceInitialShip(
  state: GameState,
  action: PlaceInitialShipAction,
): GameState {
  if (!isSetupPhase(state.phase)) {
    throw new Error(`Cannot place a starting ship in phase ${state.phase}`);
  }
  if (state.setupState?.step !== 'road') {
    throw new Error('Place your settlement first');
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const placed = state.setupState.lastPlacedSettlement;
  if (!placed || !canPlaceInitialShip(state, placed, action.edge)) {
    throw new Error('The ship must go on an empty sea edge next to your new settlement');
  }
  const violation = pirateIslandsShipViolation(state, action.playerId, action.edge);
  if (violation) throw new Error(violation);
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    ships: [...p.ships, action.edge],
  }));
  next = advanceSetupTurn(next);
  return afterShipPlaced(next, action.playerId, action.edge, { built: false });
}

// Seafarers Road Building: "Build 2 roads, 2 ships, or 1 road and 1 ship at
// no cost." Roads are placed first, then ships; each must be legal at the
// moment it's placed.
export function handlePlayRoadBuildingSeafarers(
  state: GameState,
  action: PlayRoadBuildingAction,
): GameState {
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (state.hasPlayedDevCardThisTurn) {
    throw new Error('Already played a development card this turn');
  }
  if (state.phase !== 'main') throw new Error(`Cannot play dev card in phase ${state.phase}`);
  const roads = action.edges ?? [];
  const ships = action.ships ?? [];
  if (roads.length + ships.length === 0) throw new Error('Place at least one road or ship');
  if (roads.length + ships.length > 2) throw new Error('Road Building places at most 2 pieces');

  const player = getPlayer(state, action.playerId);
  const idx = player.devCards.unplayed.indexOf('roadBuilding' as DevCardType);
  if (idx < 0) throw new Error('You have no roadBuilding card to play');
  const unplayed = player.devCards.unplayed.slice();
  unplayed.splice(idx, 1);

  let next: GameState = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    devCards: { ...p.devCards, unplayed },
  }));
  next = { ...next, hasPlayedDevCardThisTurn: true };

  for (const edge of roads) {
    if (getPlayer(next, action.playerId).roads.length >= MAX_ROADS) break;
    if (!canConnectRoad(next, action.playerId, edge)) {
      throw new Error('Invalid free road placement');
    }
    next = updatePlayer(next, action.playerId, (p) => ({ ...p, roads: [...p.roads, edge] }));
    next = afterRoadPlaced(next, action.playerId, edge);
  }
  for (const edge of ships as EdgeId[]) {
    if (getPlayer(next, action.playerId).ships.length >= MAX_SHIPS) break;
    if (next.phase !== 'main') {
      // A previous piece opened a sub-step (fog gold pick, tribe port).
      throw new Error('Place the second piece before resolving the first');
    }
    if (!canBuildShip(next, action.playerId, edge)) {
      throw new Error('Invalid free ship placement');
    }
    const violation = pirateIslandsShipViolation(next, action.playerId, edge);
    if (violation) throw new Error(violation);
    next = updatePlayer(next, action.playerId, (p) => ({ ...p, ships: [...p.ships, edge] }));
    next = afterShipPlaced(next, action.playerId, edge, { built: true });
  }
  return next;
}

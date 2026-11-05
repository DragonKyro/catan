import type {
  BuildSettlementAction,
  EpBuildCrewAction,
  EpBuildHarborAction,
  EpBuildSettlerAction,
  EpBuildShipAction,
  EpCargo,
  EpFastGoldAction,
  EpLocation,
  GameState,
  PlayerId,
  ResourceBank,
} from '../../types';
import { COSTS } from '../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../helpers';
import { addResources, canAfford, subtractResources } from '../../resources';
import { canPlaceSettlement } from '../../placement';
import { addGold } from '../traders/coins/gold';
import { EP_COSTS } from './constants';
import { exploreAroundEdge } from './explore';
import {
  buildableShipEdges,
  cargoAt,
  epSupply,
  farmCount,
  harborUpgradeSpots,
  harborsAtShip,
  hasRoomFor,
  isExplorersPirates,
  isHarbor,
  buildingOwner,
  patchEp,
  pushEpEvents,
  removeCargo,
  shipById,
  shipsOf,
  type EpGame,
} from './state';

// Action phase builds (Rulebook pp. 9-10).

function assertAction(state: GameState, playerId: PlayerId): asserts state is EpGame {
  if (!isExplorersPirates(state)) throw new Error('Not an Explorers & Pirates game');
  if (state.phase !== 'main') throw new Error(`You build in the Action phase, not ${state.phase}`);
  if (playerId !== currentPlayerId(state)) throw new Error('Not your turn');
}

function pay(state: EpGame, playerId: PlayerId, cost: Partial<ResourceBank>, what: string): EpGame {
  if (!canAfford(getPlayer(state, playerId).resources, cost)) throw new Error(`Cannot afford ${what}`);
  const next = updatePlayer(state, playerId, (p) => ({ ...p, resources: subtractResources(p.resources, cost) }));
  return { ...(next as EpGame), bank: addResources(next.bank, cost) };
}

// Settlement via your roads (5 settlement pieces; harbor settlements are
// separate pieces). The land rules live in placement.ts → epVertexBuildable.
export function handleEpBuildSettlement(state: GameState, action: BuildSettlementAction): GameState {
  assertAction(state, action.playerId);
  if (epSupply(state, action.playerId).settlements <= 0) throw new Error('No settlement pieces left');
  if (!canPlaceSettlement(state, action.playerId, action.vertex)) throw new Error('Invalid settlement placement');
  const next = pay(state, action.playerId, COSTS.settlement, 'a settlement');
  return updatePlayer(next, action.playerId, (p) => ({ ...p, settlements: [...p.settlements, action.vertex] }));
}

// "Harbor settlements always replace settlements": one of your coastal
// settlements becomes a harbor settlement (2 VP, up to 4).
export function handleEpBuildHarbor(state: GameState, action: EpBuildHarborAction): GameState {
  assertAction(state, action.playerId);
  if (!harborUpgradeSpots(state, action.playerId).includes(action.vertex)) {
    throw new Error('Pick one of your coastal settlements (you have 4 harbor settlements)');
  }
  const next = pay(state, action.playerId, EP_COSTS.harbor, 'a harbor settlement');
  return patchEp(next, (ep) => ({ ...ep, harbors: { ...ep.harbors, [action.vertex]: [] } }));
}

// A ship on an empty sea edge next to one of your harbor settlements. With
// no ship left in your supply, return one from the board (with its cargo).
export function handleEpBuildShip(state: GameState, action: EpBuildShipAction): GameState {
  assertAction(state, action.playerId);
  let next: EpGame = state;
  if (action.recycle) {
    const old = shipById(state, action.recycle);
    if (!old || old.owner !== action.playerId) throw new Error('Not your ship');
    if (epSupply(state, action.playerId).ships > 0) throw new Error('You still have a ship in your supply');
    // The ship and its cargo go back to the supply (a fish haul to the
    // fish supply).
    next = patchEp(next, (ep) => ({
      ...ep,
      ships: ep.ships.filter((s) => s.id !== old.id),
      fishSupply: ep.fishSupply + fishIn(old.cargo),
    }));
  } else if (epSupply(state, action.playerId).ships <= 0) {
    throw new Error('All your ships are on the board: return one to build another');
  }
  if (!buildableShipEdges(next, action.playerId).includes(action.edge)) {
    throw new Error('Ships go on an empty sea edge next to your harbor settlement');
  }
  next = pay(next, action.playerId, EP_COSTS.ship, 'a ship');
  const id = `s${next.explorersPirates.nextShipId}`;
  next = patchEp(next, (ep) => ({
    ...ep,
    nextShipId: ep.nextShipId + 1,
    ships: [...ep.ships, { id, owner: action.playerId, edge: action.edge, cargo: [] }],
  }));
  const [explored, events] = exploreAroundEdge(next, action.playerId, action.edge);
  return pushEpEvents(explored, events);
}

export function handleEpBuildSettler(state: GameState, action: EpBuildSettlerAction): GameState {
  assertAction(state, action.playerId);
  if (epSupply(state, action.playerId).settlers <= 0) throw new Error('Both your settlers are on the board');
  const next = pay(state, action.playerId, EP_COSTS.settler, 'a settler');
  return placePiece(next, action.playerId, action.at, 'settler', action.evict ?? []);
}

export function handleEpBuildCrew(state: GameState, action: EpBuildCrewAction): GameState {
  assertAction(state, action.playerId);
  if (epSupply(state, action.playerId).crews <= 0) throw new Error('All your crews are on the board');
  const next = pay(state, action.playerId, EP_COSTS.crew, 'a crew');
  return placePiece(next, action.playerId, action.at, 'crew', action.evict ?? []);
}

// Settlers and crews go onto your harbor settlement or a ship of yours next
// to one; `evict` sends pieces from that spot back to the supply for room.
function placePiece(state: EpGame, playerId: PlayerId, at: EpLocation, piece: EpCargo, evict: EpCargo[]): EpGame {
  if ('harbor' in at) {
    if (!isHarbor(state, at.harbor) || buildingOwner(state, at.harbor) !== playerId) {
      throw new Error('Not your harbor settlement');
    }
  } else {
    const ship = shipById(state, at.ship);
    if (!ship || ship.owner !== playerId) throw new Error('Not your ship');
    if (harborsAtShip(state, ship).length === 0) throw new Error('The ship must be next to your harbor settlement');
  }
  const cargo = cargoAt(state, at)!;
  const kept = removeCargo(cargo, evict);
  if (!kept) throw new Error('Those pieces are not there');
  if (!hasRoomFor(kept, [piece])) throw new Error('No room there');
  const updated = [...kept, piece];
  const returned = fishIn(evict);
  return patchEp(state, (ep) =>
    'harbor' in at
      ? { ...ep, fishSupply: ep.fishSupply + returned, harbors: { ...ep.harbors, [at.harbor]: updated } }
      : {
          ...ep,
          fishSupply: ep.fishSupply + returned,
          ships: ep.ships.map((s) => (s.id === at.ship ? { ...s, cargo: updated } : s)),
        },
  );
}

// Fish hauls among pieces returned to the supply (they go back into play).
function fishIn(pieces: readonly EpCargo[]): number {
  return pieces.filter((c) => c === 'fish').length;
}

// Fast Gold spice farm: once in your Action phase (twice with both farms),
// trade 1 resource card for 1 gold.
export function handleEpFastGold(state: GameState, action: EpFastGoldAction): GameState {
  assertAction(state, action.playerId);
  const allowed = farmCount(state, action.playerId, 'fastGold');
  if (allowed === 0) throw new Error('You need a crew on a Fast Gold spice farm');
  if (state.explorersPirates.fastGoldUsed >= allowed) throw new Error('Fast Gold already used this turn');
  if (getPlayer(state, action.playerId).resources[action.give] < 1) throw new Error(`You have no ${action.give}`);
  let next: GameState = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: { ...p.resources, [action.give]: p.resources[action.give] - 1 },
  }));
  next = { ...next, bank: { ...next.bank, [action.give]: next.bank[action.give] + 1 } };
  next = addGold(next, action.playerId, 1);
  const ep = patchEp(next as EpGame, (e) => ({ ...e, fastGoldUsed: e.fastGoldUsed + 1 }));
  return pushEpEvents(ep, [{ kind: 'fastGold', playerId: action.playerId, give: action.give }]);
}

export function epRejectsAction(what: string) {
  return (): GameState => {
    throw new Error(`${what} are not used in Explorers & Pirates`);
  };
}

// Number of ships the player has (for UI / AI convenience).
export function shipCount(state: GameState, playerId: PlayerId): number {
  return shipsOf(state, playerId).length;
}

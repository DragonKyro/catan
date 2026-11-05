import type {
  GameState,
  PlaceInitialRoadAction,
  PlaceInitialSettlementAction,
  PlaceInitialShipAction,
  Resource,
  ResourceBank,
} from '../../types';
import { RESOURCES } from '../../types';
import type { ActionHandler } from '../types';
import { currentPlayerId, updatePlayer } from '../../helpers';
import { addResources, subtractResources } from '../../resources';
import { advanceSetupTurn, isSetupPhase } from '../../actions/setup';
import { canPlaceInitialRoad, canPlaceInitialSettlement } from '../../placement';
import { exploreAroundEdge } from './explore';
import {
  harborsOf,
  isExplorersPirates,
  isShipEdge,
  patchEp,
  plainSettlementsOf,
  pushEpEvents,
  shipsOnEdge,
  type EpGame,
} from './state';

// Explorers & Pirates setup (Rulebook p. 7), "Variable Setup":
//   round 1 (clockwise):        a harbor settlement on a marked intersection;
//   round 2 (counter-clockwise): a settlement on the starting island
//                                (it pays 1 resource per adjacent hex);
//   round 3 (clockwise):        a road next to the settlement, then a ship
//                                with a settler next to the harbor settlement.
// Nothing gets a road in rounds 1 and 2. createGame sets setupRounds = 3.

export function withEpSetupSettlement(
  inner: ActionHandler<PlaceInitialSettlementAction>,
): ActionHandler<PlaceInitialSettlementAction> {
  return (state, action) => {
    if (!isExplorersPirates(state)) return inner(state, action);
    if (state.phase !== 'setupRound1' && state.phase !== 'setupRound2') {
      throw new Error(`Cannot place a starting settlement in phase ${state.phase}`);
    }
    if (state.setupState?.step !== 'settlement') throw new Error('Not placing a settlement now');
    if (action.playerId !== currentPlayerId(state)) throw new Error(`Not ${action.playerId}'s turn`);
    if (!canPlaceInitialSettlement(state, action.vertex)) {
      throw new Error(
        state.phase === 'setupRound1'
          ? 'Your harbor settlement goes on a marked intersection, following the distance rule'
          : 'Your settlement goes on the starting island, following the distance rule',
      );
    }
    const vertex = state.board.vertices[action.vertex]!;
    let next: GameState = updatePlayer(state, action.playerId, (p) => ({
      ...p,
      settlements: [...p.settlements, action.vertex],
    }));
    if (state.phase === 'setupRound1') {
      next = patchEp(next as EpGame, (ep) => ({
        ...ep,
        harbors: { ...ep.harbors, [action.vertex]: [] },
      }));
    } else {
      const grants: Partial<ResourceBank> = {};
      for (const h of vertex.hexes) {
        const t = next.board.hexes[h]!.terrain;
        if ((RESOURCES as readonly string[]).includes(t)) {
          grants[t as Resource] = (grants[t as Resource] ?? 0) + 1;
        }
      }
      next = updatePlayer(next, action.playerId, (p) => ({
        ...p,
        resources: addResources(p.resources, grants),
      }));
      next = { ...next, bank: subtractResources(next.bank, grants) };
    }
    return startRound3Step(advanceSetupTurn(next));
  };
}

export function withEpSetupRoad(inner: ActionHandler<PlaceInitialRoadAction>): ActionHandler<PlaceInitialRoadAction> {
  return (state, action) => {
    if (!isExplorersPirates(state)) return inner(state, action);
    if (state.phase !== 'setupRound3' || state.setupState?.step !== 'road') {
      throw new Error('Not placing a starting road now');
    }
    if (action.playerId !== currentPlayerId(state)) throw new Error(`Not ${action.playerId}'s turn`);
    const settlement = state.setupState.lastPlacedSettlement;
    if (!settlement || !canPlaceInitialRoad(state, settlement, action.edge)) {
      throw new Error('Your road goes next to your starting settlement');
    }
    const next = updatePlayer(state, action.playerId, (p) => ({ ...p, roads: [...p.roads, action.edge] }));
    return { ...next, setupState: { step: 'ship', lastPlacedSettlement: settlement } };
  };
}

// Round 3, second half: a ship carrying a settler next to the harbor
// settlement.
export function handleEpSetupShip(state: GameState, action: PlaceInitialShipAction): GameState {
  if (!isExplorersPirates(state)) throw new Error('Not an Explorers & Pirates game');
  if (state.phase !== 'setupRound3' || state.setupState?.step !== 'ship') {
    throw new Error('Not placing a starting ship now');
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error(`Not ${action.playerId}'s turn`);
  if (!epSetupShipEdges(state, action.playerId).includes(action.edge)) {
    throw new Error('Your ship goes on an empty sea edge next to your harbor settlement');
  }
  const ep = state.explorersPirates;
  let next = patchEp(state, (e) => ({
    ...e,
    nextShipId: e.nextShipId + 1,
    ships: [...e.ships, { id: `s${ep.nextShipId}`, owner: action.playerId, edge: action.edge, cargo: ['settler'] }],
  }));
  const [explored, events] = exploreAroundEdge(next, action.playerId, action.edge);
  next = pushEpEvents(explored, events);
  return startRound3Step(advanceSetupTurn(next));
}

export function epSetupShipEdges(state: GameState, playerId: string): string[] {
  if (!isExplorersPirates(state)) return [];
  const out: string[] = [];
  for (const h of harborsOf(state, playerId)) {
    for (const e of state.board.vertices[h]!.edges) {
      if (!out.includes(e) && isShipEdge(state, e) && shipsOnEdge(state, e).length === 0) out.push(e);
    }
  }
  return out;
}

// Round 3 starts each player at the road step, anchored on the settlement
// from round 2.
function startRound3Step(state: GameState): GameState {
  if (state.phase !== 'setupRound3' || !isSetupPhase(state.phase)) return state;
  const pid = currentPlayerId(state);
  const settlement = plainSettlementsOf(state, pid)[0] ?? null;
  return { ...state, setupState: { step: 'road', lastPlacedSettlement: settlement } };
}

import type {
  GameState,
  PlaceInitialSettlementAction,
  PlaceInitialRoadAction,
  ResourceBank,
} from '../types';
import { updatePlayer, currentPlayerId } from '../helpers';
import { addResources, subtractResources } from '../resources';
import { getPortAtVertex } from '../board/adjacency';

export function handlePlaceInitialSettlement(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  if (state.phase !== 'setupRound1' && state.phase !== 'setupRound2') {
    throw new Error(`Cannot place initial settlement in phase ${state.phase}`);
  }
  if (state.setupState?.step !== 'settlement') {
    throw new Error('Expected road placement, not settlement');
  }
  if (action.playerId !== currentPlayerId(state)) {
    throw new Error(`Not ${action.playerId}'s turn`);
  }

  const vertex = state.board.vertices[action.vertex];
  if (!vertex) throw new Error(`Unknown vertex: ${action.vertex}`);

  // Distance rule and occupancy
  for (const p of state.players) {
    if (p.settlements.includes(action.vertex) || p.cities.includes(action.vertex)) {
      throw new Error('Vertex already occupied');
    }
    for (const n of vertex.neighborVertices) {
      if (p.settlements.includes(n) || p.cities.includes(n)) {
        throw new Error('Distance rule violation: adjacent vertex occupied');
      }
    }
  }

  const port = getPortAtVertex(state.board, action.vertex);

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    settlements: [...p.settlements, action.vertex],
    ports: port && !p.ports.includes(port) ? [...p.ports, port] : p.ports,
  }));

  // Round 2: grant one resource per adjacent non-desert hex
  if (state.phase === 'setupRound2') {
    const grants: Partial<ResourceBank> = {};
    for (const hexId of vertex.hexes) {
      const hex = state.board.hexes[hexId]!;
      if (hex.terrain !== 'desert') {
        grants[hex.terrain] = (grants[hex.terrain] ?? 0) + 1;
      }
    }
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      resources: addResources(p.resources, grants),
    }));
    next = { ...next, bank: subtractResources(next.bank, grants) };
  }

  return {
    ...next,
    setupState: { step: 'road', lastPlacedSettlement: action.vertex },
  };
}

export function handlePlaceInitialRoad(
  state: GameState,
  action: PlaceInitialRoadAction,
): GameState {
  if (state.phase !== 'setupRound1' && state.phase !== 'setupRound2') {
    throw new Error(`Cannot place initial road in phase ${state.phase}`);
  }
  if (state.setupState?.step !== 'road') {
    throw new Error('Expected settlement placement, not road');
  }
  if (action.playerId !== currentPlayerId(state)) {
    throw new Error(`Not ${action.playerId}'s turn`);
  }

  const edge = state.board.edges[action.edge];
  if (!edge) throw new Error(`Unknown edge: ${action.edge}`);

  const placed = state.setupState.lastPlacedSettlement;
  if (!placed) throw new Error('No settlement to anchor the road to');
  if (edge.vertices[0] !== placed && edge.vertices[1] !== placed) {
    throw new Error('Road must touch the just-placed settlement');
  }

  for (const p of state.players) {
    if (p.roads.includes(action.edge)) throw new Error('Edge already has a road');
  }

  const placedRoadState = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    roads: [...p.roads, action.edge],
  }));

  return advanceSetupTurn(placedRoadState);
}

function advanceSetupTurn(state: GameState): GameState {
  if (state.phase === 'setupRound1') {
    if (state.currentPlayerIndex < state.players.length - 1) {
      return {
        ...state,
        currentPlayerIndex: state.currentPlayerIndex + 1,
        setupState: { step: 'settlement', lastPlacedSettlement: null },
      };
    }
    // Last player of round 1 → same player starts round 2 (snake order)
    return {
      ...state,
      phase: 'setupRound2',
      setupState: { step: 'settlement', lastPlacedSettlement: null },
    };
  }
  if (state.phase === 'setupRound2') {
    if (state.currentPlayerIndex > 0) {
      return {
        ...state,
        currentPlayerIndex: state.currentPlayerIndex - 1,
        setupState: { step: 'settlement', lastPlacedSettlement: null },
      };
    }
    // Setup complete; player 0 starts main game.
    return {
      ...state,
      phase: 'rollOrPlayKnight',
      setupState: undefined,
      currentPlayerIndex: 0,
      hasRolledThisTurn: false,
      hasPlayedDevCardThisTurn: false,
    };
  }
  return state;
}

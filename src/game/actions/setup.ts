import type {
  GameState,
  PlaceInitialSettlementAction,
  PlaceInitialRoadAction,
  ResourceBank,
} from '../types';
import { updatePlayer, currentPlayerId } from '../helpers';
import { addResources, subtractResources } from '../resources';
import { getPortAtVertex } from '../board/adjacency';
import { canPlaceInitialRoad, hasSettleableLand } from '../placement';

export function handlePlaceInitialSettlement(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  if (!isSetupPhase(state.phase)) {
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

  // Settlements require at least one adjacent land hex (any non-sea).
  // Trivially true on the base board (no sea hexes exist), but enforced
  // for scenarios that do have water.
  if (!hasSettleableLand(state, action.vertex)) {
    throw new Error('Settlement must touch at least one land hex');
  }
  if (state.setupBlockedVertices?.includes(action.vertex)) {
    throw new Error('Starting settlements may not go on a marked intersection');
  }

  // Volcano scenario: setup placement may not touch the volcano hex (the
  // settlement would just get destroyed on the first eruption, so the rule
  // forbids it outright).
  if (state.board.volcanoHex && vertex.hexes.includes(state.board.volcanoHex)) {
    throw new Error('Setup settlement may not touch the volcano hex');
  }

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

  // The settlement that pays out starting resources (round 2 normally; the
  // third settlement in Cloth for Catan): one resource per adjacent
  // producing hex. Gold hexes are handled by the Seafarers wrapper (a
  // resource of choice); fog that hasn't been explored yet pays nothing.
  if (state.phase === startingResourcePhase(state)) {
    const grants: Partial<ResourceBank> = {};
    for (const hexId of vertex.hexes) {
      const hex = state.board.hexes[hexId]!;
      const t = hex.terrain;
      if (state.unrevealedFogHexes?.includes(hexId)) continue;
      if (
        t === 'desert' ||
        t === 'sea' ||
        t === 'gold' ||
        t === 'swamp' ||
        t === 'lake' ||
        t === 'wateringHole' ||
        t === 'castle'
      )
        continue;
      grants[t] = (grants[t] ?? 0) + 1;
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
  if (!isSetupPhase(state.phase)) {
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

  // Initial roads cannot be placed on pure-sea edges (those are ship-only).
  // Coastal edges are still allowed in setup so the player has a place to
  // anchor their first road on a coastal settlement.
  const allSea = edge.hexes.every((h) => state.board.hexes[h]!.terrain === 'sea');
  if (allSea) throw new Error('Cannot place a road on a sea edge');

  const placed = state.setupState.lastPlacedSettlement;
  if (!placed) throw new Error('No settlement to anchor the road to');
  if (edge.vertices[0] !== placed && edge.vertices[1] !== placed) {
    throw new Error('Road must touch the just-placed settlement');
  }
  if (!canPlaceInitialRoad(state, placed, action.edge)) {
    throw new Error('Edge already taken');
  }

  const placedRoadState = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    roads: [...p.roads, action.edge],
  }));

  return advanceSetupTurn(placedRoadState);
}

// Which setup round's settlement collects starting resources. Normally the
// second; scenarios with a third starting settlement (Cloth for Catan) pay
// out on the third instead.
export function startingResourcePhase(state: GameState): 'setupRound2' | 'setupRound3' {
  return state.settings.setupRounds === 3 ? 'setupRound3' : 'setupRound2';
}

export function isSetupPhase(phase: GameState['phase']): boolean {
  return phase === 'setupRound1' || phase === 'setupRound2' || phase === 'setupRound3';
}

export function advanceSetupTurn(state: GameState): GameState {
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
    // Cloth for Catan: a third settlement, in normal turn order from the
    // first player.
    if (state.settings.setupRounds === 3) {
      return {
        ...state,
        phase: 'setupRound3',
        currentPlayerIndex: 0,
        setupState: { step: 'settlement', lastPlacedSettlement: null },
      };
    }
    return finishSetup(state);
  }
  if (state.phase === 'setupRound3') {
    if (state.currentPlayerIndex < state.players.length - 1) {
      return {
        ...state,
        currentPlayerIndex: state.currentPlayerIndex + 1,
        setupState: { step: 'settlement', lastPlacedSettlement: null },
      };
    }
    return finishSetup(state);
  }
  return state;
}

// Setup complete; player 0 starts the main game.
function finishSetup(state: GameState): GameState {
  return {
    ...state,
    phase: 'rollOrPlayKnight',
    setupState: undefined,
    currentPlayerIndex: 0,
    hasRolledThisTurn: false,
    hasPlayedDevCardThisTurn: false,
  };
}

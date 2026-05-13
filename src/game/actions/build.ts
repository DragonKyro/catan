import type {
  GameState,
  BuildSettlementAction,
  BuildCityAction,
  BuildRoadAction,
  EdgeId,
  VertexId,
  PlayerId,
} from '../types';
import { COSTS } from '../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../helpers';
import { canAfford, subtractResources, addResources } from '../resources';
import { getPortAtVertex } from '../board/adjacency';

const MAX_SETTLEMENTS = 5;
const MAX_CITIES = 4;
const MAX_ROADS = 15;

function canConnectRoad(
  state: GameState,
  playerId: PlayerId,
  edgeId: EdgeId,
): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  for (const p of state.players) {
    if (p.roads.includes(edgeId)) return false;
  }
  const player = getPlayer(state, playerId);
  const [v1, v2] = edge.vertices;
  for (const v of [v1, v2]) {
    // Vertex blocked by opponent settlement/city?
    let blocked = false;
    for (const p of state.players) {
      if (p.id === playerId) continue;
      if (p.settlements.includes(v) || p.cities.includes(v)) {
        blocked = true;
        break;
      }
    }
    // Own settlement/city — always connects
    if (player.settlements.includes(v) || player.cities.includes(v)) return true;
    if (blocked) continue;
    // Another of player's roads meets here
    for (const eid of state.board.vertices[v]!.edges) {
      if (eid !== edgeId && player.roads.includes(eid)) return true;
    }
  }
  return false;
}

function canPlaceSettlement(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
): boolean {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return false;
  // Vertex unoccupied and distance rule
  for (const p of state.players) {
    if (p.settlements.includes(vertexId) || p.cities.includes(vertexId)) return false;
    for (const n of vertex.neighborVertices) {
      if (p.settlements.includes(n) || p.cities.includes(n)) return false;
    }
  }
  // One of player's roads touches this vertex
  const player = getPlayer(state, playerId);
  for (const eid of vertex.edges) {
    if (player.roads.includes(eid)) return true;
  }
  return false;
}

export function handleBuildRoad(state: GameState, action: BuildRoadAction): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot build road in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.roads.length >= MAX_ROADS) throw new Error('No road tokens left');
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
  if (state.phase !== 'main') {
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
  if (state.phase !== 'main') throw new Error(`Cannot build city in phase ${state.phase}`);
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

import type { GameState, RemoveRoadAction } from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';

// Diplomacy: remove an "open" road. Rulebook p.15: a road is "open" if one
// of its end vertices isn't connected to one of that player's roads or
// buildings, AND it isn't part of a continuous chain between two of your
// pieces. If the player removes one of their own roads they may then build
// a new road at no cost — we set `diplomacyFreeRoad: true` and the next
// `buildRoad` handler honours it.
export function handleRemoveRoad(
  state: GameState,
  action: RemoveRoadAction,
): GameState {
  if (state.phase !== 'removeRoad') {
    throw new Error(`Cannot remove road in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const edge = state.board.edges[action.edge];
  if (!edge) throw new Error('Unknown edge');
  // Find the player who owns this road (could be self or another).
  const owner = state.players.find((p) => p.roads.includes(action.edge));
  if (!owner) throw new Error('No road on that edge');

  // Open-road check. A road is "open" iff at least one endpoint has no
  // owner-piece connection AND the road isn't sandwiched between two owner
  // pieces. Practically: enumerate the edge's two endpoints, for each
  // endpoint count owner-connected things (owner roads other than this
  // edge + owner buildings). If ANY endpoint is "naked" (zero connections),
  // the road is open.
  const isOpen = (() => {
    const [v1, v2] = edge.vertices;
    for (const v of [v1, v2]) {
      const vertex = state.board.vertices[v];
      if (!vertex) continue;
      const buildingHere =
        owner.settlements.includes(v) || owner.cities.includes(v);
      let connectedRoads = 0;
      for (const eid of vertex.edges) {
        if (eid === action.edge) continue;
        if (owner.roads.includes(eid)) connectedRoads++;
      }
      if (!buildingHere && connectedRoads === 0) return true;
    }
    return false;
  })();
  if (!isOpen) {
    throw new Error('That road is not open');
  }

  const next = updatePlayer(state, owner.id, (p) => ({
    ...p,
    roads: p.roads.filter((e) => e !== action.edge),
  }));

  return {
    ...next,
    phase: 'main',
    diplomacyFreeRoad: owner.id === action.playerId,
  };
}

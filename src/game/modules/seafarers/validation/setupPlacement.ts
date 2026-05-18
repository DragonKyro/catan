import type { GameState, VertexId } from '../../../types';
import { getScenario } from '../board/scenarios';

// Per Seafarers rules most scenarios require both starting settlements on the
// main island; outer islands are won later by expansion. A few (Four Islands)
// explicitly allow starting anywhere. This predicate is used by the placement
// helpers (so AI/UI don't propose illegal vertices) and by the setup wrapper
// (which throws on a violation). Both call sites stay in sync because they
// share this single source of truth.
export function canStartOnIsland(state: GameState, vertexId: VertexId): boolean {
  const scenarioId = state.settings.scenarioId;
  if (!scenarioId) return true;
  const scenario = getScenario(scenarioId);
  if (scenario.startingPlacementZone === 'anyIsland') return true;
  if (!state.islandChips || !state.board.islandOfHex) return true;

  const vertex = state.board.vertices[vertexId];
  if (!vertex) return false;
  const outerIslandIds = new Set(state.islandChips.map((c) => c.islandId));
  return vertex.hexes.some((hexId) => {
    const islandId = state.board.islandOfHex![hexId];
    if (!islandId) return false; // sea hex
    return !outerIslandIds.has(islandId);
  });
}

export function validateStartingIsland(state: GameState, vertexId: VertexId): void {
  if (!canStartOnIsland(state, vertexId)) {
    throw new Error('Starting settlement must be placed on the main island');
  }
}

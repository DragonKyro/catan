import type { GameState, VertexId } from '../../../types';

// Starting settlements must touch one of `state.startingIslands` (set by the
// generator from the scenario: the main island for most scenarios, the two
// large islands in Cloth for Catan, unrestricted when undefined). Used by
// the placement helpers (so AI/UI don't propose illegal vertices) and by the
// setup wrapper (which throws on a violation).
export function canStartOnIsland(state: GameState, vertexId: VertexId): boolean {
  const allowed = state.startingIslands;
  if (!allowed || !state.board.islandOfHex) return true;
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return false;
  return vertex.hexes.some((hexId) => {
    const islandId = state.board.islandOfHex![hexId];
    return islandId !== undefined && allowed.includes(islandId);
  });
}

export function validateStartingIsland(state: GameState, vertexId: VertexId): void {
  if (!canStartOnIsland(state, vertexId)) {
    throw new Error('Starting settlements must go on the main island');
  }
}

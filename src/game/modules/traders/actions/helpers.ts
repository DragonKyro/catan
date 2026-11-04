import type { GameState, VertexId } from '../../../types';

// River-tile tests live with the coins (src/game/modules/traders/coins/gold.ts).
export { vertexIsOnRiverTile, edgeIsOnRiverTile } from '../coins/gold';

// Fishing on Catan: is this vertex eligible for the starting fish bonus?
// True when it is a corner of the lake or one of the three corners a
// fishing-ground tile touches.
export function vertexIsOnFishingWater(
  state: GameState,
  vertexId: VertexId,
): boolean {
  if (state.lakeHexId) {
    const v = state.board.vertices[vertexId];
    if (v && v.hexes.includes(state.lakeHexId)) return true;
  }
  for (const fg of state.fishingGrounds ?? []) {
    if (fg.vertices.includes(vertexId)) return true;
  }
  return false;
}

import type { GameState, EdgeId, VertexId } from '../../../types';

// Is this vertex adjacent to a swamp (river tile) hex?
// Our simplified Rivers of Catan model equates "intersection of a river tile"
// with "vertex adjacent to a swamp hex." Each swamp-touching settlement or
// city earns 1 gold on placement.
export function vertexIsOnRiverTile(
  state: GameState,
  vertexId: VertexId,
): boolean {
  const v = state.board.vertices[vertexId];
  if (!v) return false;
  return v.hexes.some((h) => state.board.hexes[h]?.terrain === 'swamp');
}

// Is this edge adjacent to a swamp hex? Used to grant +1 gold for roads
// built on the rim of a river tile (river edges themselves are blocked for
// roads — those need bridges).
export function edgeIsOnRiverTile(
  state: GameState,
  edgeId: EdgeId,
): boolean {
  const e = state.board.edges[edgeId];
  if (!e) return false;
  return e.hexes.some((h) => state.board.hexes[h]?.terrain === 'swamp');
}

// Fishing on Catan: is this vertex eligible for the starting fish bonus?
// True when it touches the lake hex or is the anchor for one of the
// scenario's fishing-ground tiles.
export function vertexIsOnFishingWater(
  state: GameState,
  vertexId: VertexId,
): boolean {
  if (state.lakeHexId) {
    const v = state.board.vertices[vertexId];
    if (v && v.hexes.includes(state.lakeHexId)) return true;
  }
  if (state.fishingGrounds) {
    for (const fg of state.fishingGrounds) {
      if (fg.vertex === vertexId) return true;
    }
  }
  return false;
}

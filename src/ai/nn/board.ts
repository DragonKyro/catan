// Catan learned agent — canonical board index.
//
// Gives every hex / vertex / edge of a board a fixed row index, shared by the
// encoder (one feature row per entity) and the planned action space (one slot
// per vertex / edge / hex), plus the board's topology as flat index arrays a
// graph network can gather over. Base boards keep the same graph for every
// game of a variant (only terrain, numbers and ports are shuffled), so the
// index is built once per board shape and cached.
//
// Order is geometric, not the generator's insertion order: hexes by (r, q),
// vertices by pixel (y, x), edges by midpoint (y, x). Every base layout sits
// on the same pixel grid (one hex class, origin 0,0), so the 19-, 30- and
// 37-hex boards agree on the ids of the positions they share.

import type { BoardState, EdgeId, HexId, VertexId } from '@/game/types';

/** Missing neighbour / corner in a padded topology array. */
export const NONE = -1;

export interface BoardIndex {
  /** Cache key: the board's hex ids, sorted. */
  key: string;
  hexIds: HexId[];
  vertexIds: VertexId[];
  edgeIds: EdgeId[];
  hexIndex: Map<HexId, number>;
  vertexIndex: Map<VertexId, number>;
  edgeIndex: Map<EdgeId, number>;
  /** H×6: each hex's corners, clockwise as the board stores them. */
  hexVertices: Int32Array;
  /** H×6: hexes sharing an edge with each hex, NONE-padded. */
  hexNeighbors: Int32Array;
  /** V×3: hexes touching each vertex, NONE-padded. */
  vertexHexes: Int32Array;
  /** V×3: edges at each vertex, NONE-padded. */
  vertexEdges: Int32Array;
  /** V×3: vertices one edge away, NONE-padded. */
  vertexNeighbors: Int32Array;
  /** E×2: each edge's endpoints. */
  edgeVertices: Int32Array;
  /** E×2: hexes on either side of each edge, NONE-padded. */
  edgeHexes: Int32Array;
  /** On the board's rim: hex with < 6 neighbours, vertex with < 3 hexes, edge with 1 hex. */
  coastalHex: Uint8Array;
  coastalVertex: Uint8Array;
  coastalEdge: Uint8Array;
}

const cache = new Map<string, BoardIndex>();

export function boardIndex(board: BoardState): BoardIndex {
  const key = [...board.hexIds].sort().join(';');
  let index = cache.get(key);
  if (!index) {
    index = buildIndex(board, key);
    if (cache.size > 32) cache.clear();
    cache.set(key, index);
  }
  return index;
}

function buildIndex(board: BoardState, key: string): BoardIndex {
  const hexIds = [...board.hexIds].sort((a, b) => {
    const ha = board.hexes[a]!.coord;
    const hb = board.hexes[b]!.coord;
    return ha.r - hb.r || ha.q - hb.q;
  });
  const vertexIds = [...board.vertexIds].sort((a, b) => {
    const pa = board.vertices[a]!.position;
    const pb = board.vertices[b]!.position;
    return pa.y - pb.y || pa.x - pb.x;
  });
  const mid = (e: EdgeId) => {
    const [a, b] = board.edges[e]!.vertices;
    const pa = board.vertices[a]!.position;
    const pb = board.vertices[b]!.position;
    return { x: pa.x + pb.x, y: pa.y + pb.y };
  };
  const edgeIds = [...board.edgeIds].sort((a, b) => {
    const ma = mid(a);
    const mb = mid(b);
    return ma.y - mb.y || ma.x - mb.x;
  });

  const hexIndex = new Map(hexIds.map((id, i) => [id, i]));
  const vertexIndex = new Map(vertexIds.map((id, i) => [id, i]));
  const edgeIndex = new Map(edgeIds.map((id, i) => [id, i]));
  const H = hexIds.length;
  const V = vertexIds.length;
  const E = edgeIds.length;

  const fill = (arr: Int32Array, row: number, width: number, values: number[]) => {
    for (let k = 0; k < width; k++) arr[row * width + k] = k < values.length ? values[k]! : NONE;
  };

  const hexVertices = new Int32Array(H * 6);
  const hexNeighbors = new Int32Array(H * 6);
  const neighbors: number[][] = hexIds.map(() => []);
  for (const e of edgeIds) {
    const hs = board.edges[e]!.hexes.map((h) => hexIndex.get(h)!).filter((h) => h !== undefined);
    if (hs.length === 2) {
      neighbors[hs[0]!]!.push(hs[1]!);
      neighbors[hs[1]!]!.push(hs[0]!);
    }
  }
  const coastalHex = new Uint8Array(H);
  hexIds.forEach((id, i) => {
    fill(hexVertices, i, 6, board.hexes[id]!.corners.map((v) => vertexIndex.get(v)!));
    const ns = neighbors[i]!.sort((a, b) => a - b);
    fill(hexNeighbors, i, 6, ns);
    coastalHex[i] = ns.length < 6 ? 1 : 0;
  });

  const vertexHexes = new Int32Array(V * 3);
  const vertexEdges = new Int32Array(V * 3);
  const vertexNeighbors = new Int32Array(V * 3);
  const coastalVertex = new Uint8Array(V);
  vertexIds.forEach((id, i) => {
    const v = board.vertices[id]!;
    const hs = v.hexes.map((h) => hexIndex.get(h)!).sort((a, b) => a - b);
    fill(vertexHexes, i, 3, hs);
    fill(vertexEdges, i, 3, v.edges.map((e) => edgeIndex.get(e)!).sort((a, b) => a - b));
    fill(vertexNeighbors, i, 3, v.neighborVertices.map((n) => vertexIndex.get(n)!).sort((a, b) => a - b));
    coastalVertex[i] = hs.length < 3 ? 1 : 0;
  });

  const edgeVertices = new Int32Array(E * 2);
  const edgeHexes = new Int32Array(E * 2);
  const coastalEdge = new Uint8Array(E);
  edgeIds.forEach((id, i) => {
    const e = board.edges[id]!;
    fill(edgeVertices, i, 2, e.vertices.map((v) => vertexIndex.get(v)!).sort((a, b) => a - b));
    const hs = e.hexes.map((h) => hexIndex.get(h)!).sort((a, b) => a - b);
    fill(edgeHexes, i, 2, hs);
    coastalEdge[i] = hs.length < 2 ? 1 : 0;
  });

  return {
    key, hexIds, vertexIds, edgeIds, hexIndex, vertexIndex, edgeIndex,
    hexVertices, hexNeighbors, vertexHexes, vertexEdges, vertexNeighbors, edgeVertices, edgeHexes,
    coastalHex, coastalVertex, coastalEdge,
  };
}

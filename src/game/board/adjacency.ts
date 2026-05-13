import type { BoardState, VertexId, HexId, EdgeId, PortType } from '../types';

export function getPortAtVertex(board: BoardState, vertexId: VertexId): PortType | null {
  for (const port of board.ports) {
    const edge = board.edges[port.edge];
    if (!edge) continue;
    if (edge.vertices[0] === vertexId || edge.vertices[1] === vertexId) return port.type;
  }
  return null;
}

export function getHexesAdjacentToVertex(board: BoardState, vertexId: VertexId): HexId[] {
  return board.vertices[vertexId]?.hexes ?? [];
}

export function getEdgesAtVertex(board: BoardState, vertexId: VertexId): EdgeId[] {
  return board.vertices[vertexId]?.edges ?? [];
}

export function getNeighborVertices(board: BoardState, vertexId: VertexId): VertexId[] {
  return board.vertices[vertexId]?.neighborVertices ?? [];
}

export function edgeTouchesVertex(board: BoardState, edgeId: EdgeId, vertexId: VertexId): boolean {
  const e = board.edges[edgeId];
  return !!e && (e.vertices[0] === vertexId || e.vertices[1] === vertexId);
}

// Hexes adjacent to a hex (sharing an edge).
export function buildHexAdjacency(board: BoardState): Map<HexId, HexId[]> {
  const adj = new Map<HexId, Set<HexId>>();
  for (const h of board.hexIds) adj.set(h, new Set());
  for (const e of Object.values(board.edges)) {
    if (e.hexes.length === 2) {
      const [h1, h2] = e.hexes;
      adj.get(h1!)!.add(h2!);
      adj.get(h2!)!.add(h1!);
    }
  }
  const out = new Map<HexId, HexId[]>();
  for (const [k, v] of adj) out.set(k, [...v]);
  return out;
}

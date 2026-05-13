import { defineHex, Grid, Orientation, spiral } from 'honeycomb-grid';
import type { Vertex, Edge, VertexId, EdgeId, HexId } from '../types';
import { vertexKey, edgeKey } from './coords';

const HEX_SIZE = 50;

const HexClass = defineHex({
  dimensions: HEX_SIZE,
  orientation: Orientation.POINTY,
  origin: { x: 0, y: 0 },
});

export interface BaseGraph {
  hexIds: HexId[];
  hexCoords: Map<HexId, { q: number; r: number }>;
  hexCorners: Map<HexId, VertexId[]>;
  vertices: Record<VertexId, Vertex>;
  edges: Record<EdgeId, Edge>;
  vertexIds: VertexId[];
  edgeIds: EdgeId[];
}

// Build the 19-hex (spiral radius 2) board graph: hexes, vertices (deduped
// from hex corners), and edges (between consecutive corners), with full
// cross-adjacency populated.
export function buildBaseGraph(): BaseGraph {
  const grid = new Grid(HexClass, spiral({ radius: 2 }));

  const hexIds: HexId[] = [];
  const hexCoords = new Map<HexId, { q: number; r: number }>();
  const hexCorners = new Map<HexId, VertexId[]>();
  const vertices: Record<VertexId, Vertex> = {};
  const edges: Record<EdgeId, Edge> = {};

  for (const hex of grid) {
    const hexId = `${hex.q},${hex.r}`;
    hexIds.push(hexId);
    hexCoords.set(hexId, { q: hex.q, r: hex.r });

    const cornerIds: VertexId[] = [];
    const corners = hex.corners;
    for (const corner of corners) {
      const vid = vertexKey(corner);
      cornerIds.push(vid);
      if (!vertices[vid]) {
        vertices[vid] = {
          id: vid,
          position: { x: Math.round(corner.x * 100) / 100, y: Math.round(corner.y * 100) / 100 },
          hexes: [],
          edges: [],
          neighborVertices: [],
        };
      }
      if (!vertices[vid].hexes.includes(hexId)) {
        vertices[vid].hexes.push(hexId);
      }
    }
    hexCorners.set(hexId, cornerIds);

    for (let i = 0; i < 6; i++) {
      const v1 = cornerIds[i]!;
      const v2 = cornerIds[(i + 1) % 6]!;
      const eid = edgeKey(v1, v2);
      if (!edges[eid]) {
        const sortedEndpoints: [VertexId, VertexId] = v1 < v2 ? [v1, v2] : [v2, v1];
        edges[eid] = {
          id: eid,
          vertices: sortedEndpoints,
          hexes: [],
          neighborEdges: [],
        };
      }
      if (!edges[eid].hexes.includes(hexId)) {
        edges[eid].hexes.push(hexId);
      }
    }
  }

  // Wire vertex.edges + vertex.neighborVertices
  for (const edge of Object.values(edges)) {
    const [v1, v2] = edge.vertices;
    if (!vertices[v1]!.edges.includes(edge.id)) vertices[v1]!.edges.push(edge.id);
    if (!vertices[v2]!.edges.includes(edge.id)) vertices[v2]!.edges.push(edge.id);
    if (!vertices[v1]!.neighborVertices.includes(v2)) vertices[v1]!.neighborVertices.push(v2);
    if (!vertices[v2]!.neighborVertices.includes(v1)) vertices[v2]!.neighborVertices.push(v1);
  }

  // Wire edge.neighborEdges (edges sharing a vertex)
  for (const edge of Object.values(edges)) {
    const [v1, v2] = edge.vertices;
    const candidates = new Set<EdgeId>();
    for (const e of vertices[v1]!.edges) if (e !== edge.id) candidates.add(e);
    for (const e of vertices[v2]!.edges) if (e !== edge.id) candidates.add(e);
    edge.neighborEdges = [...candidates];
  }

  return {
    hexIds,
    hexCoords,
    hexCorners,
    vertices,
    edges,
    vertexIds: Object.keys(vertices),
    edgeIds: Object.keys(edges),
  };
}

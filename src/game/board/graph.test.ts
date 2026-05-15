import { describe, it, expect } from 'vitest';
import { buildBaseGraph } from './graph';

describe('buildBaseGraph', () => {
  const graph = buildBaseGraph();

  it('produces 19 hexes (standard Catan board)', () => {
    expect(graph.hexIds).toHaveLength(19);
  });

  it('produces 54 vertices (standard Catan settlement spots)', () => {
    expect(graph.vertexIds).toHaveLength(54);
  });

  it('produces 72 edges (standard Catan road spots)', () => {
    expect(graph.edgeIds).toHaveLength(72);
  });

  it('every vertex belongs to 1-3 hexes', () => {
    for (const v of Object.values(graph.vertices)) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
    }
  });

  it('every edge belongs to 1-2 hexes', () => {
    for (const e of Object.values(graph.edges)) {
      expect(e.hexes.length).toBeGreaterThanOrEqual(1);
      expect(e.hexes.length).toBeLessThanOrEqual(2);
    }
  });

  it('vertex.edges + vertex.neighborVertices are consistent', () => {
    for (const v of Object.values(graph.vertices)) {
      expect(v.edges.length).toBe(v.neighborVertices.length);
      expect(v.edges.length).toBeGreaterThanOrEqual(2);
      expect(v.edges.length).toBeLessThanOrEqual(3);
    }
  });

  it('adjacency is symmetric: if A is a neighbor of B, then B is a neighbor of A', () => {
    for (const v of Object.values(graph.vertices)) {
      for (const n of v.neighborVertices) {
        expect(graph.vertices[n]!.neighborVertices).toContain(v.id);
      }
    }
  });

  it('every edge endpoint has the edge in its edges list', () => {
    for (const e of Object.values(graph.edges)) {
      const [v1, v2] = e.vertices;
      expect(graph.vertices[v1]!.edges).toContain(e.id);
      expect(graph.vertices[v2]!.edges).toContain(e.id);
    }
  });

  it('every hex has 6 corner vertices', () => {
    for (const corners of graph.hexCorners.values()) {
      expect(corners).toHaveLength(6);
    }
  });
});

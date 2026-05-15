import type { VertexId, EdgeId } from '../types';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function vertexKey(p: { x: number; y: number }): VertexId {
  return `${round2(p.x)},${round2(p.y)}`;
}

export function edgeKey(v1: VertexId, v2: VertexId): EdgeId {
  return v1 < v2 ? `${v1}|${v2}` : `${v2}|${v1}`;
}

export function edgeVertices(edge: EdgeId): [VertexId, VertexId] {
  const [a, b] = edge.split('|');
  if (!a || !b) throw new Error(`Invalid edge id: ${edge}`);
  return [a, b];
}

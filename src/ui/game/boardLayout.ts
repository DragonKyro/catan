import type { BoardState, EdgeId, HexId } from '@/game/types';

export interface Point {
  x: number;
  y: number;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getViewBox(board: BoardState, padding = 60): ViewBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of Object.values(board.vertices)) {
    if (v.position.x < minX) minX = v.position.x;
    if (v.position.y < minY) minY = v.position.y;
    if (v.position.x > maxX) maxX = v.position.x;
    if (v.position.y > maxY) maxY = v.position.y;
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding,
  };
}

export function getEdgeMidpoint(board: BoardState, edgeId: EdgeId): Point {
  const e = board.edges[edgeId]!;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function getEdgeAngleDeg(board: BoardState, edgeId: EdgeId): number {
  const e = board.edges[edgeId]!;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
}

export function getEdgeLength(board: BoardState, edgeId: EdgeId): number {
  const e = board.edges[edgeId]!;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// For coastal edges, returns the marker position on the OCEAN side of the
// edge — distance pixels away from the single adjacent hex's center.
export function getPortMarkerPosition(
  board: BoardState,
  edgeId: EdgeId,
  distance: number,
): Point {
  const edge = board.edges[edgeId]!;
  const mid = getEdgeMidpoint(board, edgeId);
  const hexId = edge.hexes[0]!;
  const hex = board.hexes[hexId]!;
  const dx = mid.x - hex.center.x;
  const dy = mid.y - hex.center.y;
  const mag = Math.hypot(dx, dy) || 1;
  return {
    x: mid.x + (dx / mag) * distance,
    y: mid.y + (dy / mag) * distance,
  };
}

export function probabilityDots(token: number | null): number {
  if (token === null) return 0;
  return 6 - Math.abs(7 - token);
}

export function hexPolygonPoints(board: BoardState, hexId: HexId): string {
  const hex = board.hexes[hexId]!;
  return hex.corners
    .map((vid) => {
      const p = board.vertices[vid]!.position;
      return `${p.x},${p.y}`;
    })
    .join(' ');
}

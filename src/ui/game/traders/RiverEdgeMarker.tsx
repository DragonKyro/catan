import type { BoardState, EdgeId } from '@/game/types';

interface Props {
  board: BoardState;
  edge: EdgeId;
}

// Renders a wavy water motif along a river edge so players can see the
// bridge sites even when no bridge has been built yet. Subtle blue stroke
// with a slight perpendicular wobble.
export function RiverEdgeMarker({ board, edge }: Props) {
  const e = board.edges[edge];
  if (!e) return null;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  // Two faint wave curves crossing the edge midpoint.
  const w = 5;
  const c1x = mx + nx * w;
  const c1y = my + ny * w;
  const c2x = mx - nx * w;
  const c2y = my - ny * w;
  return (
    <g className="river-edge" pointerEvents="none">
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="#3a78b8"
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d={`M${p1.x},${p1.y} Q${c1x},${c1y} ${p2.x},${p2.y}`}
        stroke="#84c0ec"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d={`M${p1.x},${p1.y} Q${c2x},${c2y} ${p2.x},${p2.y}`}
        stroke="#84c0ec"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
        opacity={0.55}
      />
    </g>
  );
}

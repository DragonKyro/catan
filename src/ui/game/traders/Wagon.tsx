import type { BoardState, EdgeId } from '@/game/types';

interface Props {
  board: BoardState;
  edge: EdgeId;
}

// A neutral trade wagon (Merchant Trains). Rendered on an edge — a small
// rounded rectangle with two wheels, distinct enough from roads / ships /
// bridges that players can spot wagons even when stacked on a road of the
// same color.
export function Wagon({ board, edge }: Props) {
  const e = board.edges[edge];
  if (!e) return null;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <g
      className="wagon"
      transform={`translate(${mx}, ${my}) rotate(${angle})`}
      pointerEvents="none"
    >
      {/* Body — short rectangle along the edge */}
      <rect
        x={-9}
        y={-4.5}
        width={18}
        height={9}
        rx={1.5}
        fill="#7a5610"
        stroke="#1a1a1a"
        strokeWidth={1}
      />
      {/* Tarp / canopy */}
      <path
        d="M-7,-4.5 Q0,-8 7,-4.5"
        fill="#d8c08a"
        stroke="#5a3d10"
        strokeWidth={0.6}
      />
      {/* Two wheels */}
      <circle cx={-5} cy={4.5} r={2} fill="#1a1a1a" />
      <circle cx={5} cy={4.5} r={2} fill="#1a1a1a" />
      <circle cx={-5} cy={4.5} r={0.6} fill="#d8c08a" />
      <circle cx={5} cy={4.5} r={0.6} fill="#d8c08a" />
    </g>
  );
}

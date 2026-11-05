import type { BoardState, EdgeId } from '@/game/types';

interface Props {
  board: BoardState;
  edge: EdgeId;
}

// Catan Event Cards / Earthquake: a road "turned sideways". Drawn over the
// road as a crack — a jagged dark line across it with a small red
// warning disc — so damaged roads stand out at board scale while the
// owner's colour stays visible.
export function DamagedRoadMarker({ board, edge }: Props) {
  const e = board.edges[edge];
  if (!e) return null;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  return (
    <g
      className="damaged-road"
      transform={`translate(${mx}, ${my}) rotate(${angle})`}
      pointerEvents="none"
    >
      <path
        d="M-9,-1 L-5,2 L-2,-2.5 L1,2.5 L4,-2 L7,1.5 L10,-1"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <path
        d="M-9,-1 L-5,2 L-2,-2.5 L1,2.5 L4,-2 L7,1.5 L10,-1"
        fill="none"
        stroke="#f5d76e"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      <g transform={`rotate(${-angle}) translate(0, -9)`}>
        <circle r={4.4} fill="#c0392b" stroke="#fff" strokeWidth={1} />
        <text y={2.4} textAnchor="middle" fontSize={6.5} fontWeight={800} fill="#fff">
          !
        </text>
      </g>
    </g>
  );
}

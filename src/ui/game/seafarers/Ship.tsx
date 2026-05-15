import type { BoardState, EdgeId, PlayerColor } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  edge: EdgeId;
  color: PlayerColor;
}

// Ship piece — a small hull + sail rendered at the edge midpoint, oriented
// along the edge. Visually distinct from a road so the two pieces are
// readable even on a busy coastal vertex.
export function Ship({ board, edge, color }: Props) {
  const e = board.edges[edge]!;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;

  return (
    <g
      className="ship"
      transform={`translate(${cx}, ${cy}) rotate(${angle})`}
    >
      {/* Hull */}
      <path
        d="M-9,2 L9,2 L7,5 L-7,5 Z"
        fill={playerColorVar(color)}
        stroke="#1a1a1a"
        strokeWidth={1}
      />
      {/* Mast */}
      <line x1={0} y1={2} x2={0} y2={-7} stroke="#1a1a1a" strokeWidth={1} />
      {/* Sail */}
      <path
        d="M0,-7 L6,-1 L0,-1 Z"
        fill="#fdfbf3"
        stroke="#1a1a1a"
        strokeWidth={0.8}
      />
    </g>
  );
}

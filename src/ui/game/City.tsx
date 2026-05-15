import type { BoardState, PlayerColor, VertexId } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  vertex: VertexId;
  color: PlayerColor;
}

export function City({ board, vertex, color }: Props) {
  const p = board.vertices[vertex]!.position;
  // Step-up silhouette: low rectangle on right, taller tower on left.
  return (
    <g transform={`translate(${p.x}, ${p.y})`} className="city">
      <path
        d="M-10,8 L-10,-4 L-3,-4 L-3,-9 L4,-9 L4,-4 L10,-4 L10,8 Z"
        fill={playerColorVar(color)}
        stroke="#1a1a1a"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </g>
  );
}

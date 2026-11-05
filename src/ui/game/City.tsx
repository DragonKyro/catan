import type { BoardState, PlayerColor, VertexId } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  vertex: VertexId;
  color: PlayerColor;
  // T&B Barbarian Attack: a conquered building is stood on its end.
  tipped?: boolean;
}

export function City({ board, vertex, color, tipped }: Props) {
  const p = board.vertices[vertex]!.position;
  // Step-up silhouette: low rectangle on right, taller tower on left.
  return (
    <g
      transform={`translate(${p.x}, ${p.y})${tipped ? ' rotate(90)' : ''}`}
      className={tipped ? 'city city-tipped' : 'city'}
      opacity={tipped ? 0.8 : undefined}
    >
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

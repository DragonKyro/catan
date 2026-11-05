import type { BoardState, PlayerColor, VertexId } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  vertex: VertexId;
  color: PlayerColor;
  // T&B Barbarian Attack: a conquered building is stood on its end.
  tipped?: boolean;
}

export function Settlement({ board, vertex, color, tipped }: Props) {
  const p = board.vertices[vertex]!.position;
  return (
    <g
      transform={`translate(${p.x}, ${p.y})${tipped ? ' rotate(90) translate(0, 1)' : ''}`}
      className={tipped ? 'settlement settlement-tipped' : 'settlement'}
      opacity={tipped ? 0.8 : undefined}
    >
      <path
        d="M-7,5 L-7,-2 L0,-7 L7,-2 L7,5 Z"
        fill={playerColorVar(color)}
        stroke="#1a1a1a"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </g>
  );
}

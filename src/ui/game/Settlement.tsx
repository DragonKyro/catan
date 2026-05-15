import type { PlayerColor, VertexId } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  vertex: VertexId;
  color: PlayerColor;
}

export function Settlement({ vertex, color }: Props) {
  const game = useGameStore((s) => s.game!);
  const p = game.board.vertices[vertex]!.position;
  return (
    <g transform={`translate(${p.x}, ${p.y})`} className="settlement">
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

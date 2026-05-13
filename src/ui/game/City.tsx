import type { PlayerColor, VertexId } from '@/game/types';
import { useGameStore } from '@/store/gameStore';

const COLOR_FILL: Record<PlayerColor, string> = {
  red: 'var(--player-red)',
  blue: 'var(--player-blue)',
  orange: 'var(--player-orange)',
  white: 'var(--player-white)',
};

interface Props {
  vertex: VertexId;
  color: PlayerColor;
}

export function City({ vertex, color }: Props) {
  const game = useGameStore((s) => s.game!);
  const p = game.board.vertices[vertex]!.position;
  // Step-up silhouette: low rectangle on right, taller tower on left.
  return (
    <g transform={`translate(${p.x}, ${p.y})`} className="city">
      <path
        d="M-10,8 L-10,-4 L-3,-4 L-3,-9 L4,-9 L4,-4 L10,-4 L10,8 Z"
        fill={COLOR_FILL[color]}
        stroke="#1a1a1a"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </g>
  );
}

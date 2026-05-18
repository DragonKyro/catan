import type { BoardState, KnightStrength, PlayerColor, VertexId } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  vertex: VertexId;
  color: PlayerColor;
  strength: KnightStrength;
  active: boolean;
}

// Cities & Knights — a knight piece rendered at a vertex. Standing posture
// when active; tilted (lying down) when inactive. Strength is shown by
// 1/2/3 pips on the shield.
export function KnightPiece({ board, vertex, color, strength, active }: Props) {
  const v = board.vertices[vertex];
  if (!v) return null;
  const { x, y } = v.position;
  const fill = playerColorVar(color);
  // Lay inactive knights on their side (rotate -75deg around the vertex).
  const transform = active
    ? `translate(${x}, ${y})`
    : `translate(${x}, ${y}) rotate(-75)`;
  return (
    <g transform={transform} className="knight-piece" pointerEvents="none">
      {/* Base / body */}
      <path
        d="M-7,7 L-7,1 L-5,-3 L-2,-7 L2,-7 L5,-3 L7,1 L7,7 Z"
        fill={fill}
        stroke="#1a1a1a"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {/* Head dot */}
      <circle cx={0} cy={-9} r={2.6} fill={fill} stroke="#1a1a1a" strokeWidth={1} />
      {/* Strength pips on the shield */}
      {Array.from({ length: strength }).map((_, i) => (
        <circle
          key={i}
          cx={-3 + i * 3}
          cy={2}
          r={0.9}
          fill="#fff"
          stroke="#1a1a1a"
          strokeWidth={0.4}
        />
      ))}
    </g>
  );
}

import type { BoardState, EdgeId, PlayerColor } from '@/game/types';
import { PLAYER_COLOR_HEX } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  edge: EdgeId;
  color: PlayerColor;
}

// T&B defender knight, mounted on an edge bordering a castle. Rendered as
// a small shield in the player's color sitting on a darker base plate, so
// it reads as a defender token rather than a road piece.
export function Knight({ board, edge, color }: Props) {
  const e = board.edges[edge];
  if (!e) return null;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const fill = PLAYER_COLOR_HEX[color];
  return (
    <g
      className="knight"
      transform={`translate(${mx}, ${my}) rotate(${angle})`}
      pointerEvents="none"
    >
      {/* Base plate — dark slate so the shield reads against any road */}
      <rect x={-7} y={-5} width={14} height={10} rx={1.5} fill="#1a1a1a" />
      {/* Shield: heater shape with player-color face */}
      <path
        d="M-4,-4 L4,-4 L4,1 Q4,3.5 0,4 Q-4,3.5 -4,1 Z"
        fill={fill}
        stroke="#f5f5f5"
        strokeWidth={0.8}
      />
      {/* Sword cross stripe */}
      <line x1={0} y1={-3} x2={0} y2={3} stroke="#f5f5f5" strokeWidth={0.7} />
      <line x1={-2.4} y1={-1} x2={2.4} y2={-1} stroke="#f5f5f5" strokeWidth={0.7} />
    </g>
  );
}

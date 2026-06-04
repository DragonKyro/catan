import type { BoardState, EdgeId, PlayerColor } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  edge: EdgeId;
  color: PlayerColor;
}

// Bridge sprite: a player-color road bar plus a pair of arch pylons that
// distinguish it visually from a regular road. Renders on river edges only.
export function Bridge({ board, edge, color }: Props) {
  const e = board.edges[edge]!;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Normal vector (90° CCW) for arch placement above/below the deck.
  const nx = -uy;
  const ny = ux;
  const shrink = 5;
  const x1 = p1.x + ux * shrink;
  const y1 = p1.y + uy * shrink;
  const x2 = p2.x - ux * shrink;
  const y2 = p2.y - uy * shrink;
  // Arch pylon endpoints — offset perpendicular to the deck.
  const archOff = 4;
  const a1x = x1 + nx * archOff;
  const a1y = y1 + ny * archOff;
  const a2x = x2 + nx * archOff;
  const a2y = y2 + ny * archOff;
  return (
    <g className="bridge">
      {/* Deck */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#1a1a1a"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={playerColorVar(color)}
        strokeWidth={6.5}
        strokeLinecap="round"
      />
      {/* Arch — single curve above the deck. */}
      <path
        d={`M${a1x},${a1y} Q${(a1x + a2x) / 2 + nx * 4},${(a1y + a2y) / 2 + ny * 4} ${a2x},${a2y}`}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </g>
  );
}

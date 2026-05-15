import type { EdgeId, PlayerColor } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  edge: EdgeId;
  color: PlayerColor;
}

export function Road({ edge, color }: Props) {
  const game = useGameStore((s) => s.game!);
  const e = game.board.edges[edge]!;
  const p1 = game.board.vertices[e.vertices[0]]!.position;
  const p2 = game.board.vertices[e.vertices[1]]!.position;
  // Foreshorten endpoints slightly so roads don't overlap vertex markers.
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const shrink = 6;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = p1.x + ux * shrink;
  const y1 = p1.y + uy * shrink;
  const x2 = p2.x - ux * shrink;
  const y2 = p2.y - uy * shrink;
  return (
    <g className="road">
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#1a1a1a"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={playerColorVar(color)}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </g>
  );
}

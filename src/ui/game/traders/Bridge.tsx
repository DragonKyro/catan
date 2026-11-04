import type { BoardState, EdgeId, PlayerColor } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  edge: EdgeId;
  color: PlayerColor;
}

// T&B bridge: an arched deck in the player's colour along the bridge site,
// on grey stone abutments, with the arch's shadow over the water. Reads as
// "not a road" at a glance (curved, wider ends) while sitting on the edge
// like one.
export function Bridge({ board, edge, color }: Props) {
  const e = board.edges[edge]!;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Bow the deck away from the board's centre so every bridge arches
  // "outward" consistently.
  let nx = -uy;
  let ny = ux;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  if (nx * mx + ny * my < 0) {
    nx = -nx;
    ny = -ny;
  }
  const shrink = 5;
  const a = { x: p1.x + ux * shrink, y: p1.y + uy * shrink };
  const b = { x: p2.x - ux * shrink, y: p2.y - uy * shrink };
  const bow = 6;
  const c = { x: mx + nx * bow, y: my + ny * bow };
  const deck = `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`;
  const shadow = `M${a.x - nx * 2},${a.y - ny * 2} Q${mx - nx * 7},${my - ny * 7} ${b.x - nx * 2},${b.y - ny * 2}`;
  const abutment = (p: { x: number; y: number }) => (
    <rect
      x={p.x - 4}
      y={p.y - 4}
      width={8}
      height={8}
      rx={1.5}
      fill="#8d8d8d"
      stroke="#1a1a1a"
      strokeWidth={1.3}
      transform={`rotate(${(Math.atan2(uy, ux) * 180) / Math.PI}, ${p.x}, ${p.y})`}
    />
  );
  return (
    <g className="bridge">
      <path d={shadow} fill="none" stroke="#1d4a63" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      {abutment(a)}
      {abutment(b)}
      <path d={deck} fill="none" stroke="#1a1a1a" strokeWidth={9.5} strokeLinecap="round" />
      <path d={deck} fill="none" stroke={playerColorVar(color)} strokeWidth={6.2} strokeLinecap="round" />
      {/* Railing highlight. */}
      <path
        d={`M${a.x + nx * 1.6},${a.y + ny * 1.6} Q${c.x + nx * 1.6},${c.y + ny * 1.6} ${b.x + nx * 1.6},${b.y + ny * 1.6}`}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </g>
  );
}

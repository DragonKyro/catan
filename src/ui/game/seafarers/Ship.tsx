import type { BoardState, EdgeId, PlayerColor } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  board: BoardState;
  edge: EdgeId;
  color: PlayerColor;
  // Pirate Islands warship: "Turn the ship on its side to show its new
  // status" — drawn with a dark battle sail and a gun port.
  warship?: boolean;
}

// Ship piece — a small hull + sail rendered at the edge midpoint, oriented
// along the edge. Visually distinct from a road so the two pieces are
// readable even on a busy coastal vertex.
export function Ship({ board, edge, color, warship }: Props) {
  const e = board.edges[edge]!;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;

  return (
    <g
      className="ship"
      transform={`translate(${cx}, ${cy}) rotate(${angle})`}
    >
      {/* Hull */}
      <path
        d="M-9,2 L9,2 L7,5 L-7,5 Z"
        fill={playerColorVar(color)}
        stroke="#1a1a1a"
        strokeWidth={1}
      />
      {/* Mast */}
      <line x1={0} y1={2} x2={0} y2={-7} stroke="#1a1a1a" strokeWidth={1} />
      {/* Sail */}
      <path
        d="M0,-7 L6,-1 L0,-1 Z"
        fill={warship ? '#7a1010' : '#fdfbf3'}
        stroke="#1a1a1a"
        strokeWidth={0.8}
      />
      {warship && (
        <>
          <path d="M0,-7 L-5,-1 L0,-1 Z" fill="#7a1010" stroke="#1a1a1a" strokeWidth={0.8} />
          <circle cx={-4} cy={3.5} r={1.1} fill="#1a1a1a" />
          <circle cx={4} cy={3.5} r={1.1} fill="#1a1a1a" />
        </>
      )}
      {warship && <title>Warship</title>}
    </g>
  );
}

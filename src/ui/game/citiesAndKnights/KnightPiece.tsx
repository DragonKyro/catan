import type { BoardState, KnightStrength, PlayerColor, VertexId } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import { KNIGHT_LABEL } from '@/game/modules/citiesAndKnights/constants';

interface Props {
  board: BoardState;
  vertex: VertexId;
  color: PlayerColor;
  strength: KnightStrength;
  active: boolean;
}

// Knights are drawn a little larger on the board than in panels so the
// strength silhouette reads at board scale.
export const BOARD_KNIGHT_SCALE = 1.4;

// One knight figure: helmeted body on a small plinth, ~6 wide × 14 tall,
// standing on y = 0.
const FIGURE_D =
  'M-3,0 L-3.4,-2 L-2.6,-2.2 L-2.6,-9.5 C-2.6,-13.6 2.6,-13.6 2.6,-9.5 L2.6,-2.2 L3.4,-2 L3,0 Z';
const VISOR_D = 'M-1.6,-10.2 L1.6,-10.2';

// Cities & Knights knight (p.9). Like the 2025 pieces, a basic knight is one
// figure, a strong knight two figures joined, a mighty knight three — so the
// strength reads from the silhouette — plus 1-3 pips on the base. An ACTIVE
// knight stands upright; an INACTIVE knight lies on its side (p.9 "place it
// laying down").
export function KnightPiece({ board, vertex, color, strength, active }: Props) {
  const v = board.vertices[vertex];
  if (!v) return null;
  const { x, y } = v.position;
  return (
    <g
      transform={`translate(${x}, ${y})`}
      className={`knight-piece ${active ? 'is-active' : 'is-inactive'}`}
      pointerEvents="none"
    >
      <title>{`${KNIGHT_LABEL[strength]} (${active ? 'active' : 'inactive'})`}</title>
      <g transform={`scale(${BOARD_KNIGHT_SCALE})`}>
        <KnightGlyph color={playerColorVar(color)} strength={strength} active={active} />
      </g>
    </g>
  );
}

// The drawing on its own (used on the board and in panels / dialogs). Drawn
// around (0, 0): standing pieces rise above it, lying pieces rest on it.
export function KnightGlyph({
  color,
  strength,
  active,
}: {
  color: string;
  strength: KnightStrength;
  active: boolean;
}) {
  const offsets = strength === 1 ? [0] : strength === 2 ? [-2.6, 2.6] : [-4.6, 0, 4.6];
  const width = strength === 1 ? 8 : strength === 2 ? 13 : 17;
  // Back figures first, the centre (tallest) last.
  const order = strength === 3 ? [0, 2, 1] : offsets.map((_, i) => i);
  const body = (
    <g>
      {/* Base plate with strength pips. */}
      <rect x={-width / 2} y={-0.5} width={width} height={3.6} rx={1} fill="#2a2a2a" />
      {order.map((i) => {
        const dx = offsets[i]!;
        const tall = strength === 3 && i === 1 ? 1.15 : 1;
        return (
          <g key={i} transform={`translate(${dx}, 0) scale(1, ${tall})`}>
            <path d={FIGURE_D} fill={color} stroke="#151515" strokeWidth={0.9} strokeLinejoin="round" />
            <path d={VISOR_D} stroke="#151515" strokeWidth={0.9} strokeLinecap="round" />
          </g>
        );
      })}
      {offsets.map((dx, i) => (
        <circle key={`pip-${i}`} cx={dx} cy={1.35} r={0.8} fill="#ffd97e" />
      ))}
    </g>
  );
  if (active) {
    return <g transform="translate(0, 5)">{body}</g>;
  }
  // Lying down: the figure tipped onto its side, resting on the vertex.
  return (
    <g opacity={0.92}>
      <ellipse cx={0} cy={2.5 + width / 2} rx={9} ry={1.6} fill="#00000055" />
      {/* rotate(-90) lays the head to the left (x ≈ -13) and the base to the
          right (x ≈ +3); shift right to centre it on the intersection. */}
      <g transform="translate(5, 2) rotate(-90)">{body}</g>
    </g>
  );
}

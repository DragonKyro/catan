import type { BoardState, HexId } from '@/game/types';

interface Props {
  board: BoardState;
  hexId: HexId;
  label?: string;
}

// Stone-fortress silhouette overlaid on a castle hex so it reads as a
// special defensive position. Centered on the hex; sized to fit
// comfortably inside the polygon without crowding adjacent edges where
// knights sit.
export function CastleMarker({ board, hexId, label }: Props) {
  const hex = board.hexes[hexId];
  if (!hex) return null;
  const { x, y } = hex.center;
  return (
    <g
      className="castle-marker"
      transform={`translate(${x}, ${y})`}
      pointerEvents="none"
    >
      {/* Main keep + walls */}
      <path
        d="M-16,8 L-16,-6 L-11,-6 L-11,-3 L-6,-3 L-6,-10 L6,-10 L6,-3 L11,-3 L11,-6 L16,-6 L16,8 Z"
        fill="#3d4350"
        stroke="#15181f"
        strokeWidth={1.2}
      />
      {/* Battlements: small notches across the top of the keep */}
      <rect x={-14.5} y={-6} width={2.4} height={1.6} fill="#15181f" />
      <rect x={-9} y={-6} width={2.4} height={1.6} fill="#15181f" />
      <rect x={-4} y={-10} width={2.4} height={1.6} fill="#15181f" />
      <rect x={1} y={-10} width={2.4} height={1.6} fill="#15181f" />
      <rect x={6.6} y={-6} width={2.4} height={1.6} fill="#15181f" />
      <rect x={12.1} y={-6} width={2.4} height={1.6} fill="#15181f" />
      {/* Gate */}
      <rect x={-2.4} y={0} width={4.8} height={8} fill="#15181f" />
      {label && (
        <text
          y={20}
          textAnchor="middle"
          fontSize={9}
          fontWeight={600}
          fill="#1a1a1a"
          stroke="#fafafa"
          strokeWidth={2}
          paintOrder="stroke fill"
        >
          {label}
        </text>
      )}
    </g>
  );
}

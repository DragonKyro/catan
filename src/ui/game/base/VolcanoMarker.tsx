import type { BoardState } from '@/game/types';

interface Props {
  board: BoardState;
}

// Volcano marker — a lava-cone silhouette rendered on top of the volcano
// hex. Drawn under the number-token chip so the token stays legible (the
// volcano still has a number; that number is what triggers eruption).
//
// Only present when `board.volcanoHex` is set, which is exclusive to the
// Volcano scenario.
export function VolcanoMarker({ board }: Props) {
  if (!board.volcanoHex) return null;
  const hex = board.hexes[board.volcanoHex];
  if (!hex) return null;
  const { x, y } = hex.center;
  return (
    <g className="volcano" transform={`translate(${x}, ${y})`} pointerEvents="none">
      {/* Mountain silhouette (dark rock, wide base, peak above the token). */}
      <path
        d="M-16,8 L-3,-14 L3,-14 L16,8 Z"
        fill="#2b1810"
        stroke="#000"
        strokeWidth={0.8}
        opacity={0.85}
      />
      {/* Crater glow — a sliver of magma at the peak. */}
      <path
        d="M-3,-14 L3,-14 L1,-9 L-1,-9 Z"
        fill="#ff6a1a"
      />
      {/* Lava drips down the sides. */}
      <path
        d="M-1,-9 L-3,-3 L-1,-2 L-2,3 L0,5"
        fill="none"
        stroke="#ff6a1a"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <path
        d="M1,-9 L3,-1 L1,0 L4,5"
        fill="none"
        stroke="#ff8a2a"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </g>
  );
}

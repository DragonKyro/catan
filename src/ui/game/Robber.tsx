import type { BoardState } from '@/game/types';

interface Props {
  board: BoardState;
  // When false, the robber is "off-board" (T&B Fishing on Catan setup, C&K
  // before the first barbarian attack, or after a fish-spend remove-robber).
  // Render nothing in that case — board.robberHex is just a parking slot.
  active?: boolean;
}

export function Robber({ board, active = true }: Props) {
  if (!active) return null;
  const hex = board.hexes[board.robberHex]!;
  const { x, y } = hex.center;
  return (
    <g className="robber" transform={`translate(${x}, ${y - 4})`}>
      <ellipse cx={0} cy={14} rx={8} ry={3} fill="#00000060" />
      <path
        d="M0,-12 C5,-12 8,-8 8,-3 L8,8 L-8,8 L-8,-3 C-8,-8 -5,-12 0,-12 Z"
        fill="#1a1a1a"
        stroke="#fefefe"
        strokeWidth={1}
      />
      <circle cx={0} cy={-4} r={2.2} fill="#fefefe" />
    </g>
  );
}

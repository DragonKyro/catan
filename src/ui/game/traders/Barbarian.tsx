import type { BoardState, CastleState } from '@/game/types';

interface Props {
  board: BoardState;
  castle: CastleState;
}

// Barbarian-group marker for one castle. Rendered at the hex centre of
// `castle.barbarianPath[castle.barbarianPosition]`. When the group has
// arrived at the castle (position === path.length - 1), we still render
// (briefly, before combat resolves on endTurn) so the player can see
// what's about to hit.
//
// A faint arrow trail points from the current position toward the
// castle so it's visually obvious which castle this barbarian is
// converging on.
export function Barbarian({ board, castle }: Props) {
  const here = castle.barbarianPath[castle.barbarianPosition];
  if (!here) return null;
  const hex = board.hexes[here];
  if (!hex) return null;
  const { x, y } = hex.center;
  // Build a tail pointing toward the castle, drawn as little dashes
  // along the remaining path.
  const remaining = castle.barbarianPath.slice(castle.barbarianPosition + 1);
  return (
    <g className="barbarian" pointerEvents="none">
      {/* Path trail dashes */}
      {remaining.map((hid, i) => {
        const h = board.hexes[hid];
        if (!h) return null;
        return (
          <line
            key={`${castle.id}-trail-${i}`}
            x1={x}
            y1={y}
            x2={h.center.x}
            y2={h.center.y}
            stroke="#8a1f1f"
            strokeWidth={1.4}
            strokeDasharray="3 3"
            opacity={0.45}
          />
        );
      })}
      <g transform={`translate(${x}, ${y})`}>
        {/* Skull-on-pike silhouette */}
        <circle r={11} fill="#7a1c1c" stroke="#3a0a0a" strokeWidth={1.5} />
        <circle r={6} cy={-1} fill="#f5e8d8" />
        <ellipse cx={-2.2} cy={-1.4} rx={1.1} ry={1.4} fill="#1a1a1a" />
        <ellipse cx={2.2} cy={-1.4} rx={1.1} ry={1.4} fill="#1a1a1a" />
        <path
          d="M-2.2,2.3 L-1,1.6 L0,2.3 L1,1.6 L2.2,2.3"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth={0.7}
        />
        {/* Threat indicator below: barbarian strength */}
        <text
          y={20}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill="#7a1c1c"
          stroke="#fafafa"
          strokeWidth={2}
          paintOrder="stroke fill"
        >
          {castle.barbarianStrength}
        </text>
      </g>
    </g>
  );
}

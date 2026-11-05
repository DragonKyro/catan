import type { GameState } from '@/game/types';

const HATCH_ID = 'inactive-settlement-hatch';

// Settlements nobody owns (`game.inactiveSettlements`: the 5-player beginner
// set-up leaves the unused color's settlements on the board). Drawn as
// hatched grey settlements, so they read as blockers rather than a player's
// pieces or a placement hint.
export function InactiveSettlements({ game }: { game: GameState }) {
  const vertices = game.inactiveSettlements;
  if (!vertices || vertices.length === 0) return null;
  return (
    <g className="inactive-settlements" pointerEvents="none">
      <defs>
        <pattern
          id={HATCH_ID}
          width={3}
          height={3}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={3} height={3} fill="#7c776e" />
          <line x1={0} y1={0} x2={0} y2={3} stroke="#d8d2c6" strokeWidth={1.4} />
        </pattern>
      </defs>
      {vertices.map((vid) => {
        const p = game.board.vertices[vid]?.position;
        if (!p) return null;
        return (
          <g key={vid} transform={`translate(${p.x}, ${p.y})`}>
            <title>Inactive settlement (no player)</title>
            <path
              d="M-7,5 L-7,-2 L0,-7 L7,-2 L7,5 Z"
              fill={`url(#${HATCH_ID})`}
              stroke="#1a1a1a"
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </g>
  );
}

import type { GameState } from '@/game/types';

interface Props {
  game: GameState;
}

// Small fabric icon overlaid on each cloth-producing hex (Cloth for Catan).
// Distinguishes these from regular resource hexes — the production diversion
// (cloth instead of the underlying terrain's resource) is otherwise invisible.
export function ClothHexMarker({ game }: Props) {
  if (!game.clothHexes || game.clothHexes.length === 0) return null;
  return (
    <g className="cloth-hexes" pointerEvents="none">
      {game.clothHexes.map((hid) => {
        const hex = game.board.hexes[hid];
        if (!hex) return null;
        const { x, y } = hex.center;
        return (
          <g key={hid} transform={`translate(${x - 18}, ${y - 18})`}>
            <circle r={9} fill="#fefefe" stroke="#5a3a8a" strokeWidth={1.2} />
            {/* Spool of cloth: small rectangle with horizontal stripes */}
            <rect x={-4} y={-3} width={8} height={6} rx={1} fill="#9a6cd4" />
            <line x1={-4} y1={-1} x2={4} y2={-1} stroke="#6a3aa4" strokeWidth={0.6} />
            <line x1={-4} y1={1} x2={4} y2={1} stroke="#6a3aa4" strokeWidth={0.6} />
          </g>
        );
      })}
    </g>
  );
}

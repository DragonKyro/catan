import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  game: GameState;
}

// Cities & Knights — small pawn icon on the merchant's hex.
export function MerchantMarker({ game }: Props) {
  if (!game.merchant) return null;
  const hex = game.board.hexes[game.merchant.hexId];
  if (!hex) return null;
  const owner = game.players.find((p) => p.id === game.merchant!.ownerId);
  const color = playerColorVar(owner?.color ?? 'white');
  const { x, y } = hex.center;
  return (
    <g
      transform={`translate(${x + 18}, ${y - 18})`}
      pointerEvents="none"
      className="merchant-marker"
    >
      <circle r={6} fill="#f4e5b3" stroke="#1a1a1a" strokeWidth={0.8} />
      <text
        x={0}
        y={2.5}
        textAnchor="middle"
        fontSize={7}
        style={{ userSelect: 'none' }}
      >
        💰
      </text>
      <circle r={7} fill="none" stroke={color} strokeWidth={1.4} />
    </g>
  );
}

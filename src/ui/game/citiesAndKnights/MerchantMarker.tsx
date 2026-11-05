import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  game: GameState;
}

// Cities & Knights merchant (p.7): the grey merchant figure standing on its
// hex, beside the number disc, with a ring in the controlling player's
// colour around its base.
export function MerchantMarker({ game }: Props) {
  if (!game.merchant) return null;
  const hex = game.board.hexes[game.merchant.hexId];
  if (!hex) return null;
  const owner = game.players.find((p) => p.id === game.merchant!.ownerId);
  const { x, y } = hex.center;
  return (
    <g
      transform={`translate(${x + 22}, ${y - 10})`}
      pointerEvents="none"
      className="merchant-marker"
    >
      <title>{`Merchant — ${owner?.name ?? ''} (+1 VP, 2:1 on this hex's resource)`}</title>
      <MerchantGlyph rim={playerColorVar(owner?.color ?? 'white')} />
    </g>
  );
}

// Standing figure with a wide-brimmed hat, ~12 wide × 20 tall, feet at y=8.
export function MerchantGlyph({ rim }: { rim: string }) {
  return (
    <g>
      <ellipse cx={0} cy={8.2} rx={7.5} ry={2.6} fill={rim} stroke="#151515" strokeWidth={0.8} />
      {/* Robe */}
      <path
        d="M-5,8 C-5,2 -4,-2 -2.4,-3 L2.4,-3 C4,-2 5,2 5,8 Z"
        fill="#9a9a9e"
        stroke="#151515"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      {/* Purse */}
      <circle cx={2.4} cy={3.5} r={1.6} fill="#c79a3b" stroke="#151515" strokeWidth={0.6} />
      {/* Head */}
      <circle cx={0} cy={-5.2} r={2.6} fill="#b4b4b8" stroke="#151515" strokeWidth={0.9} />
      {/* Hat */}
      <path
        d="M-5.6,-7 L5.6,-7 L3,-8 L2.2,-11 L-2.2,-11 L-3,-8 Z"
        fill="#6e6e74"
        stroke="#151515"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
    </g>
  );
}

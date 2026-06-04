import type { GameState, TribeTokenType } from '@/game/types';
import { PLAYER_COLOR_HEX } from '@/ui/shared/playerColors';

interface Props {
  game: GameState;
}

const ICON: Record<TribeTokenType, string> = {
  devCard: '🃏',
  victoryPoint: '⭐',
  commercialHarbor: '⚓',
};

// Render a small badge on each tribe-token hex. Unclaimed tokens show a
// neutral parchment background with the token's icon. Claimed tokens swap
// the background for the claiming player's color so the board itself
// records who got what (the side-panel tracker doubles up the info).
export function TribeTokenMarker({ game }: Props) {
  if (!game.tribeTokens || game.tribeTokens.length === 0) return null;
  return (
    <g className="tribe-tokens" pointerEvents="none">
      {game.tribeTokens.map((token, i) => {
        const hex = game.board.hexes[token.hexId];
        if (!hex) return null;
        const { x, y } = hex.center;
        const claimer = token.claimedBy
          ? game.players.find((p) => p.id === token.claimedBy)
          : null;
        const fill = claimer
          ? PLAYER_COLOR_HEX[claimer.color]
          : '#f7f1d8';
        const textFill = claimer ? '#fefefe' : '#1a1a1a';
        return (
          <g
            key={`${token.hexId}-${i}`}
            transform={`translate(${x + 18}, ${y - 18})`}
          >
            <circle r={9} fill={fill} stroke="#1a1a1a" strokeWidth={1.2} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fill={textFill}
            >
              {ICON[token.type]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

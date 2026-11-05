import type { GameState, PlayerId } from '@/game/types';
import { playerKnightEdges } from '@/game/modules/traders/barbarianAttack/knights';
import { conqueredBuildingVertices, prisonersOf } from '@/game/modules/traders/barbarianAttack/state';
import {
  BARBARIAN_KNIGHTS_PER_PLAYER,
  BARBARIAN_PRISONERS_PER_VP,
} from '@/game/modules/traders/constants';

// Barbarian Attack status badges for one player (HandPanel / OpponentPanel):
// knights on the board, prisoners (2 = 1 VP) and conquered buildings.
export function BarbarianAttackBadges({
  game,
  playerId,
  className,
}: {
  game: GameState;
  playerId: PlayerId;
  className?: string;
}) {
  if (!game.barbarianAttack) return null;
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return null;
  const knights = playerKnightEdges(game, playerId).length;
  const prisoners = prisonersOf(game, playerId);
  const conquered = conqueredBuildingVertices(game);
  const lost = [...player.settlements, ...player.cities].filter((v) => conquered.has(v)).length;
  const vp = Math.floor(prisoners / BARBARIAN_PRISONERS_PER_VP);
  return (
    <>
      <span
        className={className}
        title={`Knights on the board: ${knights} of ${BARBARIAN_KNIGHTS_PER_PLAYER} (Knighthood / Swift Knight cards place them)`}
      >
        ⚔ {knights}/{BARBARIAN_KNIGHTS_PER_PLAYER}
      </span>
      {prisoners > 0 && (
        <span
          className={className}
          title={`Prisoners: ${prisoners} — every 2 are worth 1 VP (+${vp} VP)`}
        >
          ⛓ {prisoners}
        </span>
      )}
      {lost > 0 && (
        <span
          className={className}
          title={`${lost} conquered building${lost === 1 ? '' : 's'}: worth no VP and their ports can't be used until liberated`}
        >
          🏚 {lost}
        </span>
      )}
    </>
  );
}

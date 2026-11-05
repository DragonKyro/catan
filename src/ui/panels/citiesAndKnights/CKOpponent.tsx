import type { GameState, Player } from '@/game/types';
import { IMPROVEMENT_TRACKS } from '@/game/types';
import { totalCommodities } from '@/game/commodities';
import { TrackEmblem } from '@/ui/shared/ProgressCardFace';
import { CommodityIcon } from '@/ui/shared/CommodityIcon';
import { TRACK_LABEL } from '@/game/modules/citiesAndKnights/constants';
import { defenderStrengthByPlayer } from '@/game/modules/citiesAndKnights/barbarian';
import { MetropolisGlyph, METROPOLIS_COLOR } from '@/ui/game/citiesAndKnights/MetropolisMarker';
import { KnightGlyph } from '@/ui/game/citiesAndKnights/KnightPiece';
import { playerColorVar } from '@/ui/shared/playerColors';
import './CKPanels.css';

// Public Cities & Knights info for one player in the side panel: progress
// card backs by deck (the colour of a drawn card is public), commodities,
// knights (active strength / total), improvement levels, walls, metropolis,
// merchant and VP tokens / face-up VP cards.
export function CKOpponentStats({ game, player }: { game: GameState; player: Player }) {
  const hand = player.progressCards ?? { science: [], trade: [], politics: [] };
  const knights = Object.values(game.knights ?? {}).filter((k) => k.playerId === player.id);
  const total = knights.reduce((n, k) => n + k.strength, 0);
  const active = defenderStrengthByPlayer(game)[player.id] ?? 0;
  const mets = IMPROVEMENT_TRACKS.filter((t) => game.metropolises?.[t]?.playerId === player.id);
  const color = playerColorVar(player.color);
  return (
    <div className="ck-opp">
      <span className="ck-opp-item" title={`Progress cards: ${hand.science.length} science, ${hand.trade.length} trade, ${hand.politics.length} politics`}>
        <span className="ck-opp-backs">
          {IMPROVEMENT_TRACKS.flatMap((t) =>
            hand[t].map((_, i) => <span key={`${t}-${i}`} className={`ck-opp-back ck-opp-back-${t}`} />),
          )}
        </span>
        {hand.science.length + hand.trade.length + hand.politics.length === 0 ? '🃏 0' : ''}
      </span>
      <span className="ck-opp-item" title="Commodity cards">
        <CommodityIcon commodity="paper" size="1em" />
        {totalCommodities(player.commodities ?? { paper: 0, cloth: 0, coin: 0 })}
      </span>
      <span className="ck-opp-item" title={`Knights: active strength ${active} of ${total} (${knights.length} knights)`}>
        <svg width={13} height={13} viewBox="-8 -14 16 18" aria-hidden>
          <KnightGlyph color={color} strength={1} active />
        </svg>
        {active}/{total}
      </span>
      {IMPROVEMENT_TRACKS.map((t) => (
        <span key={t} className="ck-opp-item" title={`${TRACK_LABEL[t]} level`}>
          <TrackEmblem track={t} size="1em" />
          {player.improvements?.[t] ?? 0}
        </span>
      ))}
      {(player.cityWalls ?? 0) > 0 && (
        <span className="ck-opp-item" title={`City walls (holds ${7 + 2 * (player.cityWalls ?? 0)} on a 7)`}>
          🧱{player.cityWalls}
        </span>
      )}
      {mets.map((t) => (
        <span key={t} className="ck-opp-item" title={`${TRACK_LABEL[t]} metropolis (+2 VP)`}>
          <svg width={13} height={13} viewBox="-11 -16 22 26" aria-hidden>
            <MetropolisGlyph fill={METROPOLIS_COLOR[t]} rim={color} permanent={game.metropolises![t]!.permanent} />
          </svg>
        </span>
      ))}
      {game.merchant?.ownerId === player.id && (
        <span className="ck-opp-item" title="Merchant (+1 VP)">🧑‍💼</span>
      )}
      {(player.defenderTokens ?? 0) > 0 && (
        <span className="ck-opp-item" title="Defender of Catan VP tokens">🛡+{player.defenderTokens}</span>
      )}
      {(player.progressVpCards?.length ?? 0) > 0 && (
        <span className="ck-opp-item" title={`Face-up VP cards: ${player.progressVpCards!.join(', ')}`}>
          📜+{player.progressVpCards!.length}
        </span>
      )}
    </div>
  );
}

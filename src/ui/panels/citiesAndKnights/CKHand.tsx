import type { GameState, Player } from '@/game/types';
import { COMMODITIES, IMPROVEMENT_TRACKS } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { CommodityChip } from '@/ui/shared/CommodityChip';
import { ProgressCardFace, TrackEmblem } from '@/ui/shared/ProgressCardFace';
import { PROGRESS_CARD_DESCRIPTION } from '@/game/modules/citiesAndKnights/progress/catalogue';
import {
  IMPROVEMENT_NAMES,
  PROGRESS_CARD_HAND_LIMIT,
  TRACK_LABEL,
} from '@/game/modules/citiesAndKnights/constants';
import { defenderStrengthByPlayer } from '@/game/modules/citiesAndKnights/barbarian';
import { handLimitOnSeven } from '@/game/modules/citiesAndKnights/production';
import { progressHandSize } from '@/game/modules/citiesAndKnights/progress/hand';
import { MetropolisGlyph, METROPOLIS_COLOR } from '@/ui/game/citiesAndKnights/MetropolisMarker';
import { KnightGlyph } from '@/ui/game/citiesAndKnights/KnightPiece';
import { playerColorVar } from '@/ui/shared/playerColors';
import './CKPanels.css';

// Header badges for the viewed player under Cities & Knights.
export function CKHandFlags({ game, player }: { game: GameState; player: Player }) {
  const mets = IMPROVEMENT_TRACKS.filter((t) => game.metropolises?.[t]?.playerId === player.id);
  const knights = Object.values(game.knights ?? {}).filter((k) => k.playerId === player.id);
  const activeStrength = defenderStrengthByPlayer(game)[player.id] ?? 0;
  return (
    <>
      {knights.length > 0 && (
        <span
          className="hand-flag"
          title={`Knights: ${knights.length} on the board, active strength ${activeStrength} (defends against the barbarians)`}
        >
          <svg width={14} height={14} viewBox="-8 -14 16 18" aria-hidden>
            <KnightGlyph color={playerColorVar(player.color)} strength={1} active />
          </svg>
          {activeStrength}/{knights.reduce((n, k) => n + k.strength, 0)}
        </span>
      )}
      {(player.cityWalls ?? 0) > 0 && (
        <span className="hand-flag" title={`City walls: you may hold ${handLimitOnSeven(game, player.id)} cards on a 7`}>
          🧱 {player.cityWalls}
        </span>
      )}
      {mets.map((t) => (
        <span key={t} className="hand-flag" title={`${TRACK_LABEL[t]} metropolis (+2 VP)`}>
          <svg width={14} height={14} viewBox="-11 -16 22 26" aria-hidden>
            <MetropolisGlyph fill={METROPOLIS_COLOR[t]} rim={playerColorVar(player.color)} permanent={game.metropolises![t]!.permanent} />
          </svg>
        </span>
      ))}
      {game.merchant?.ownerId === player.id && (
        <span className="hand-flag" title="Merchant (+1 VP, 2:1 on its hex's resource)">
          🧑‍💼 +1
        </span>
      )}
      {(player.defenderTokens ?? 0) > 0 && (
        <span className="hand-flag" title={`Defender of Catan VP tokens (+${player.defenderTokens} VP)`}>
          🛡 +{player.defenderTokens}
        </span>
      )}
      {(player.progressVpCards?.length ?? 0) > 0 && (
        <span className="hand-flag" title={`Face-up VP cards: ${player.progressVpCards!.join(', ')}`}>
          📜 +{player.progressVpCards!.length}
        </span>
      )}
    </>
  );
}

// Commodities, improvement levels and the progress card hand. Cards are
// clickable on your own Action phase (they open the card dialog).
export function CKHandCards({ player, canPlay }: { player: Player; canPlay: boolean }) {
  const { openDialog } = useGameStore();
  const hand = player.progressCards ?? { science: [], trade: [], politics: [] };
  const count = progressHandSize(player);
  return (
    <div className="ck-hand">
      <div className="hand-commodities">
        {COMMODITIES.map((c) => {
          const n = player.commodities?.[c] ?? 0;
          return <CommodityChip key={c} commodity={c} count={n} dimmed={n === 0} />;
        })}
        <span className="ck-hand-levels">
          {IMPROVEMENT_TRACKS.map((t) => {
            const lv = player.improvements?.[t] ?? 0;
            return (
              <span
                key={t}
                className={`ck-hand-level ck-hand-level-${t}`}
                title={`${TRACK_LABEL[t]} level ${lv} — ${IMPROVEMENT_NAMES[t][lv]}`}
              >
                <TrackEmblem track={t} size="1em" /> {lv}
              </span>
            );
          })}
        </span>
      </div>
      <div className="ck-hand-cards">
        {IMPROVEMENT_TRACKS.flatMap((deck) =>
          hand[deck].map((card, i) => (
            <ProgressCardFace
              key={`${deck}-${card}-${i}`}
              card={card}
              deck={deck}
              size="sm"
              title={PROGRESS_CARD_DESCRIPTION[card]}
              onClick={canPlay ? () => openDialog('progressCards') : undefined}
            />
          )),
        )}
        {(player.progressVpCards ?? []).map((card, i) => (
          <ProgressCardFace
            key={`vp-${card}-${i}`}
            card={card}
            deck={card === 'printing' ? 'science' : 'politics'}
            size="sm"
            vp
            title={PROGRESS_CARD_DESCRIPTION[card]}
          />
        ))}
        {count === 0 && (player.progressVpCards?.length ?? 0) === 0 && (
          <span className="hand-empty">no progress cards</span>
        )}
        {count > PROGRESS_CARD_HAND_LIMIT && (
          <span className="ck-hand-over" title="Play or discard down to 4 by the end of your turn">
            {count}/{PROGRESS_CARD_HAND_LIMIT}!
          </span>
        )}
      </div>
    </div>
  );
}

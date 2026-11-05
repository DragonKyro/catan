import { useGameStore } from '@/store/gameStore';
import type { GameState, Player, PlayerId, TbDevCard } from '@/game/types';
import { wagonLevelInfo } from '@/game/modules/traders/tradersBarbarians/state';
import {
  TB_DECK_COUNTS,
  TB_MAX_WAGON_LEVEL,
  TB_WAGON_UPGRADE_COSTS,
} from '@/game/modules/traders/tradersBarbarians/constants';
import { destinationOf } from '@/game/modules/traders/tradersBarbarians/state';
import {
  CommodityTokenSvg,
  GOOD_LABEL,
  LOCATION_LABEL,
  PlayerWagonSvg,
} from './TradersBarbariansArt';
import { costText, driveRange, upgradeSummary } from './TradersBarbariansActions';

// "Traders & Barbarians" scenario pieces in the player panels: the wagon
// board (level, MP, drive-off range, delivery gold, next upgrade, the token
// carried and the tokens delivered), Swift Journey cards in hand, and the
// compact badges in the opponents' rows.

export function TbWagonStrip({ game, player }: { game: GameState; player: Player }) {
  const tb = game.tradersBarbarians;
  if (!tb) return null;
  const wagon = tb.wagons[player.id];
  const level = wagon?.level ?? 1;
  const info = wagonLevelInfo(level);
  const cost = TB_WAGON_UPGRADE_COSTS[level];
  const cargo = wagon?.cargo ?? null;
  const delivered = wagon?.delivered ?? 0;
  return (
    <span
      className="hand-traders-group tb-wagon-board"
      title={`Wagon board, level ${level} of ${TB_MAX_WAGON_LEVEL}: ${info.mp} movement points, drive off barbarians on ${driveRange(info.driveOffMin)}, a delivery pays ${info.deliveryGold} gold.${
        cost ? ` Next upgrade (${costText(cost)}): ${upgradeSummary(level)}.` : ' Fully upgraded: +1 VP.'
      }`}
    >
      <PlayerWagonSvg color={player.color} size={22} />
      <span className="hand-traders-count">L{level}</span>
      <span className="hand-traders-note">
        {info.mp} MP · 🎲 {driveRange(info.driveOffMin)} · {info.deliveryGold}🪙/delivery
        {level >= TB_MAX_WAGON_LEVEL ? ' · ★ +1 VP' : ''}
      </span>
      <span
        className="hand-traders-badge"
        title={
          cargo
            ? `Carrying ${GOOD_LABEL[cargo.good].toLowerCase()} — deliver it at the ${LOCATION_LABEL[destinationOf(cargo.good)].toLowerCase()}`
            : 'Empty wagon: enter a plaza to pick up a token'
        }
      >
        {cargo ? (
          <>
            <CommodityTokenSvg good={cargo.good} size={16} /> → {LOCATION_LABEL[destinationOf(cargo.good)]}
          </>
        ) : (
          'empty'
        )}
      </span>
      <span className="hand-traders-badge good" title={`Tokens delivered: ${delivered} (1 VP each)`}>
        📦 {delivered}
      </span>
    </span>
  );
}

// Swift Journey cards (they aren't base development cards, so HandPanel
// draws them here): playable during your End of Turn phase.
export function SwiftJourneyChips({ game, player, isMyTurn }: { game: GameState; player: Player; isMyTurn: boolean }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const held = game.tradersBarbarians?.swiftJourney[player.id];
  if (!held || held.unplayed + held.boughtThisTurn === 0) return null;
  const turn = game.tradersBarbarians?.wagonTurn;
  const playable =
    !player.isAI &&
    isMyTurn &&
    game.phase === 'wagonMoves' &&
    !game.hasPlayedDevCardThisTurn &&
    turn?.moveAction === 1 &&
    held.unplayed > 0;
  return (
    <>
      {held.unplayed > 0 && (
        <button
          type="button"
          className={`dchip${playable ? ' dchip-clickable' : ' dchip-disabled'}`}
          disabled={!playable}
          onClick={playable ? () => dispatch({ type: 'playSwiftJourney', playerId: player.id }) : undefined}
          title={
            playable
              ? 'Play Swift Journey: end this wagon move and take another with full MP'
              : 'Swift Journey: after a wagon move this turn, move again (play it in your End of Turn phase)'
          }
        >
          <span className="dchip-icon" aria-hidden>⚡</span>
          <span className="dchip-label">Swift Journey</span>
          {held.unplayed > 1 && <span className="dchip-count">×{held.unplayed}</span>}
        </button>
      )}
      {Array.from({ length: held.boughtThisTurn }, (_, i) => (
        <span key={`sj-${i}`} className="dchip dchip-disabled" title="Just bought — playable next turn">
          <span className="dchip-icon" aria-hidden>⚡</span>
          <span className="dchip-label">Swift Journey</span>
        </span>
      ))}
    </>
  );
}

// OpponentPanel row: wagon level, cargo, deliveries.
export function TradersBarbariansBadges({ game, playerId }: { game: GameState; playerId: PlayerId }) {
  const tb = game.tradersBarbarians;
  const p = game.players.find((pl) => pl.id === playerId);
  if (!tb || !p) return null;
  const wagon = tb.wagons[playerId];
  if (!wagon) return null;
  const info = wagonLevelInfo(wagon.level);
  return (
    <>
      <span
        className="opp-icon"
        title={`Wagon level ${wagon.level}: ${info.mp} MP, drive off on ${driveRange(info.driveOffMin)}, ${info.deliveryGold} gold per delivery`}
      >
        <PlayerWagonSvg color={p.color} size={16} /> L{wagon.level}
      </span>
      {wagon.cargo && (
        <span
          className="opp-icon"
          title={`Carrying ${GOOD_LABEL[wagon.cargo.good].toLowerCase()} → ${LOCATION_LABEL[destinationOf(wagon.cargo.good)].toLowerCase()}`}
        >
          <CommodityTokenSvg good={wagon.cargo.good} size={14} />
        </span>
      )}
      {wagon.delivered > 0 && (
        <span title={`Tokens delivered (1 VP each)`}>📦 {wagon.delivered}</span>
      )}
    </>
  );
}

// The scenario's 25 development cards for the dev-card cheat sheet. Bought
// cards are hidden, so only played Knights / Swift Journeys come off the
// face-down count (the same public-information rule as the base list).
const TB_CARDS: Array<{ type: TbDevCard; icon: string; label: string; effect: string }> = [
  { type: 'knight', icon: '⚔️', label: 'Knight', effect: 'Move 1 barbarian to an edge without one; on a road, rob its owner of 1 card. Counts for Largest Army.' },
  { type: 'roadBuilding', icon: '🛣️', label: 'Road Building', effect: 'Build 2 roads at no cost.' },
  { type: 'swiftJourney', icon: '⚡', label: 'Swift Journey', effect: 'After a wagon move this turn, move your wagon again (full MP).' },
  { type: 'victoryPoint', icon: '🏆', label: 'Victory Point', effect: 'Stonecutting / Glassmaking / Toolmaking: 1 VP, shown when it wins you the game.' },
];

export function TbDevCardList({ game }: { game: GameState }) {
  const tb = game.tradersBarbarians;
  if (!tb) return null;
  const total = Object.values(TB_DECK_COUNTS).reduce((a, b) => a + b, 0);
  const knightsPlayed = game.players.reduce((s, p) => s + p.devCards.playedKnights, 0);
  return (
    <>
      <div className="cost-cheatsheet-title">
        Dev cards{' '}
        <span className="dev-cheatsheet-deck">
          ({tb.deck.length}/{total} left in deck)
        </span>
      </div>
      <ul className="cost-cheatsheet-list">
        {TB_CARDS.map(({ type, icon, label, effect }) => {
          const n = type === 'knight' ? Math.max(0, TB_DECK_COUNTS.knight - knightsPlayed) : TB_DECK_COUNTS[type];
          return (
            <li key={type} className="cost-cheatsheet-row dev-cheatsheet-row">
              <span className="cost-cheatsheet-build dev-cheatsheet-card">
                <span aria-hidden>{icon}</span> {label}
              </span>
              <span className="dev-cheatsheet-count" title={`${n} of ${TB_DECK_COUNTS[type]} not yet played (deck + hands)`}>
                {n}/{TB_DECK_COUNTS[type]}
              </span>
              <span className="dev-cheatsheet-effect">{effect}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

import type { GameState, Player } from '@/game/types';
import { FISH_TOKEN_CAP, MAX_GOLD_SPENDS_PER_TURN } from '@/game/modules/traders/constants';
import { fishTotal } from '@/game/modules/traders/actions/spendFish';
import {
  CoinIcon,
  FishTokenIcon,
  MoneyBagIcon,
  OldBootIcon,
} from '@/ui/game/traders/TradersIcons';
import { TbWagonStrip } from '@/ui/game/traders/TradersBarbariansHand';
import './TradersHandStrip.css';

interface Props {
  game: GameState;
  player: Player;
  // Is this the acting player's own turn (for the per-turn gold count)?
  ownTurn: boolean;
}

// HandPanel row for Traders & Barbarians: coins with the Wealthiest / Poor
// tile, and the fish tokens + old boot. Fish are secret, so this only ever
// shows the device's own hand.
export function TradersHandStrip({ game, player, ownTurn }: Props) {
  const coins = game.coinsInPlay || game.wealthTiles !== undefined;
  const fishing = game.fishingGrounds !== undefined || game.lakeHexId !== undefined;
  if (!coins && !fishing) return null;
  const gold = player.gold ?? 0;
  const wealthiest = game.wealthTiles?.wealthiest === player.id;
  const poor = game.wealthTiles?.poor.includes(player.id) ?? false;
  const spendsLeft = MAX_GOLD_SPENDS_PER_TURN - (ownTurn ? game.goldSpendsThisTurn ?? 0 : 0);
  const tokens = player.fishTokens ?? [];
  const byType = { three: 0, two: 0, one: 0 };
  for (const t of tokens) byType[t]++;
  const boot = game.oldBootHolder === player.id;
  return (
    <div className="hand-traders">
      {coins && (
        <span
          className="hand-traders-group"
          title={`Gold: ${gold}. Spend 2 gold for any resource card (${spendsLeft} of ${MAX_GOLD_SPENDS_PER_TURN} left this turn); buy 1 gold with cards at your bank rate. ${
            game.explorersPirates
              ? "Coins aren't cards: no discard — but a pirate takes 1 gold from a player with no cards, and tributes are paid in gold."
              : "Coins aren't cards: no discard, no theft."
          }`}
        >
          <CoinIcon size={18} />
          <span className="hand-traders-count">{gold}</span>
          <span className="hand-traders-note">gold</span>
          {wealthiest && (
            <span className="hand-traders-badge good" title="Wealthiest Catanian: the most gold (+1 VP)">
              <MoneyBagIcon size={16} /> +1
            </span>
          )}
          {poor && (
            <span className="hand-traders-badge bad" title="Poor Catanian: tied for the least gold (-2 VP)">
              <MoneyBagIcon size={16} poor /> −2
            </span>
          )}
        </span>
      )}
      {fishing && (
        <span
          className="hand-traders-group"
          title={`Fish tokens: ${tokens.length} of ${FISH_TOKEN_CAP} (old boot not counted), ${fishTotal(tokens)} fish. Not cards: no discard, no theft, no trading.`}
        >
          {(['three', 'two', 'one'] as const).flatMap((t) =>
            Array.from({ length: byType[t] }, (_, i) => (
              <FishTokenIcon key={`${t}${i}`} size={20} fish={t === 'one' ? 1 : t === 'two' ? 2 : 3} />
            )),
          )}
          <span className="hand-traders-count">{fishTotal(tokens)}</span>
          <span className="hand-traders-note">
            fish ({tokens.length}/{FISH_TOKEN_CAP})
          </span>
          {boot && (
            <span className="hand-traders-badge bad" title="Old boot: you need 1 more VP to win. Pass it on your turn to a player with at least your VP.">
              <OldBootIcon size={16} /> +1 VP to win
            </span>
          )}
        </span>
      )}
      {/* T&B scenario: the wagon board. */}
      <TbWagonStrip game={game} player={player} />
    </div>
  );
}

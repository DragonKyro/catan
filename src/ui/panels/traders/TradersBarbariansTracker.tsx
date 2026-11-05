import type { CommodityGood, GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import { destinationOf, wagonLevelInfo } from '@/game/modules/traders/tradersBarbarians/state';
import { TB_MAX_WAGON_LEVEL } from '@/game/modules/traders/tradersBarbarians/constants';
import { CoinIcon } from '@/ui/game/traders/TradersIcons';
import {
  CommodityTokenSvg,
  GOOD_LABEL,
  LOCATION_LABEL,
  LocationGlyphSvg,
  PlayerWagonSvg,
} from '@/ui/game/traders/TradersBarbariansArt';
import { tbEventLine } from '@/store/tradersBarbariansLog';

// Scenario-tab block for the "Traders & Barbarians" scenario: each player's
// deliveries (1 VP each), wagon level, cargo and gold; each location's
// wants and what is left in its stack (the order stays secret, only the
// mix is known — drawn tokens are face up); the latest wagon events.
export function TradersBarbariansTracker({ game }: { game: GameState }) {
  const tb = game.tradersBarbarians;
  if (!tb) return null;
  const last = tb.lastEvents?.events
    .map((e) => tbEventLine(game, e))
    .filter((l): l is NonNullable<typeof l> => l !== null);
  return (
    <div className="scenario-panel-block">
      <div className="scenario-panel-block-head">
        <span>Traders & Barbarians · {game.settings.victoryPointsToWin} VP wins</span>
        <span className="scenario-panel-block-sum" title="Development cards left in the scenario's deck">
          🃏 {tb.deck.length} left
        </span>
      </div>
      <ul className="scenario-panel-chips">
        {game.playerOrder.map((pid) => {
          const p = game.players.find((pl) => pl.id === pid);
          const w = tb.wagons[pid];
          if (!p) return null;
          const level = w?.level ?? 1;
          const info = wagonLevelInfo(level);
          return (
            <li key={pid} className="scenario-panel-chip is-claimed">
              <span className="scenario-panel-chip-vp" title={`Tokens delivered: ${w?.delivered ?? 0} (1 VP each)`}>
                📦 {w?.delivered ?? 0}
              </span>
              <span className="scenario-panel-chip-swatch" style={{ background: playerColorVar(p.color) }} aria-hidden />
              <span className="scenario-panel-chip-name">{p.name}</span>
              <span
                className="scenario-panel-chip-type"
                title={`Wagon level ${level}: ${info.mp} MP, ${info.deliveryGold} gold per delivery${level >= TB_MAX_WAGON_LEVEL ? ', +1 VP' : ''}`}
              >
                <PlayerWagonSvg color={p.color} size={15} /> L{level}
                {level >= TB_MAX_WAGON_LEVEL ? ' ★' : ''}
              </span>
              <span
                className="scenario-panel-chip-type"
                title={
                  w?.cargo
                    ? `Carrying ${GOOD_LABEL[w.cargo.good].toLowerCase()} for the ${LOCATION_LABEL[destinationOf(w.cargo.good)].toLowerCase()}`
                    : 'Empty wagon'
                }
              >
                {w?.cargo ? (
                  <>
                    <CommodityTokenSvg good={w.cargo.good} size={14} /> → {LOCATION_LABEL[destinationOf(w.cargo.good)]}
                  </>
                ) : (
                  '—'
                )}
              </span>
              <span className="scenario-panel-chip-type" title="Gold">
                <CoinIcon size={13} /> {p.gold ?? 0}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="scenario-panel-chips">
        {tb.locations.map((loc) => {
          const mix: Partial<Record<CommodityGood, number>> = {};
          for (const g of loc.stack) mix[g] = (mix[g] ?? 0) + 1;
          return (
            <li key={loc.id} className="scenario-panel-chip">
              <LocationGlyphSvg location={loc.id} size={16} />
              <span className="scenario-panel-chip-name">{LOCATION_LABEL[loc.id]}</span>
              <span className="scenario-panel-chip-type" title={`Buys ${loc.needs.map((g) => GOOD_LABEL[g].toLowerCase()).join(' and ')}`}>
                buys {loc.needs.map((g) => <CommodityTokenSvg key={g} good={g} size={14} />)}
              </span>
              <span
                className="scenario-panel-chip-type"
                title={`Stack: ${loc.stack.length} face-down tokens left (${Object.entries(mix)
                  .map(([g, n]) => `${n} ${g}`)
                  .join(', ') || 'empty'})`}
              >
                stack {loc.stack.length}:{' '}
                {(Object.entries(mix) as Array<[CommodityGood, number]>).map(([g, n]) => (
                  <span key={g} style={{ whiteSpace: 'nowrap' }}>
                    <CommodityTokenSvg good={g} size={13} />
                    {n}{' '}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="scenario-panel-note">
        End of your turn: your wagon moves. Each edge costs 2 MP without a road, 1 on your road, 1 + 1 gold
        (to its owner) on a rival’s road, +2 with a barbarian; 1 wheat = +2 MP. Entering a plaza ends the
        move: deliver a token it buys (1 VP + gold), then pick up the next. 2s and 12s are re-rolled.
      </div>
      {last && last.length > 0 && (
        <div className="scenario-panel-note" style={{ fontStyle: 'normal' }}>
          <strong>Latest:</strong> {last.map((l) => `${l.player ? game.players.find((p) => p.id === l.player)?.name ?? '' : ''} ${l.text}`).join(' · ')}
        </div>
      )}
    </div>
  );
}

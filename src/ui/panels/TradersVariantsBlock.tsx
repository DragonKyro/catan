import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import { portBuildingsVp } from '@/game/modules/traders/scoring/strongestPorts';
import { EVENT_CARD_INFO } from '@/game/modules/traders/variants/eventCards/deck';

// Scenario tab: the Traders & Barbarians variants in play (any rule set) —
// Friendly Robber reminder, the Strongest Ports tile and everyone's harbor
// VPs, and the Catan Event Cards deck.
export function hasTradersVariantBlock(game: GameState): boolean {
  const v = game.settings.tradersVariants;
  return !!(v?.friendlyRobber || game.strongestPorts || game.eventCards);
}

export function TradersVariantsBlock({ game }: { game: GameState }) {
  const v = game.settings.tradersVariants;
  const ports = game.strongestPorts;
  const ev = game.eventCards;
  return (
    <>
      {ports && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Strongest Ports</span>
            <span className="scenario-panel-block-sum">+2 VP · {game.settings.victoryPointsToWin} VP wins</span>
          </div>
          <ul className="scenario-panel-chips">
            {game.players.map((p) => (
              <li key={p.id} className={`scenario-panel-chip${ports.holder === p.id ? ' is-claimed' : ''}`}>
                <span className="scenario-panel-chip-vp">{ports.holder === p.id ? '⚓' : portBuildingsVp(game, p.id)}</span>
                <span className="scenario-panel-chip-swatch" style={{ background: playerColorVar(p.color) }} aria-hidden />
                <span className="scenario-panel-chip-name">
                  {p.name} — {portBuildingsVp(game, p.id)} VP on harbors
                </span>
              </li>
            ))}
          </ul>
          <div className="scenario-panel-note">
            The first player with 3 VPs in buildings on harbors (settlement 1, city 2) takes the
            tile; someone with more takes it over.
          </div>
        </div>
      )}
      {ev && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Event cards</span>
            <span className="scenario-panel-block-sum">{ev.deck.length} in the deck</span>
          </div>
          <div className="scenario-panel-note">
            {ev.current
              ? `${EVENT_CARD_INFO[ev.current.kind].icon} ${EVENT_CARD_INFO[ev.current.kind].name} (${ev.current.number}): ${EVENT_CARD_INFO[ev.current.kind].text}`
              : 'Each turn flips an event card instead of rolling the dice.'}
          </div>
          {(game.damagedRoads?.length ?? 0) > 0 && (
            <div className="scenario-panel-note">
              Damaged roads:{' '}
              {game.players
                .map((p) => [p, p.roads.filter((e) => game.damagedRoads!.includes(e)).length] as const)
                .filter(([, n]) => n > 0)
                .map(([p, n]) => `${p.name} ${n}`)
                .join(' · ')}{' '}
              — repair (1 brick + 1 wood) before building roads.
            </div>
          )}
        </div>
      )}
      {v?.friendlyRobber && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Friendly Robber</span>
          </div>
          <div className="scenario-panel-note">
            The robber can't go to a hex with a building of a player who has only 2 VPs, nor rob
            them.
          </div>
        </div>
      )}
    </>
  );
}

import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import {
  FISH_COST_BUILD_ROAD,
  FISH_COST_BUY_DEV_CARD,
  FISH_COST_REMOVE_ROBBER,
  FISH_COST_STEAL,
  FISH_COST_TAKE_FROM_BANK,
  FISH_TOKEN_CAP,
  MAX_BRIDGES,
} from '@/game/modules/traders/constants';
import { CoinIcon, FishTokenIcon, MoneyBagIcon, OldBootIcon } from '@/ui/game/traders/TradersIcons';

// Scenario-panel blocks for Rivers of Catan and Fishing on Catan.

export function RiversTracker({ game }: { game: GameState }) {
  return (
    <div className="scenario-panel-block">
      <div className="scenario-panel-block-head">
        <span>Rivers of Catan</span>
        <span className="scenario-panel-block-sum">{game.settings.victoryPointsToWin} VP to win</span>
      </div>
      <ul className="scenario-panel-chips">
        {game.players.map((p) => {
          const wealthiest = game.wealthTiles?.wealthiest === p.id;
          const poor = game.wealthTiles?.poor.includes(p.id);
          return (
            <li key={p.id} className="scenario-panel-chip is-claimed">
              <span className="scenario-panel-chip-vp" title="Gold">
                <CoinIcon size={13} /> {p.gold ?? 0}
              </span>
              <span
                className="scenario-panel-chip-swatch"
                style={{ background: playerColorVar(p.color) }}
                aria-hidden
              />
              <span className="scenario-panel-chip-name">
                {p.name}
                {wealthiest && (
                  <span title="Wealthiest Catanian (+1 VP)">
                    {' '}
                    <MoneyBagIcon size={13} /> +1
                  </span>
                )}
                {poor && (
                  <span title="Poor Catanian (-2 VP)">
                    {' '}
                    <MoneyBagIcon size={13} poor /> −2
                  </span>
                )}
              </span>
              <span className="scenario-panel-chip-type" title="Bridges built">
                🌉 {p.bridges?.length ?? 0}/{MAX_BRIDGES}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="scenario-panel-note">
        Gold: 1 per road on a river-tile edge, 1 per settlement on a river-tile corner, 3 per
        bridge. The richest player alone is Wealthiest (+1 VP); everyone tied for the least gold is
        Poor (−2 VP). Spend 2 gold for any card (twice a turn) or buy gold at your bank rate.
      </div>
    </div>
  );
}

export function FishingTracker({ game }: { game: GameState }) {
  const lake = game.lakeHexId;
  const robber =
    game.robberActive === false
      ? 'beside the board'
      : game.board.robberHex === lake
        ? 'on the lake'
        : 'on the island';
  return (
    <div className="scenario-panel-block">
      <div className="scenario-panel-block-head">
        <span>Fishing on Catan</span>
        <span className="scenario-panel-block-sum">
          {game.settings.victoryPointsToWin} VP ({game.settings.victoryPointsToWin + 1} with the boot)
        </span>
      </div>
      <ul className="scenario-panel-chips">
        {game.players.map((p) => {
          const count = p.fishTokens?.length ?? 0;
          const boot = game.oldBootHolder === p.id;
          return (
            <li key={p.id} className="scenario-panel-chip is-claimed">
              <span className="scenario-panel-chip-vp" title="Fish tokens held (values are secret)">
                <FishTokenIcon size={13} fish={1} /> {count}/{FISH_TOKEN_CAP}
              </span>
              <span
                className="scenario-panel-chip-swatch"
                style={{ background: playerColorVar(p.color) }}
                aria-hidden
              />
              <span className="scenario-panel-chip-name">
                {p.name}
                {boot && (
                  <span title="Old boot: needs 1 more VP to win">
                    {' '}
                    <OldBootIcon size={13} /> +1 VP to win
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="scenario-panel-note">
        Supply {game.fishTokenPool?.length ?? 0} · discards {game.fishTokenDiscard?.length ?? 0}
        {game.oldBootHolder == null ? ' · the old boot is still in the supply' : ''}. Robber {robber}.
        <br />
        Spend fish on your turn: {FISH_COST_REMOVE_ROBBER} remove the robber · {FISH_COST_STEAL} steal a
        card · {FISH_COST_TAKE_FROM_BANK} take a card · {FISH_COST_BUILD_ROAD} free road ·{' '}
        {FISH_COST_BUY_DEV_CARD} free development card. Hold at most {FISH_TOKEN_CAP} tokens.
      </div>
    </div>
  );
}

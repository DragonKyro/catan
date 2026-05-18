import { useGameStore } from '@/store/gameStore';
import { getScenario } from '@/game/modules/seafarers/board/scenarios';
import { SEAFARERS_EXPANSION_ID } from '@/game/modules/seafarers/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import { WONDERS } from '@/game/modules/seafarers/wonders/catalogue';
import { playerColorVar } from '@/ui/shared/playerColors';
import type { TribeTokenType } from '@/game/types';
import './ScenarioPanel.css';

const TRIBE_TOKEN_LABEL: Record<TribeTokenType, string> = {
  devCard: 'Dev card',
  victoryPoint: '+1 VP',
  commercialHarbor: 'Commercial harbor (2:1 any)',
};

const TRIBE_TOKEN_ICON: Record<TribeTokenType, string> = {
  devCard: '🃏',
  victoryPoint: '⭐',
  commercialHarbor: '⚓',
};

// Scenario-specific progress tracker. Visible only when an active Seafarers
// scenario has something worth tracking (currently: island chips and/or
// tribe tokens).
//
// Returns whether ANY scenario tracker is present. The SidePanelTabs uses
// this to decide whether to render the Scenario tab at all.
export function hasScenarioTracker(state: ReturnType<typeof useGameStore.getState>['game']): boolean {
  if (!state) return false;
  const hasSeafarers = state.settings.expansions.includes(SEAFARERS_EXPANSION_ID);
  const hasTraders = state.settings.expansions.includes(TRADERS_EXPANSION_ID);
  if (hasSeafarers) {
    if (state.islandChips && state.islandChips.length > 0) return true;
    if (state.tribeTokens && state.tribeTokens.length > 0) return true;
    if (fogTotal(state) > 0) return true;
    if (state.wonders && state.wonders.length > 0) return true;
    if (state.pirateFleet) return true;
    if (state.clothHexes && state.clothHexes.length > 0) return true;
  }
  if (hasTraders) {
    if (state.wealthTiles) return true;
    if (state.strongestPorts) return true;
  }
  return false;
}

// Total number of fog hexes this scenario started with. We derive it from
// the scenario definition (because state.unrevealedFogHexes shrinks as
// the game proceeds — we need the original count to show "X/N revealed").
function fogTotal(
  state: ReturnType<typeof useGameStore.getState>['game'],
): number {
  if (!state) return 0;
  if (!state.settings.scenarioId) return 0;
  const sc = getScenario(state.settings.scenarioId);
  const useLarge = state.players.length >= 5;
  const defs = useLarge && sc.fogHexes5_6 ? sc.fogHexes5_6 : sc.fogHexes;
  return defs?.length ?? 0;
}

export function ScenarioPanel() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const hasSeafarers = game.settings.expansions.includes(SEAFARERS_EXPANSION_ID);
  const hasTraders = game.settings.expansions.includes(TRADERS_EXPANSION_ID);
  if (!hasSeafarers && !hasTraders) return null;
  // T&B path: own simpler tracker (no chip / fog / wonder machinery).
  if (hasTraders) {
    return <TradersScenarioPanel />;
  }
  const scenario = game.settings.scenarioId
    ? getScenario(game.settings.scenarioId)
    : null;

  const chips = game.islandChips ?? [];
  const totalChipVp = chips.reduce((s, c) => s + c.vp, 0);
  const claimedChipVp = chips
    .filter((c) => c.firstSettler !== null)
    .reduce((s, c) => s + c.vp, 0);

  return (
    <section className="scenario-panel">
      {scenario && (
        <header className="scenario-panel-header">
          <span className="scenario-panel-title">{scenario.name}</span>
          {scenario.desertIsBoundary && (
            <span
              className="scenario-panel-note"
              title="Far-side hexes (across the desert) count as an outer island for chip VP"
            >
              desert divides the island
            </span>
          )}
        </header>
      )}

      {chips.length > 0 && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Outer-island chips</span>
            <span className="scenario-panel-block-sum">
              {claimedChipVp}/{totalChipVp} VP claimed
            </span>
          </div>
          <ul className="scenario-panel-chips">
            {chips.map((chip) => {
              const claimer = chip.firstSettler
                ? game.players.find((p) => p.id === chip.firstSettler)
                : null;
              return (
                <li
                  key={chip.islandId}
                  className={`scenario-panel-chip${claimer ? ' is-claimed' : ''}`}
                >
                  <span className="scenario-panel-chip-vp">+{chip.vp}</span>
                  {claimer ? (
                    <>
                      <span
                        className="scenario-panel-chip-swatch"
                        style={{ background: playerColorVar(claimer.color) }}
                        aria-hidden
                      />
                      <span className="scenario-panel-chip-name">{claimer.name}</span>
                    </>
                  ) : (
                    <span className="scenario-panel-chip-name unclaimed">unclaimed</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(() => {
        const total = fogTotal(game);
        if (total === 0) return null;
        const unrevealed = game.unrevealedFogHexes?.length ?? 0;
        const revealed = total - unrevealed;
        return (
          <div className="scenario-panel-block">
            <div className="scenario-panel-block-head">
              <span>Fog</span>
              <span className="scenario-panel-block-sum">
                {revealed}/{total} revealed
              </span>
            </div>
            <div className="scenario-panel-note">
              Build a settlement, road, or ship adjacent to a fog hex to reveal it
              and earn the resource shown (gold gives a free pick).
            </div>
          </div>
        );
      })()}

      {game.clothHexes && game.clothHexes.length > 0 && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Cloth</span>
            <span className="scenario-panel-block-sum">
              2 cloth = 1 VP
            </span>
          </div>
          <ul className="scenario-panel-chips">
            {game.players.map((p) => {
              const cloth = p.cloth ?? 0;
              if (cloth === 0) return null;
              return (
                <li key={p.id} className="scenario-panel-chip is-claimed">
                  <span className="scenario-panel-chip-vp">{cloth}</span>
                  <span
                    className="scenario-panel-chip-swatch"
                    style={{ background: playerColorVar(p.color) }}
                    aria-hidden
                  />
                  <span className="scenario-panel-chip-name">
                    {p.name} ({Math.floor(cloth / 2)} VP)
                  </span>
                </li>
              );
            })}
            {game.players.every((p) => !(p.cloth && p.cloth > 0)) && (
              <li className="scenario-panel-chip">
                <span className="scenario-panel-chip-name unclaimed">
                  No cloth produced yet
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {game.pirateFleet && (() => {
        const fleet = game.pirateFleet;
        const defeater = fleet.defeatedBy
          ? game.players.find((p) => p.id === fleet.defeatedBy)
          : null;
        return (
          <div className="scenario-panel-block">
            <div className="scenario-panel-block-head">
              <span>Pirate fleet</span>
              <span className="scenario-panel-block-sum">
                {defeater ? 'defeated' : `${fleet.strength}/${fleet.maxStrength}`}
              </span>
            </div>
            {defeater ? (
              <div className="scenario-panel-chip is-claimed">
                <span className="scenario-panel-chip-vp">+2</span>
                <span
                  className="scenario-panel-chip-swatch"
                  style={{ background: playerColorVar(defeater.color) }}
                  aria-hidden
                />
                <span className="scenario-panel-chip-name">{defeater.name} (final blow)</span>
              </div>
            ) : (
              <div className="scenario-panel-note">
                Sail a ship adjacent to the fleet and attack to weaken it.
                The player who lands the killing blow earns <strong>+2 VP</strong>.
              </div>
            )}
          </div>
        );
      })()}

      {game.wonders && game.wonders.length > 0 && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Wonders</span>
            <span className="scenario-panel-block-sum">
              {game.wonders.filter((w) => w.level > 0).length}/{game.wonders.length} started
            </span>
          </div>
          <ul className="scenario-panel-chips">
            {game.wonders.map((w) => {
              const def = WONDERS.find((d) => d.id === w.id);
              if (!def) return null;
              const claimer = w.builtBy
                ? game.players.find((p) => p.id === w.builtBy)
                : null;
              return (
                <li
                  key={w.id}
                  className={`scenario-panel-chip${claimer ? ' is-claimed' : ''}`}
                  title={`${def.prereqLabel} · level ${w.level}/${def.maxLevel}`}
                >
                  <span className="scenario-panel-chip-vp">
                    {w.level}/{def.maxLevel}
                  </span>
                  <span className="scenario-panel-chip-type">{def.name}</span>
                  {claimer ? (
                    <>
                      <span
                        className="scenario-panel-chip-swatch"
                        style={{ background: playerColorVar(claimer.color) }}
                        aria-hidden
                      />
                      <span className="scenario-panel-chip-name">{claimer.name}</span>
                    </>
                  ) : (
                    <span className="scenario-panel-chip-name unclaimed">open</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {game.tribeTokens && game.tribeTokens.length > 0 && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Friendly tribe tokens</span>
            <span className="scenario-panel-block-sum">
              {game.tribeTokens.filter((t) => t.claimedBy !== null).length}/
              {game.tribeTokens.length} claimed
            </span>
          </div>
          <ul className="scenario-panel-chips">
            {game.tribeTokens.map((token, i) => {
              const claimer = token.claimedBy
                ? game.players.find((p) => p.id === token.claimedBy)
                : null;
              return (
                <li
                  key={`${token.hexId}-${i}`}
                  className={`scenario-panel-chip${claimer ? ' is-claimed' : ''}`}
                  title={TRIBE_TOKEN_LABEL[token.type]}
                >
                  <span className="scenario-panel-chip-vp" aria-hidden>
                    {TRIBE_TOKEN_ICON[token.type]}
                  </span>
                  <span className="scenario-panel-chip-type">
                    {TRIBE_TOKEN_LABEL[token.type]}
                  </span>
                  {claimer ? (
                    <>
                      <span
                        className="scenario-panel-chip-swatch"
                        style={{ background: playerColorVar(claimer.color) }}
                        aria-hidden
                      />
                      <span className="scenario-panel-chip-name">{claimer.name}</span>
                    </>
                  ) : (
                    <span className="scenario-panel-chip-name unclaimed">unclaimed</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// Traders & Barbarians scenario tracker. Currently surfaces gold totals per
// player, Wealthiest / Poor Catanian holders, and the Strongest Ports
// holder when the variant is on. Future T&B scenarios will add fishing
// catch counts, barbarian-attack progress, etc.
function TradersScenarioPanel() {
  const game = useGameStore((s) => s.game)!;
  return (
    <section className="scenario-panel">
      <header className="scenario-panel-header">
        <span className="scenario-panel-title">Traders & Barbarians</span>
      </header>
      <div className="scenario-panel-block">
        <div className="scenario-panel-block-head">
          <span>Gold</span>
        </div>
        <ul className="scenario-panel-chips">
          {game.players.map((p) => (
            <li key={p.id} className="scenario-panel-chip is-claimed">
              <span className="scenario-panel-chip-vp">🪙 {p.gold ?? 0}</span>
              <span
                className="scenario-panel-chip-swatch"
                style={{ background: playerColorVar(p.color) }}
                aria-hidden
              />
              <span className="scenario-panel-chip-name">
                {p.name}
                {game.wealthTiles?.wealthiest === p.id && ' 👑'}
                {game.wealthTiles?.poor.includes(p.id) && ' 👜'}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {game.strongestPorts && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Strongest Ports</span>
            <span className="scenario-panel-block-sum">+2 VP</span>
          </div>
          {(() => {
            const holderId = game.strongestPorts.holder;
            if (!holderId) {
              return (
                <div className="scenario-panel-note">
                  No-one has 3+ VPs in port buildings yet.
                </div>
              );
            }
            const holder = game.players.find((p) => p.id === holderId);
            if (!holder) return null;
            return (
              <ul className="scenario-panel-chips">
                <li className="scenario-panel-chip is-claimed">
                  <span className="scenario-panel-chip-vp">⚓</span>
                  <span
                    className="scenario-panel-chip-swatch"
                    style={{ background: playerColorVar(holder.color) }}
                    aria-hidden
                  />
                  <span className="scenario-panel-chip-name">{holder.name}</span>
                </li>
              </ul>
            );
          })()}
        </div>
      )}
    </section>
  );
}

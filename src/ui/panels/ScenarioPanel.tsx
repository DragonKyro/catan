import { useGameStore } from '@/store/gameStore';
import { getScenario } from '@/game/modules/seafarers/board/scenarios';
import { SEAFARERS_EXPANSION_ID } from '@/game/modules/seafarers/constants';
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
  if (!state.settings.expansions.includes(SEAFARERS_EXPANSION_ID)) return false;
  if (state.islandChips && state.islandChips.length > 0) return true;
  if (state.tribeTokens && state.tribeTokens.length > 0) return true;
  return false;
}

export function ScenarioPanel() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  if (!game.settings.expansions.includes(SEAFARERS_EXPANSION_ID)) return null;
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

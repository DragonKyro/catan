import { useGameStore } from '@/store/gameStore';
import { getScenario } from '@/game/modules/seafarers/board/scenarios';
import { SEAFARERS_EXPANSION_ID } from '@/game/modules/seafarers/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import { getWonder, WONDER_LEVELS } from '@/game/modules/seafarers/wonders/catalogue';
import {
  EXHAUSTED_VILLAGES_TO_END,
  exhaustedVillageCount,
} from '@/game/modules/seafarers/cloth';
import { playerColorVar } from '@/ui/shared/playerColors';
import type { GameState, Player } from '@/game/types';
import { BarbarianAttackPanel } from '@/ui/game/traders/BarbarianAttackPanel';
import { MerchantTrainsBlock } from './MerchantTrainsBlock';
import { TradersVariantsBlock, hasTradersVariantBlock } from './TradersVariantsBlock';
import { RiversTracker, FishingTracker } from './traders/RiversFishingTrackers';
import { TradersBarbariansTracker } from './traders/TradersBarbariansTracker';
import { ExplorersPiratesTracker } from './explorersPirates/ExplorersPiratesTracker';
import './ScenarioPanel.css';

// Scenario-specific progress tracker. Returns whether ANY scenario tracker
// is present; SidePanelTabs uses this to decide whether to render the
// Scenario tab at all.
export function hasScenarioTracker(state: ReturnType<typeof useGameStore.getState>['game']): boolean {
  if (!state) return false;
  // Explorers & Pirates: missions, exploration, lairs, farms, fish, pirate.
  if (state.explorersPirates) return true;
  // T&B variants (Strongest Ports, Event Cards, Friendly Robber) show in any game.
  if (hasTradersVariantBlock(state)) return true;
  const hasSeafarers = state.settings.expansions.includes(SEAFARERS_EXPANSION_ID);
  const hasTraders = state.settings.expansions.includes(TRADERS_EXPANSION_ID);
  if (hasSeafarers) {
    if (state.islandChips && state.islandChips.length > 0) return true;
    if (state.tribeTokens && state.tribeTokens.length > 0) return true;
    if (fogTotal(state) > 0) return true;
    if (state.wonders && state.wonders.length > 0) return true;
    if (state.pirateIslands) return true;
    if (state.clothVillages && state.clothVillages.length > 0) return true;
  }
  if (hasTraders) {
    if (state.wealthTiles) return true;
    if (state.strongestPorts) return true;
    if (state.fishingGrounds && state.fishingGrounds.length > 0) return true;
    if (state.lakeHexId) return true;
    if (state.wateringHoleHexId) return true;
    if (state.barbarianAttack) return true;
    if (state.tradersBarbarians) return true;
  }
  return false;
}

// Total number of fog hexes this scenario started with (the live list
// shrinks as fog lifts).
function fogTotal(state: ReturnType<typeof useGameStore.getState>['game']): number {
  if (!state) return 0;
  if (!state.settings.scenarioId) return 0;
  const sc = getScenario(state.settings.scenarioId);
  const useLarge = state.players.length >= 5;
  const defs = useLarge && sc.fogHexes5_6 ? sc.fogHexes5_6 : sc.fogHexes;
  return defs?.length ?? 0;
}

// How this game is won, in one line.
function winCondition(game: GameState): string {
  const target = game.settings.victoryPointsToWin;
  if (game.wonders) {
    return `Win: finish your wonder, or reach ${target} VP with a higher wonder level than everyone else.`;
  }
  if (game.pirateIslands) {
    return `Win: recapture your pirate fortress and reach ${target} VP.`;
  }
  if (game.clothVillages) {
    return `Win: ${target} VP on your turn — or, once ${EXHAUSTED_VILLAGES_TO_END}+ villages are out of cloth at the end of a turn, most VP (ties: most cloth).`;
  }
  return `Win: ${target} VP during your turn.`;
}

function Swatch({ player }: { player: Player }) {
  return (
    <span
      className="scenario-panel-chip-swatch"
      style={{ background: playerColorVar(player.color) }}
      aria-hidden
    />
  );
}

export function ScenarioPanel() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const hasSeafarers = game.settings.expansions.includes(SEAFARERS_EXPANSION_ID);
  const hasTraders = game.settings.expansions.includes(TRADERS_EXPANSION_ID);
  if (game.explorersPirates) {
    return (
      <section className="scenario-panel">
        <header className="scenario-panel-header">
          <span className="scenario-panel-title">Explorers & Pirates</span>
        </header>
        <ExplorersPiratesTracker game={game} />
      </section>
    );
  }
  // T&B path: own simpler tracker (no chip / fog / wonder machinery).
  if (hasTraders) {
    return <TradersScenarioPanel />;
  }
  if (!hasSeafarers) {
    // Base game with T&B variants only.
    if (!hasTradersVariantBlock(game)) return null;
    return (
      <section className="scenario-panel">
        <header className="scenario-panel-header">
          <span className="scenario-panel-title">Traders & Barbarians variants</span>
        </header>
        <TradersVariantsBlock game={game} />
      </section>
    );
  }
  const scenario = game.settings.scenarioId ? getScenario(game.settings.scenarioId) : null;
  const byId = (pid: string) => game.players.find((p) => p.id === pid);
  const chips = game.islandChips ?? [];

  return (
    <section className="scenario-panel">
      {scenario && (
        <header className="scenario-panel-header">
          <span className="scenario-panel-title">{scenario.name}</span>
          {scenario.desertIsBoundary && (
            <span
              className="scenario-panel-note"
              title="The land beyond the desert counts as its own unexplored region"
            >
              desert divides the island
            </span>
          )}
        </header>
      )}
      <div className="scenario-panel-note">{winCondition(game)}</div>

      {chips.length > 0 && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Island bonus</span>
            <span className="scenario-panel-block-sum">+{chips[0]!.vp} VP each</span>
          </div>
          <div className="scenario-panel-note">
            Your first settlement on each island you didn't start on earns +{chips[0]!.vp} VP —
            even if someone settled there first.
          </div>
          <ul className="scenario-panel-chips">
            {game.playerOrder.map((pid) => {
              const p = byId(pid)!;
              const earned = chips.filter((c) => c.claimedBy.includes(pid));
              const vp = earned.reduce((n, c) => n + c.vp, 0);
              const homes = chips.filter((c) => c.homeOf.includes(pid)).length;
              return (
                <li
                  key={pid}
                  className={`scenario-panel-chip${vp > 0 ? ' is-claimed' : ''}`}
                  title={`${earned.length} island${earned.length === 1 ? '' : 's'} settled` +
                    (homes > 0 ? ` · ${homes} home island${homes === 1 ? '' : 's'} (no bonus)` : '')}
                >
                  <span className="scenario-panel-chip-vp">+{vp}</span>
                  <Swatch player={p} />
                  <span className="scenario-panel-chip-name">
                    {p.name} · {earned.length}/{chips.length - homes} islands
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(() => {
        const total = fogTotal(game);
        if (total === 0) return null;
        const revealed = total - (game.unrevealedFogHexes?.length ?? 0);
        return (
          <div className="scenario-panel-block">
            <div className="scenario-panel-block-head">
              <span>Fog</span>
              <span className="scenario-panel-block-sum">
                {revealed}/{total} discovered
              </span>
            </div>
            <div className="scenario-panel-note">
              Place a road or ship next to a corner of an unexplored space to discover it. Land
              pays 1 of its resource (gold: your choice); sea pays nothing.
            </div>
          </div>
        );
      })()}

      {game.clothVillages && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Cloth</span>
            <span className="scenario-panel-block-sum">
              {exhaustedVillageCount(game)}/{game.clothVillages.length} villages empty ·{' '}
              {game.clothSupply ?? 0} in supply
            </span>
          </div>
          <div className="scenario-panel-note">
            Connect a building to a village by ships to trade: +1 cloth at once, +1 whenever its
            number rolls. Each pair of cloth is 1 VP. Ships on a village route can't move.
          </div>
          <ul className="scenario-panel-chips">
            {game.playerOrder.map((pid) => {
              const p = byId(pid)!;
              const cloth = p.cloth ?? 0;
              const routes = game.clothVillages!.filter((v) => v.partners.includes(pid)).length;
              return (
                <li key={pid} className={`scenario-panel-chip${cloth > 0 ? ' is-claimed' : ''}`}>
                  <span className="scenario-panel-chip-vp">🧵 {cloth}</span>
                  <Swatch player={p} />
                  <span className="scenario-panel-chip-name">
                    {p.name} · {Math.floor(cloth / 2)} VP · {routes} route{routes === 1 ? '' : 's'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {game.pirateIslands && (() => {
        const pi = game.pirateIslands;
        const fleet = pi.lastFleetAttack;
        const fort = pi.lastFortressAttack;
        return (
          <div className="scenario-panel-block">
            <div className="scenario-panel-block-head">
              <span>Pirate fortresses</span>
              <span className="scenario-panel-block-sum">
                {pi.fleetIndex < 0 ? 'fleet gone' : '3 lair tokens each'}
              </span>
            </div>
            <ul className="scenario-panel-chips">
              {pi.fortresses.map((f) => {
                const p = byId(f.playerId)!;
                return (
                  <li key={f.playerId} className={`scenario-panel-chip${f.lairs === 0 ? ' is-claimed' : ''}`}>
                    <span className="scenario-panel-chip-vp">
                      {f.lairs === 0 ? '✓' : `🏴‍☠️${f.lairs}`}
                    </span>
                    <Swatch player={p} />
                    <span className="scenario-panel-chip-name">
                      {p.name} · ⚔ {p.warships?.length ?? 0} warship
                      {(p.warships?.length ?? 0) === 1 ? '' : 's'}
                      {f.lairs === 0 && ' · recaptured'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {fleet && (
              <div className="scenario-panel-note">
                Last fleet attack (strength {fleet.strength}):{' '}
                {fleet.results.length === 0
                  ? 'no buildings there.'
                  : fleet.results
                      .map((r) => {
                        const n = byId(r.playerId)?.name ?? r.playerId;
                        return r.outcome === 'lost'
                          ? `${n} lost ${r.discarded} card${r.discarded === 1 ? '' : 's'}`
                          : r.outcome === 'won'
                            ? `${n} repelled it (+1 resource)`
                            : `${n} tied`;
                      })
                      .join('; ')}
              </div>
            )}
            {fort && (
              <div className="scenario-panel-note">
                Last fortress assault: {byId(fort.playerId)?.name} rolled {fort.die} vs{' '}
                {fort.warships} warship{fort.warships === 1 ? '' : 's'} —{' '}
                {fort.outcome === 'won'
                  ? fort.captured
                    ? 'fortress recaptured!'
                    : 'removed a lair token'
                  : `lost ${fort.shipsLost} ship${fort.shipsLost === 1 ? '' : 's'}`}
                .
              </div>
            )}
            <div className="scenario-panel-note">
              The fleet sails the loop by the lower die each roll and attacks buildings on its hex
              (its strength = that die; yours = your warships). Knight cards turn ships into
              warships. Once your line of ships reaches your fortress, you attack it at the end of
              each turn.
            </div>
          </div>
        );
      })()}

      {game.wonders && game.wonders.length > 0 && (
        <div className="scenario-panel-block">
          <div className="scenario-panel-block-head">
            <span>Wonders</span>
            <span className="scenario-panel-block-sum">
              {game.wonders.filter((w) => w.claimedBy).length}/{game.wonders.length} claimed
            </span>
          </div>
          <ul className="scenario-panel-chips">
            {game.wonders.map((w) => {
              const def = getWonder(w.id);
              const claimer = w.claimedBy ? byId(w.claimedBy) : null;
              return (
                <li
                  key={w.id}
                  className={`scenario-panel-chip${claimer ? ' is-claimed' : ''}`}
                  title={def.requirement}
                >
                  <span className="scenario-panel-chip-vp">
                    {w.level}/{WONDER_LEVELS}
                  </span>
                  <span className="scenario-panel-chip-type">{def.name}</span>
                  {claimer ? (
                    <>
                      <Swatch player={claimer} />
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

      {game.tribeTokens && game.tribeTokens.length > 0 && (() => {
        const left = game.tribeTokens.filter((t) => t.claimedBy === null);
        const count = (type: string) => left.filter((t) => t.type === type).length;
        return (
          <div className="scenario-panel-block">
            <div className="scenario-panel-block-head">
              <span>The tribe's gifts</span>
              <span className="scenario-panel-block-sum">
                ★ {count('victoryPoint')} · 🂠 {count('devCard')} · ⚓ {count('port')} left
              </span>
            </div>
            <div className="scenario-panel-note">
              Build or move a ship onto a marked edge to take what's there. Settlements and the
              robber only go on numbered hexes.
            </div>
            <ul className="scenario-panel-chips">
              {game.playerOrder.map((pid) => {
                const p = byId(pid)!;
                const vp = p.tribeVp ?? 0;
                const held = p.heldPorts?.length ?? 0;
                return (
                  <li key={pid} className={`scenario-panel-chip${vp > 0 ? ' is-claimed' : ''}`}>
                    <span className="scenario-panel-chip-vp">★ {vp}</span>
                    <Swatch player={p} />
                    <span className="scenario-panel-chip-name">
                      {p.name}
                      {held > 0 && ` · ${held} port${held === 1 ? '' : 's'} to place`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}
      <TradersVariantsBlock game={game} />
    </section>
  );
}

// Traders & Barbarians scenario tracker. Surfaces per-player gold totals,
// wealth tiles, the Strongest Ports tile, and (when Fishing on Catan is
// active) fish-token totals and the old boot. Future T&B scenarios will
// add barbarian-attack progress, etc.
function TradersScenarioPanel() {
  const game = useGameStore((s) => s.game)!;
  const isFishing = (game.fishingGrounds?.length ?? 0) > 0 || game.lakeHexId != null;
  const isRivers = (game.riverEdges?.length ?? 0) > 0;
  const isMerchantTrains = game.wateringHoleHexId != null;
  return (
    <section className="scenario-panel">
      <header className="scenario-panel-header">
        <span className="scenario-panel-title">Traders & Barbarians</span>
      </header>
      <BarbarianAttackPanel game={game} />
      <TradersBarbariansTracker game={game} />
      {isMerchantTrains && <MerchantTrainsBlock game={game} />}
      {isRivers && <RiversTracker game={game} />}
      {isFishing && <FishingTracker game={game} />}
      <TradersVariantsBlock game={game} />
    </section>
  );
}

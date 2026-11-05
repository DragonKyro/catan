import type { ImprovementTrack } from '@/game/types';
import { IMPROVEMENT_TRACKS, TRACK_COMMODITY } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { CommodityIcon } from '@/ui/shared/CommodityIcon';
import { TrackEmblem } from '@/ui/shared/ProgressCardFace';
import { useCanAct } from '@/ui/shared/useCanAct';
import {
  IMPROVEMENT_NAMES,
  LEVEL3_ABILITY_TEXT,
  LEVEL3_ABILITY_THRESHOLD,
  MAX_IMPROVEMENT_LEVEL,
  TRACK_LABEL,
} from '@/game/modules/citiesAndKnights/constants';
import { improvementCost } from '@/game/modules/citiesAndKnights/improvements/state';
import {
  improvementBlocker,
  metropolisEffect,
} from '@/game/modules/citiesAndKnights/actions/buildCityImprovement';
import { maxRedDieForLevel } from '@/game/modules/citiesAndKnights/progress/draw';
import { progressCardBlocker } from '@/game/modules/citiesAndKnights/actions/playProgressCard';
import { MetropolisGlyph, METROPOLIS_COLOR } from '@/ui/game/citiesAndKnights/MetropolisMarker';
import { playerColorVar } from '@/ui/shared/playerColors';
import { Swatch, playerName } from './common';

// The three city improvement boards (p.8): each level's cost, name, the red
// die range that draws a progress card from that level, the level-3 ability
// and who holds the metropolis. "Build" moves your cube up one level; with a
// Crane in hand you can spend it for 1 commodity off.
export function ImprovementsDialog() {
  const { game, dialog, dispatch, closeDialog } = useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || dialog !== 'cityImprovements' || !acting) return null;
  const player = game.players.find((p) => p.id === acting)!;
  const myTurn = canAct && game.phase === 'main';
  const holdsCrane = (player.progressCards?.science ?? []).includes('crane');
  const craneOk = holdsCrane && !progressCardBlocker(game, acting, 'crane');

  const build = (track: ImprovementTrack, useCrane: boolean) => {
    if (useCrane) dispatch({ type: 'playProgressCard', playerId: acting, card: 'crane' });
    dispatch({ type: 'buildCityImprovement', playerId: acting, track });
  };

  return (
    <DialogShell title="City improvements" variant="docked" onClose={closeDialog}>
      <div className="ck-stack">
        {player.cities.length === 0 && (
          <p className="ck-blocker">You need at least one city on the board to build improvements.</p>
        )}
        {game.craneActive && <p className="ck-soft">Crane played: your next improvement costs 1 less.</p>}
        <div className="ck-tracks">
          {IMPROVEMENT_TRACKS.map((track) => {
            const level = player.improvements?.[track] ?? 0;
            const next = level + 1;
            const blocker = myTurn ? improvementBlocker(game, acting, track) : 'Not your Action phase';
            const metro = game.metropolises?.[track];
            const effect = next <= MAX_IMPROVEMENT_LEVEL ? metropolisEffect(game, acting, track, next) : 'none';
            // With a Crane the cost check is one lower.
            const craneCost = improvementCost(track, next, true);
            const craneHelps =
              craneOk &&
              !game.craneActive &&
              !!blocker &&
              blocker.startsWith('Needs') &&
              (player.commodities?.[craneCost.commodity] ?? 0) >= craneCost.amount;
            const owner = metro ? game.players.find((p) => p.id === metro.playerId) : undefined;
            return (
              <div key={track} className={`ck-track ck-track-${track}`}>
                <div className="ck-track-head">
                  <TrackEmblem track={track} />
                  {TRACK_LABEL[track]}
                  <span className="ck-soft" style={{ marginLeft: 'auto' }}>
                    Level {level}/{MAX_IMPROVEMENT_LEVEL}
                  </span>
                </div>
                <div className="ck-levels">
                  {Array.from({ length: MAX_IMPROVEMENT_LEVEL }, (_, i) => i + 1).map((lv) => {
                    const cost = improvementCost(track, lv, false);
                    return (
                      <div
                        key={lv}
                        className={`ck-level${lv <= level ? ' is-built' : ''}${lv === next ? ' is-next' : ''}`}
                        title={`Level ${lv}: draws a ${track} card on a red die of 1-${maxRedDieForLevel(lv)} with the ${track} event icon`}
                      >
                        <span className="ck-level-num">{lv}</span>
                        <span>
                          {IMPROVEMENT_NAMES[track][lv]}
                          {lv === LEVEL3_ABILITY_THRESHOLD && ' ★'}
                          {lv >= 4 && ' 🏛'}
                        </span>
                        <span className="ck-level-cost">
                          {cost.amount}
                          <CommodityIcon commodity={TRACK_COMMODITY[track]} size="1em" /> · 🎲1-
                          {maxRedDieForLevel(lv)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className={level >= LEVEL3_ABILITY_THRESHOLD ? '' : 'ck-ability'} style={{ fontSize: '0.75em' }}>
                  {level >= LEVEL3_ABILITY_THRESHOLD ? '✓ ' : '★ at level 3 — '}
                  {LEVEL3_ABILITY_TEXT[track]}
                </div>
                <div className="ck-row" style={{ fontSize: '0.8em' }}>
                  <svg width={18} height={18} viewBox="-11 -16 22 26" aria-hidden>
                    <MetropolisGlyph
                      fill={METROPOLIS_COLOR[track]}
                      rim={owner ? playerColorVar(owner.color) : '#444'}
                      permanent={metro?.permanent}
                    />
                  </svg>
                  {metro ? (
                    <>
                      <Swatch game={game} pid={metro.playerId} />
                      {playerName(game, metro.playerId)}{' '}
                      {metro.permanent ? '(permanent)' : '(until someone first reaches level 5)'}
                    </>
                  ) : (
                    <span className="ck-soft">Metropolis: first to level 4</span>
                  )}
                </div>
                {level < MAX_IMPROVEMENT_LEVEL && (
                  <>
                    {effect === 'claim' && (
                      <span className="ck-soft">Level {next} wins this metropolis (+2 VP).</span>
                    )}
                    {effect === 'lock' && (
                      <span className="ck-soft">Level 5 makes your metropolis permanent.</span>
                    )}
                    <Button
                      size="sm"
                      fullWidth
                      variant={blocker ? 'secondary' : 'primary'}
                      disabled={!!blocker}
                      title={blocker ?? undefined}
                      onClick={() => build(track, false)}
                    >
                      Build {IMPROVEMENT_NAMES[track][next]} (
                      {improvementCost(track, next, !!game.craneActive).amount} {TRACK_COMMODITY[track]})
                    </Button>
                    {craneHelps && (
                      <Button size="sm" fullWidth onClick={() => build(track, true)}>
                        Play Crane → build for {craneCost.amount}
                      </Button>
                    )}
                    {blocker && myTurn && <span className="ck-blocker">{blocker}</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div className="ck-section-title">Everyone's levels</div>
          <table className="ck-soft" style={{ width: '100%', fontSize: '0.8em' }}>
            <tbody>
              {game.playerOrder.map((pid) => {
                const p = game.players.find((x) => x.id === pid)!;
                return (
                  <tr key={pid}>
                    <td>
                      <Swatch game={game} pid={pid} /> {p.name}
                    </td>
                    {IMPROVEMENT_TRACKS.map((t) => (
                      <td key={t} title={TRACK_LABEL[t]}>
                        <TrackEmblem track={t} size="1em" /> {p.improvements?.[t] ?? 0}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DialogShell>
  );
}

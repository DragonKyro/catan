import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { RESOURCE_ICON } from '@/ui/shared/ResourceChip';
import { playerColorVar } from '@/ui/shared/playerColors';
import {
  claimedWonderOf,
  getWonder,
  WONDER_LEVELS,
} from '@/game/modules/seafarers/wonders/catalogue';
import { canAfford } from '@/game/resources';
import { RESOURCES, type Resource } from '@/game/types';
import { useCanAct } from '@/ui/shared/useCanAct';
import './WondersDialog.css';

// Wonders of Catan (rulebook p.18). Claim one wonder once you meet its
// requirement — nobody else may then claim or build it — then build its four
// levels, each costing the tile's 5 resources. Finishing level 4 wins; so
// does reaching the VP target with a higher level than every other player.
export function WondersDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || !game.wonders || !acting || !canAct) return null;
  const player = game.players.find((p) => p.id === acting)!;
  const mine = claimedWonderOf(game, acting);
  const target = game.settings.victoryPointsToWin;

  return (
    <DialogShell title="Wonders of Catan" onClose={closeDialog} variant="modal">
      <p className="wonders-dialog-intro">
        Claim <strong>one</strong> wonder once you meet its requirement, then build its{' '}
        {WONDER_LEVELS} levels. You win by <strong>finishing your wonder</strong>, or by having{' '}
        <strong>{target}+ VP</strong> and a <strong>higher level</strong> than every other player.
        Wonder levels are not worth VP.
      </p>
      <ul className="wonders-dialog-list">
        {game.wonders.map((w) => {
          const def = getWonder(w.id);
          const claimer = w.claimedBy ? game.players.find((p) => p.id === w.claimedBy) : null;
          const isMine = w.claimedBy === acting;
          const isComplete = w.level >= WONDER_LEVELS;
          const requirementMet = def.requirementMet(game, acting);
          const affordable = canAfford(player.resources, def.costPerLevel);
          let action: { label: string; disabled: boolean; title: string; run: () => void } | null =
            null;
          if (isMine) {
            action = {
              label: isComplete ? 'Complete' : `Build level ${w.level + 1}`,
              disabled: isComplete || !affordable,
              title: isComplete
                ? 'Complete'
                : !affordable
                  ? 'Cannot afford the next level'
                  : `Build ${def.name} level ${w.level + 1}`,
              run: () => dispatch({ type: 'buildWonder', playerId: acting, wonderId: w.id }),
            };
          } else if (!claimer && !mine) {
            action = {
              label: 'Claim',
              disabled: !requirementMet,
              title: requirementMet
                ? `Claim ${def.name} — locks it to you (you may only claim one wonder)`
                : `Requirement not met: ${def.requirement}`,
              run: () => dispatch({ type: 'claimWonder', playerId: acting, wonderId: w.id }),
            };
          }

          return (
            <li
              key={w.id}
              className={`wonders-dialog-row${claimer ? ' is-claimed' : ''}${isComplete ? ' is-complete' : ''}`}
            >
              <div className="wonders-dialog-row-head">
                <span className="wonders-dialog-name">{def.name}</span>
                <span
                  className={`wonders-dialog-progress${isComplete ? ' is-complete' : ''}`}
                  aria-label={`Level ${w.level} of ${WONDER_LEVELS}`}
                >
                  {Array.from({ length: WONDER_LEVELS }, (_, i) => (
                    <span
                      key={i}
                      className={`wonders-dialog-pip${i < w.level ? ' filled' : ''}`}
                      aria-hidden
                    />
                  ))}{' '}
                  {w.level}/{WONDER_LEVELS}
                </span>
              </div>
              <div className="wonders-dialog-row-meta">
                <span className="wonders-dialog-prereq">
                  {claimer ? '' : requirementMet ? '✓ ' : '✗ '}
                  {def.requirement}
                </span>
                <span className="wonders-dialog-cost" title="Cost per level">
                  {RESOURCES.filter((r) => (def.costPerLevel[r] ?? 0) > 0).map((r: Resource) => (
                    <span key={r} className="wonders-dialog-cost-chip">
                      {def.costPerLevel[r]}
                      <span aria-hidden>{RESOURCE_ICON[r]}</span>
                    </span>
                  ))}
                </span>
              </div>
              <div className="wonders-dialog-row-actions">
                {claimer && (
                  <span className="wonders-dialog-claimer">
                    <span
                      className="wonders-dialog-claimer-swatch"
                      style={{ background: playerColorVar(claimer.color) }}
                    />
                    {claimer.name}
                  </span>
                )}
                {action && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={action.disabled}
                    title={action.title}
                    onClick={action.run}
                  >
                    {action.label}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="wonders-dialog-footer">
        <Button variant="ghost" onClick={closeDialog}>
          Close
        </Button>
      </div>
    </DialogShell>
  );
}

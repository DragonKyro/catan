import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { RESOURCE_ICON } from '@/ui/shared/ResourceChip';
import { playerColorVar } from '@/ui/shared/playerColors';
import { WONDERS, getWonder } from '@/game/modules/seafarers/wonders/catalogue';
import { canAfford } from '@/game/resources';
import { RESOURCES, type Resource } from '@/game/types';
import './WondersDialog.css';

// Wonders of Catan build dialog. Shows all 5 wonders with their level
// progress, cost, prereq, and current claimer. The action button on each
// row builds the next level — disabled with a tooltip explaining why
// when the player can't (claimed by other / no resources / no prereq /
// maxed out).
export function WondersDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  if (!game || !game.wonders) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  if (player.isAI) return null;

  return (
    <DialogShell title="Wonders of Catan" onClose={closeDialog} variant="modal">
      <p className="wonders-dialog-intro">
        First to complete any wonder wins, regardless of VP. Each level also
        gives <strong>+1 VP</strong>.
      </p>
      <ul className="wonders-dialog-list">
        {WONDERS.map((def) => {
          const w = game.wonders!.find((x) => x.id === def.id);
          if (!w) return null;
          const claimer = w.builtBy
            ? game.players.find((p) => p.id === w.builtBy)
            : null;
          const claimedByOther = !!claimer && claimer.id !== acting;
          const isComplete = w.level >= def.maxLevel;
          const prereqMet = getWonder(def.id).prereqMet(game, acting);
          const affordable = canAfford(player.resources, def.costPerLevel);
          const disabled = claimedByOther || isComplete || !prereqMet || !affordable;
          const tooltip = claimedByOther
            ? `Already being built by ${claimer!.name}`
            : isComplete
              ? 'Complete'
              : !prereqMet
                ? `Prerequisite not met: ${def.prereqLabel}`
                : !affordable
                  ? 'Cannot afford the next level'
                  : `Build ${def.name} level ${w.level + 1}`;

          return (
            <li
              key={def.id}
              className={`wonders-dialog-row${claimer ? ' is-claimed' : ''}${isComplete ? ' is-complete' : ''}`}
            >
              <div className="wonders-dialog-row-head">
                <span className="wonders-dialog-name">{def.name}</span>
                <span
                  className={`wonders-dialog-progress${isComplete ? ' is-complete' : ''}`}
                  aria-label={`Level ${w.level} of ${def.maxLevel}`}
                >
                  {Array.from({ length: def.maxLevel }, (_, i) => (
                    <span
                      key={i}
                      className={`wonders-dialog-pip${i < w.level ? ' filled' : ''}`}
                      aria-hidden
                    />
                  ))}
                  {' '}
                  {w.level}/{def.maxLevel}
                </span>
              </div>
              <div className="wonders-dialog-row-meta">
                <span className="wonders-dialog-prereq">
                  {prereqMet ? '✓' : '✗'} {def.prereqLabel}
                </span>
                <span className="wonders-dialog-cost">
                  {RESOURCES.filter((r) => (def.costPerLevel[r] ?? 0) > 0).map(
                    (r: Resource) => (
                      <span key={r} className="wonders-dialog-cost-chip">
                        {def.costPerLevel[r]}
                        <span aria-hidden>{RESOURCE_ICON[r]}</span>
                      </span>
                    ),
                  )}
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
                <Button
                  variant="primary"
                  size="sm"
                  disabled={disabled}
                  title={tooltip}
                  onClick={() => {
                    dispatch({ type: 'buildWonder', playerId: acting, wonderId: def.id });
                  }}
                >
                  {isComplete ? 'Complete' : `Build level ${w.level + 1}`}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="wonders-dialog-footer">
        <Button variant="ghost" onClick={closeDialog}>Close</Button>
      </div>
    </DialogShell>
  );
}

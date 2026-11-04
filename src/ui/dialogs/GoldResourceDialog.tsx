import { useState } from 'react';
import type { Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { requiredGoldPicks } from '@/game/modules/seafarers/actions/chooseGoldResource';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { useCanAct } from '@/ui/shared/useCanAct';

// Resource-of-choice picks: gold field production (1 per settlement, 2 per
// city), a gold starting settlement, discovering a gold fog hex, or beating
// the Pirate Islands fleet. Players with picks go in turn order.
export function GoldResourceDialog() {
  const { game, dispatch } = useGameStore();
  const [picks, setPicks] = useState<Resource[]>([]);
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || game.phase !== 'chooseGoldResource' || !game.goldChoiceState || !acting) {
    return null;
  }
  if (game.goldChoiceState.pending[acting] === undefined) return null;
  if (!canAct) return null;
  const player = game.players.find((p) => p.id === acting)!;
  const owed = game.goldChoiceState.pending[acting]!;
  // The bank may not hold enough cards to pay everything owed.
  const required = requiredGoldPicks(game, acting);

  const add = (r: Resource) => setPicks((cur) => (cur.length < required ? [...cur, r] : cur));
  const removeAt = (i: number) => setPicks((cur) => cur.filter((_, j) => j !== i));

  return (
    <DialogShell
      title={`${player.name} — choose ${required} resource${required === 1 ? '' : 's'}`}
      blocking
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Take {required === 1 ? 'a resource' : `${required} resources`} of your choice from the
        bank.
        {required < owed && ` (You're owed ${owed}, but the bank only has ${required}.)`}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {RESOURCES.map((r) => (
          <Button
            key={r}
            size="sm"
            onClick={() => add(r)}
            disabled={picks.length >= required || game.bank[r] - picks.filter((p) => p === r).length <= 0}
          >
            <ResourceChip resource={r} count={game.bank[r] - picks.filter((p) => p === r).length} size="sm" />
          </Button>
        ))}
      </div>
      {picks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.85em', color: 'var(--text-soft)', marginBottom: 4 }}>
            Picks (tap to remove)
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {picks.map((r, i) => (
              <Button key={i} size="sm" variant="secondary" onClick={() => removeAt(i)}>
                <ResourceChip resource={r} size="sm" />
              </Button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="primary"
          disabled={picks.length !== required}
          onClick={() => {
            dispatch({ type: 'chooseGoldResource', playerId: acting, resources: picks });
            setPicks([]);
          }}
        >
          Confirm
        </Button>
      </div>
    </DialogShell>
  );
}

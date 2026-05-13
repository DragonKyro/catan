import { useState } from 'react';
import type { Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip } from '@/ui/shared/ResourceChip';

export function YearOfPlentyDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const [picks, setPicks] = useState<[Resource | null, Resource | null]>([null, null]);
  if (!game) return null;
  const acting = getActingPlayerId(game);

  const toggle = (slot: 0 | 1, r: Resource) => {
    const next: [Resource | null, Resource | null] = [...picks] as never;
    next[slot] = r;
    setPicks(next);
  };

  const canSubmit =
    picks[0] !== null &&
    picks[1] !== null &&
    game.bank[picks[0]!] >= 1 &&
    (picks[0] !== picks[1] || game.bank[picks[1]!] >= 2);

  return (
    <DialogShell
      title="Year of Plenty"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() =>
              dispatch({
                type: 'playYearOfPlenty',
                playerId: acting,
                resources: [picks[0]!, picks[1]!],
              })
            }
          >
            Take both
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Pick two resources from the bank.
      </p>
      {[0, 1].map((slot) => (
        <div key={slot} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.85em', color: 'var(--text-soft)', marginBottom: 4 }}>
            Choice {slot + 1}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RESOURCES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={picks[slot as 0 | 1] === r ? 'primary' : 'secondary'}
                onClick={() => toggle(slot as 0 | 1, r)}
                disabled={game.bank[r] === 0}
              >
                <ResourceChip resource={r} count={game.bank[r]} size="sm" dimmed={game.bank[r] === 0} />
              </Button>
            ))}
          </div>
        </div>
      ))}
    </DialogShell>
  );
}

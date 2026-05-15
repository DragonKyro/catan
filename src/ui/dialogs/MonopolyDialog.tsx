import { useState } from 'react';
import type { Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';

export function MonopolyDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const [pick, setPick] = useState<Resource | null>(null);
  if (!game) return null;
  const acting = getActingPlayerId(game);

  return (
    <DialogShell
      title="Monopoly"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!pick}
            onClick={() => dispatch({ type: 'playMonopoly', playerId: acting, resource: pick! })}
          >
            Take all {pick ? RESOURCE_LABEL[pick] : ''}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Pick one resource. Every other player gives you all of their cards of that type.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {RESOURCES.map((r) => (
          <Button
            key={r}
            variant={pick === r ? 'primary' : 'secondary'}
            onClick={() => setPick(r)}
          >
            <ResourceChip resource={r} />
          </Button>
        ))}
      </div>
    </DialogShell>
  );
}

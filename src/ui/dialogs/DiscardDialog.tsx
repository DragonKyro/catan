import { useState } from 'react';
import type { Resource, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourcePicker } from '@/ui/shared/ResourcePicker';

export function DiscardDialog() {
  const { game, dispatch } = useGameStore();
  const [picked, setPicked] = useState<Partial<ResourceBank>>({});
  if (!game || game.phase !== 'discard' || !game.discardState) return null;
  const acting = getActingPlayerId(game);
  const required = game.discardState.required[acting];
  if (required === undefined) return null;
  const player = game.players.find((p) => p.id === acting)!;
  // AI players discard themselves via the AIDriver — no dialog needed for
  // them (and we don't want to flash their hand to the human).
  if (player.isAI) return null;

  let total = 0;
  for (const r of RESOURCES) total += picked[r] ?? 0;

  return (
    <DialogShell title={`${player.name} must discard ${required} cards`} blocking>
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Selected: <strong style={{ color: total === required ? 'var(--success)' : 'var(--accent)' }}>{total}</strong> / {required}
      </p>
      <ResourcePicker
        values={picked}
        available={player.resources as Record<Resource, number>}
        onChange={setPicked}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <Button
          variant="primary"
          disabled={total !== required}
          onClick={() => {
            dispatch({ type: 'discard', playerId: acting, resources: picked });
            setPicked({});
          }}
        >
          Confirm discard
        </Button>
      </div>
    </DialogShell>
  );
}

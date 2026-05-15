import { useState } from 'react';
import type { Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip } from '@/ui/shared/ResourceChip';

export function GoldResourceDialog() {
  const { game, dispatch } = useGameStore();
  const [picks, setPicks] = useState<Resource[]>([]);
  if (!game || game.phase !== 'chooseGoldResource' || !game.goldChoiceState) return null;
  const acting = getActingPlayerId(game);
  const required = game.goldChoiceState.pending[acting];
  if (required === undefined) return null;
  const player = game.players.find((p) => p.id === acting)!;
  if (player.isAI) return null; // AI picks itself via AIDriver

  const add = (r: Resource) => setPicks((cur) => (cur.length < required ? [...cur, r] : cur));
  const removeAt = (i: number) => setPicks((cur) => cur.filter((_, j) => j !== i));

  return (
    <DialogShell title={`${player.name} — choose ${required} gold resource${required > 1 ? 's' : ''}`} blocking>
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Each adjacent gold hex pays one resource of your choice. Pick {required} from the bank.
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
            Picks
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

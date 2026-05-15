import { useState } from 'react';
import type { Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { getBankTradeRate } from '@/game/actions/trade';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';

export function BankTradeDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const [give, setGive] = useState<Resource>('wood');
  const [receive, setReceive] = useState<Resource>('brick');
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  const rate = getBankTradeRate(game, acting, give);
  const canSubmit =
    give !== receive && player.resources[give] >= rate && game.bank[receive] >= 1;

  return (
    <DialogShell
      title="Bank trade"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => dispatch({ type: 'bankTrade', playerId: acting, give, receive })}
          >
            Trade
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: '0.85em', color: 'var(--text-soft)', marginBottom: 4 }}>Give</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RESOURCES.map((r) => (
              <Button
                key={r}
                variant={give === r ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setGive(r)}
              >
                <ResourceChip resource={r} count={player.resources[r]} size="sm" />
              </Button>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-soft)' }}>
          rate: <strong style={{ color: 'var(--accent)' }}>{rate}:1</strong> →
        </div>
        <div>
          <div style={{ fontSize: '0.85em', color: 'var(--text-soft)', marginBottom: 4 }}>Receive</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RESOURCES.map((r) => (
              <Button
                key={r}
                variant={receive === r ? 'primary' : 'secondary'}
                size="sm"
                disabled={r === give}
                onClick={() => setReceive(r)}
              >
                <ResourceChip resource={r} count={game.bank[r]} size="sm" dimmed={game.bank[r] === 0} />
              </Button>
            ))}
          </div>
        </div>
        {!canSubmit && (
          <div style={{ color: 'var(--danger)', fontSize: '0.9em' }}>
            {give === receive
              ? 'Pick a different resource to receive.'
              : player.resources[give] < rate
                ? `Need ${rate} ${RESOURCE_LABEL[give]} to trade.`
                : 'Bank is out of that resource.'}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

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
  const [count, setCount] = useState(1);
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  const rate = getBankTradeRate(game, acting, give);
  const totalGive = rate * count;
  const maxByPlayer = Math.floor(player.resources[give] / rate);
  const maxByBank = game.bank[receive];
  const maxCount = Math.max(0, Math.min(maxByPlayer, maxByBank));
  const canSubmit = give !== receive && count >= 1 && count <= maxCount;

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
            onClick={() =>
              dispatch({ type: 'bankTrade', playerId: acting, give, receive, count })
            }
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
        <div className="bank-count">
          <span className="bank-count-label">How many?</span>
          <button
            type="button"
            className="bank-count-btn"
            onClick={() => setCount(Math.max(1, count - 1))}
            disabled={count <= 1}
            aria-label="Decrease count"
          >
            −
          </button>
          <span className="bank-count-value">{count}</span>
          <button
            type="button"
            className="bank-count-btn"
            onClick={() => setCount(Math.min(maxCount || 1, count + 1))}
            disabled={count >= maxCount}
            aria-label="Increase count"
          >
            +
          </button>
          <span className="bank-count-summary">
            give {totalGive} <ResourceChip resource={give} size="sm" />, get {count}{' '}
            <ResourceChip resource={receive} size="sm" dimmed={give === receive} />
          </span>
        </div>
        {!canSubmit && (
          <div style={{ color: 'var(--danger)', fontSize: '0.9em' }}>
            {give === receive
              ? 'Pick a different resource to receive.'
              : maxCount === 0
                ? player.resources[give] < rate
                  ? `Need at least ${rate} ${RESOURCE_LABEL[give]} to trade.`
                  : 'Bank is out of that resource.'
                : `Choose 1–${maxCount}.`}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

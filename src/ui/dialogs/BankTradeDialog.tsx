import { useState } from 'react';
import type { Commodity, Resource, TradeGood } from '@/game/types';
import { COMMODITIES, RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { getBankTradeRate } from '@/game/actions/trade';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { ckBankTradeRate, isCommodity } from '@/game/modules/citiesAndKnights/trade';
import { GoodChip, goodLabel } from '@/ui/dialogs/citiesAndKnights/common';

export function BankTradeDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const [give, setGive] = useState<TradeGood>('wood');
  const [receive, setReceive] = useState<TradeGood>('brick');
  const [count, setCount] = useState(1);
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  // Cities & Knights: commodities trade with the supply too (p.7).
  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
  const goods: readonly TradeGood[] = hasCK ? [...RESOURCES, ...COMMODITIES] : RESOURCES;
  const held = (g: TradeGood) =>
    isCommodity(g) ? (player.commodities?.[g as Commodity] ?? 0) : player.resources[g as Resource];
  const inSupply = (g: TradeGood) =>
    isCommodity(g) ? (game.commodityBank?.[g as Commodity] ?? 0) : game.bank[g as Resource];
  const rateOf = (g: TradeGood) =>
    hasCK ? ckBankTradeRate(game, acting, g) : getBankTradeRate(game, acting, g as Resource);
  const rate = rateOf(give);
  const totalGive = rate * count;
  const maxByPlayer = Math.floor(held(give) / rate);
  const maxByBank = inSupply(receive);
  const maxCount = Math.max(0, Math.min(maxByPlayer, maxByBank));
  const canSubmit = give !== receive && count >= 1 && count <= maxCount;
  const submit = () =>
    dispatch(
      isCommodity(give) || isCommodity(receive)
        ? { type: 'bankTradeCK', playerId: acting, give, receive, count }
        : { type: 'bankTrade', playerId: acting, give: give as Resource, receive: receive as Resource, count },
    );

  return (
    <DialogShell
      title="Bank trade"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            Trade
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: '0.85em', color: 'var(--text-soft)', marginBottom: 4 }}>Give</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {goods.map((g) => (
              <Button
                key={g}
                variant={give === g ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setGive(g)}
                title={`${goodLabel(g)} at ${rateOf(g)}:1`}
              >
                <GoodChip good={g} count={held(g)} size="sm" />
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
            {goods.map((g) => (
              <Button
                key={g}
                variant={receive === g ? 'primary' : 'secondary'}
                size="sm"
                disabled={g === give}
                onClick={() => setReceive(g)}
              >
                <GoodChip good={g} count={inSupply(g)} size="sm" />
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
            give {totalGive} <GoodChip good={give} size="sm" />, get {count}{' '}
            <GoodChip good={receive} size="sm" />
          </span>
        </div>
        {!canSubmit && (
          <div style={{ color: 'var(--danger)', fontSize: '0.9em' }}>
            {give === receive
              ? 'Pick a different card to receive.'
              : maxCount === 0
                ? held(give) < rate
                  ? `Need at least ${rate} ${goodLabel(give)} to trade.`
                  : 'The supply is out of that card.'
                : `Choose 1–${maxCount}.`}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

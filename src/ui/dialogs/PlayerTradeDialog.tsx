import { useEffect, useState } from 'react';
import type { Resource, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';
import './PlayerTradeDialog.css';

export function PlayerTradeDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  // One signed value per resource: negative = give that many, positive =
  // receive that many. Combines what used to be two separate ResourcePicker
  // sections into a single, compact column.
  const [values, setValues] = useState<Record<Resource, number>>({
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0,
  });

  // Determine if we are countering an existing pending trade.
  const pending = game?.pendingTrade ?? null;
  const acting = game ? getActingPlayerId(game) : null;
  const isCounter =
    !!pending && !!acting && pending.proposerId !== acting;

  // When countering, seed the inputs with the swap of the original offer.
  useEffect(() => {
    if (!isCounter || !pending) return;
    const seed: Record<Resource, number> = {
      wood: 0,
      brick: 0,
      sheep: 0,
      wheat: 0,
      ore: 0,
    };
    // Original `give` was offered TO us — we'd be the one receiving it in
    // the original. In a counter, we offer them what they wanted (receive)
    // and ask for what they offered (give).
    for (const r of RESOURCES) {
      const ask = pending.give[r] ?? 0; // we ask for what they offered
      const offer = pending.receive[r] ?? 0; // we offer what they wanted
      seed[r] = ask - offer;
    }
    setValues(seed);
  }, [isCounter, pending]);

  if (!game || !acting) return null;
  const player = game.players.find((p) => p.id === acting)!;

  let totalGive = 0;
  let totalReceive = 0;
  for (const r of RESOURCES) {
    if (values[r] < 0) totalGive += -values[r];
    if (values[r] > 0) totalReceive += values[r];
  }
  const canSubmit = totalGive > 0 && totalReceive > 0;

  const change = (r: Resource, delta: number) => {
    const cur = values[r];
    const next = cur + delta;
    // Cap negative side by what player has
    if (next < -player.resources[r]) return;
    setValues({ ...values, [r]: next });
  };

  const submit = () => {
    const give: Partial<ResourceBank> = {};
    const receive: Partial<ResourceBank> = {};
    for (const r of RESOURCES) {
      if (values[r] < 0) give[r] = -values[r];
      else if (values[r] > 0) receive[r] = values[r];
    }
    if (isCounter) {
      dispatch({ type: 'counterTrade', playerId: acting, give, receive });
    } else {
      dispatch({ type: 'proposeTrade', playerId: acting, give, receive });
    }
    closeDialog();
  };

  return (
    <DialogShell
      title={isCounter ? 'Counter the offer' : 'Propose a trade'}
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            {isCounter ? 'Send counter' : 'Propose'}
          </Button>
        </>
      }
    >
      <p className="ptrade-hint">
        Use <span className="ptrade-pill ptrade-pill-give">−</span> to give and{' '}
        <span className="ptrade-pill ptrade-pill-get">+</span> to receive.
      </p>
      <div className="ptrade-list">
        {RESOURCES.map((r) => {
          const v = values[r];
          const give = v < 0 ? -v : 0;
          const recv = v > 0 ? v : 0;
          const canDecrement = -v < player.resources[r];
          return (
            <div key={r} className={`ptrade-row ${v < 0 ? 'is-give' : v > 0 ? 'is-get' : ''}`}>
              <button
                type="button"
                className="ptrade-btn ptrade-btn-give"
                onClick={() => change(r, -1)}
                disabled={!canDecrement}
                aria-label={`Give one ${r}`}
                title={`Give one more ${RESOURCE_LABEL[r]}`}
              >
                −
              </button>
              <div className="ptrade-mid">
                <ResourceChip resource={r} size="md" />
                <span className="ptrade-name">{RESOURCE_LABEL[r]}</span>
                <span className="ptrade-have">have {player.resources[r]}</span>
              </div>
              <div className="ptrade-value">
                {give > 0 && (
                  <span className="ptrade-side ptrade-side-give">−{give}</span>
                )}
                {recv > 0 && (
                  <span className="ptrade-side ptrade-side-get">+{recv}</span>
                )}
                {v === 0 && <span className="ptrade-side ptrade-side-zero">0</span>}
              </div>
              <button
                type="button"
                className="ptrade-btn ptrade-btn-get"
                onClick={() => change(r, +1)}
                aria-label={`Receive one ${r}`}
                title={`Receive one more ${RESOURCE_LABEL[r]}`}
              >
                +
              </button>
            </div>
          );
        })}
      </div>
      <div className="ptrade-summary">
        <span className="ptrade-summary-side">
          Give: <strong>{totalGive}</strong>
        </span>
        <span className="ptrade-summary-side">
          Receive: <strong>{totalReceive}</strong>
        </span>
      </div>
    </DialogShell>
  );
}

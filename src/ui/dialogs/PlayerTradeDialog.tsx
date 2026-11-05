import { useEffect, useState } from 'react';
import type { Commodity, CommodityBank, Resource, ResourceBank, TradeGood } from '@/game/types';
import { COMMODITIES, RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { getBankTradeRate } from '@/game/actions/trade';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { ckBankTradeRate, isCommodity } from '@/game/modules/citiesAndKnights/trade';
import { GoodChip, goodLabel } from '@/ui/dialogs/citiesAndKnights/common';
import './PlayerTradeDialog.css';

type Values = Record<TradeGood, number>;
const ZERO: Values = {
  wood: 0,
  brick: 0,
  sheep: 0,
  wheat: 0,
  ore: 0,
  paper: 0,
  cloth: 0,
  coin: 0,
};

export function PlayerTradeDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  // One signed value per card type: negative = give that many, positive =
  // receive that many. Combines what used to be two separate ResourcePicker
  // sections into a single, compact column. Commodities (Cities & Knights)
  // trade like resources (p.7).
  const [values, setValues] = useState<Values>(ZERO);

  // Determine if we are countering an existing pending trade.
  const pending = game?.pendingTrade ?? null;
  const acting = game ? getActingPlayerId(game) : null;
  const isCounter =
    !!pending && !!acting && pending.proposerId !== acting;

  // When countering, seed the inputs with the swap of the original offer.
  useEffect(() => {
    if (!isCounter || !pending) return;
    const seed: Values = { ...ZERO };
    // Original `give` was offered TO us — we'd be the one receiving it in
    // the original. In a counter, we offer them what they wanted (receive)
    // and ask for what they offered (give).
    for (const r of RESOURCES) seed[r] = (pending.give[r] ?? 0) - (pending.receive[r] ?? 0);
    for (const c of COMMODITIES) {
      seed[c] = (pending.giveCommodities?.[c] ?? 0) - (pending.receiveCommodities?.[c] ?? 0);
    }
    setValues(seed);
  }, [isCounter, pending]);

  if (!game || !acting) return null;
  const player = game.players.find((p) => p.id === acting)!;
  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
  const goods: readonly TradeGood[] = hasCK ? [...RESOURCES, ...COMMODITIES] : RESOURCES;
  const held = (g: TradeGood) =>
    isCommodity(g) ? (player.commodities?.[g as Commodity] ?? 0) : player.resources[g as Resource];

  let totalGive = 0;
  let totalReceive = 0;
  for (const g of goods) {
    if (values[g] < 0) totalGive += -values[g];
    if (values[g] > 0) totalReceive += values[g];
  }
  const canSubmit = totalGive > 0 && totalReceive > 0;

  const change = (g: TradeGood, delta: number) => {
    const next = values[g] + delta;
    // Cap negative side by what player has
    if (next < -held(g)) return;
    setValues({ ...values, [g]: next });
  };

  // Detect a single-give → single-receive trade that the bank could
  // complete EXACTLY at the player's current rate. e.g. 4 wheat → 1 ore at a
  // 4:1 rate, or 6 wheat → 3 ore at a 2:1 port. In that case we auto-route
  // through the bank so the user never broadcasts a trade no opponent would
  // ever beat anyway. Multi-card trades, or lopsided single-card trades,
  // fall through to a player proposal as normal.
  const bankRoute = (() => {
    if (isCounter) return null;
    const giveEntries: Array<[TradeGood, number]> = [];
    const recvEntries: Array<[TradeGood, number]> = [];
    for (const g of goods) {
      if (values[g] < 0) giveEntries.push([g, -values[g]]);
      else if (values[g] > 0) recvEntries.push([g, values[g]]);
    }
    if (giveEntries.length !== 1 || recvEntries.length !== 1) return null;
    const [gRes, gCount] = giveEntries[0]!;
    const [rRes, rCount] = recvEntries[0]!;
    const rate = hasCK ? ckBankTradeRate(game, acting, gRes) : getBankTradeRate(game, acting, gRes as Resource);
    const supply = isCommodity(rRes)
      ? (game.commodityBank?.[rRes as Commodity] ?? 0)
      : game.bank[rRes as Resource];
    if (gCount === rate * rCount && supply >= rCount) {
      return { give: gRes, receive: rRes, count: rCount, rate };
    }
    return null;
  })();

  const submit = () => {
    const give: Partial<ResourceBank> = {};
    const receive: Partial<ResourceBank> = {};
    const giveCommodities: Partial<CommodityBank> = {};
    const receiveCommodities: Partial<CommodityBank> = {};
    for (const r of RESOURCES) {
      if (values[r] < 0) give[r] = -values[r];
      else if (values[r] > 0) receive[r] = values[r];
    }
    for (const c of COMMODITIES) {
      if (values[c] < 0) giveCommodities[c] = -values[c];
      else if (values[c] > 0) receiveCommodities[c] = values[c];
    }
    const withCommodities = hasCK
      ? { giveCommodities, receiveCommodities }
      : {};
    if (isCounter) {
      dispatch({ type: 'counterTrade', playerId: acting, give, receive, ...withCommodities });
    } else if (bankRoute) {
      dispatch(
        isCommodity(bankRoute.give) || isCommodity(bankRoute.receive)
          ? {
              type: 'bankTradeCK',
              playerId: acting,
              give: bankRoute.give,
              receive: bankRoute.receive,
              count: bankRoute.count,
            }
          : {
              type: 'bankTrade',
              playerId: acting,
              give: bankRoute.give as Resource,
              receive: bankRoute.receive as Resource,
              count: bankRoute.count,
            },
      );
    } else {
      dispatch({ type: 'proposeTrade', playerId: acting, give, receive, ...withCommodities });
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
            {isCounter ? 'Send counter' : bankRoute ? `Trade with bank (${bankRoute.rate}:1)` : 'Propose'}
          </Button>
        </>
      }
    >
      <p className="ptrade-hint">
        Use <span className="ptrade-pill ptrade-pill-give">−</span> to give and{' '}
        <span className="ptrade-pill ptrade-pill-get">+</span> to receive.
      </p>
      <div className="ptrade-list">
        {goods.map((r) => {
          const v = values[r];
          const give = v < 0 ? -v : 0;
          const recv = v > 0 ? v : 0;
          const canDecrement = -v < held(r);
          return (
            <div key={r} className={`ptrade-row ${v < 0 ? 'is-give' : v > 0 ? 'is-get' : ''}`}>
              <button
                type="button"
                className="ptrade-btn ptrade-btn-give"
                onClick={() => change(r, -1)}
                disabled={!canDecrement}
                aria-label={`Give one ${r}`}
                title={`Give one more ${goodLabel(r)}`}
              >
                −
              </button>
              <div className="ptrade-mid">
                <GoodChip good={r} size="sm" />
                <span className="ptrade-name">{goodLabel(r)}</span>
                <span className="ptrade-have">have {held(r)}</span>
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
                title={`Receive one more ${goodLabel(r)}`}
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

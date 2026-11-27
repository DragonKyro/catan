import { useState, type ReactNode } from 'react';
import type { Commodity, CommodityBank, PendingTrade, Player, Resource, ResourceBank, TradeGood } from '@/game/types';
import { COMMODITIES, RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { getBankTradeRate } from '@/game/actions/trade';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { TradeLane } from '@/ui/shared/TradeLane';
import { CoinIcon } from '@/ui/game/traders/TradersIcons';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { ckBankTradeRate, isCommodity } from '@/game/modules/citiesAndKnights/trade';
import { GoodChip, goodLabel } from '@/ui/dialogs/citiesAndKnights/common';
import { planBankTrade, type GoodCounts } from './bankTradePlan';
import './PlayerTradeDialog.css';

// A card in a trade: a resource, a commodity (Cities & Knights) or gold
// (T&B coins).
type Slot = TradeGood | 'gold';
type Counts = Partial<Record<Slot, number>>;

/**
 * A counter starts from the offer turned round: we ask for what they offered
 * and give what they asked for (only as much as we hold — the counter is
 * ours to adjust).
 */
function counterSeed(offer: PendingTrade, me: Player): { give: Counts; get: Counts } {
  const give: Counts = { gold: Math.min(offer.receiveGold ?? 0, me.gold ?? 0) };
  const get: Counts = { gold: offer.giveGold ?? 0 };
  for (const r of RESOURCES) {
    give[r] = Math.min(offer.receive[r] ?? 0, me.resources[r]);
    get[r] = offer.give[r] ?? 0;
  }
  for (const c of COMMODITIES) {
    give[c] = Math.min(offer.receiveCommodities?.[c] ?? 0, me.commodities?.[c] ?? 0);
    get[c] = offer.giveCommodities?.[c] ?? 0;
  }
  return { give, get };
}

/**
 * The trade window, docked just above the player's hand. Read top to
 * bottom: every card to ask for, the "You get" lane (arrow in), the "You
 * give" lane (arrow out), and the player's own cards to give from. Tapping a
 * card in a lane takes it back. The trade goes to the bank when it fits the
 * player's rates, or is offered to the table; `bankOnly` (paired-turn player
 * 2, Merchant Fleet) leaves out the offer, and opened from the offer
 * banner's Counter button it writes a counter-offer.
 */
export function PlayerTradeDialog({ bankOnly = false }: { bankOnly?: boolean }) {
  const { game, dispatch, dispatchAll, closeDialog } = useGameStore();
  // Opened by the offer banner's Counter button: who is countering. (The
  // acting player is still the one whose turn it is — the offer's proposer.)
  const counter = useGameStore((s) => s.tradeCounter);
  const pending = game?.pendingTrade ?? null;
  const isCounter = !bankOnly && !!counter && !!pending;
  const acting = game ? (isCounter ? counter.as : getActingPlayerId(game)) : null;
  const player = game?.players.find((p) => p.id === acting) ?? null;
  const [seed] = useState(() => (isCounter && player ? counterSeed(pending, player) : { give: {}, get: {} }));
  const [give, setGive] = useState<Counts>(seed.give);
  const [get, setGet] = useState<Counts>(seed.get);

  if (!game || !acting || !player) return null;
  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
  const goods: readonly TradeGood[] = hasCK ? [...RESOURCES, ...COMMODITIES] : RESOURCES;
  const slots: readonly Slot[] = game.coinsInPlay && !bankOnly ? [...goods, 'gold'] : goods;
  const held = (s: Slot) =>
    s === 'gold'
      ? (player.gold ?? 0)
      : isCommodity(s)
        ? (player.commodities?.[s as Commodity] ?? 0)
        : player.resources[s as Resource];
  const rateOf = (g: TradeGood) =>
    hasCK ? ckBankTradeRate(game, acting, g) : getBankTradeRate(game, acting, g as Resource);
  const supplyOf = (g: TradeGood) =>
    isCommodity(g) ? (game.commodityBank?.[g as Commodity] ?? 0) : game.bank[g as Resource];
  const n = (c: Counts, s: Slot) => c[s] ?? 0;
  // A bank-only window gives in whole lots: one tap puts in `rate` cards.
  const lot = (s: Slot) => (bankOnly && s !== 'gold' ? rateOf(s) : 1);
  const giving = slots.filter((s) => n(give, s) > 0);
  const getting = slots.filter((s) => n(get, s) > 0);

  const addGive = (s: Slot) => setGive((c) => ({ ...c, [s]: n(c, s) + lot(s) }));
  const dropGive = (s: Slot) => setGive((c) => ({ ...c, [s]: Math.max(0, n(c, s) - lot(s)) }));
  const addGet = (s: Slot) => setGet((c) => ({ ...c, [s]: n(c, s) + 1 }));
  const dropGet = (s: Slot) => setGet((c) => ({ ...c, [s]: Math.max(0, n(c, s) - 1) }));

  const goodsOnly = (c: Counts): GoodCounts =>
    Object.fromEntries(goods.filter((g) => n(c, g) > 0).map((g) => [g, n(c, g)]));
  // The bank completes the trade only EXACTLY at the player's rates: every
  // given good a multiple of its rate, those lots adding up to the cards
  // asked for (4 wheat → 1 ore at 4:1, 8 wood → 1 wheat + 1 sheep).
  const bankRoute = (() => {
    if (isCounter || n(give, 'gold') > 0 || n(get, 'gold') > 0) return null;
    const actions = planBankTrade(acting, goodsOnly(give), goodsOnly(get), rateOf, supplyOf);
    if (!actions) return null;
    const rates = new Set(giving.map((s) => rateOf(s as TradeGood)));
    return { actions, rate: rates.size === 1 ? [...rates][0]! : null };
  })();
  const canOffer = !bankOnly && giving.length > 0 && getting.length > 0;

  const toBank = () => {
    if (bankRoute) dispatchAll(bankRoute.actions);
    closeDialog();
  };
  const offer = () => {
    const resources = (c: Counts) =>
      Object.fromEntries(RESOURCES.filter((r) => n(c, r) > 0).map((r) => [r, n(c, r)])) as Partial<ResourceBank>;
    const commodities = (c: Counts) =>
      Object.fromEntries(COMMODITIES.filter((m) => n(c, m) > 0).map((m) => [m, n(c, m)])) as Partial<CommodityBank>;
    const fields = {
      give: resources(give),
      receive: resources(get),
      ...(n(give, 'gold') > 0 ? { giveGold: n(give, 'gold') } : {}),
      ...(n(get, 'gold') > 0 ? { receiveGold: n(get, 'gold') } : {}),
      ...(hasCK ? { giveCommodities: commodities(give), receiveCommodities: commodities(get) } : {}),
    };
    dispatch(
      isCounter
        ? { type: 'counterTrade', playerId: acting, ...fields }
        : { type: 'proposeTrade', playerId: acting, ...fields },
    );
    closeDialog();
  };

  const label = (s: Slot) => (s === 'gold' ? 'Gold' : goodLabel(s));
  const card = (s: Slot, count?: number): ReactNode =>
    s === 'gold' ? (
      <span className="rchip rchip-sm trade-gold">
        <CoinIcon size={14} />
        {count !== undefined && <span className="rchip-count">{count}</span>}
      </span>
    ) : (
      <GoodChip good={s} count={count} size="sm" />
    );
  const laneCard = (s: Slot, count: number, drop: (s: Slot) => void, verb: string) => (
    <button
      key={s}
      type="button"
      className="trade-lane-card"
      onClick={() => drop(s)}
      aria-label={`${verb} one less ${s}`}
      title={`Take back ${lot(s) > 1 && verb === 'Give' ? lot(s) : 'one'} ${label(s)}`}
    >
      {card(s, count)}
      <span className="trade-lane-x" aria-hidden>
        ×
      </span>
    </button>
  );
  const showRates = !isCounter;

  return (
    <DialogShell
      title={isCounter ? 'Counter the offer' : bankOnly ? 'Bank trade' : 'Trade'}
      onClose={closeDialog}
      footer={
        isCounter ? (
          <Button variant="primary" disabled={!canOffer} onClick={offer}>
            Send counter
          </Button>
        ) : (
          <>
            <Button
              variant={bankRoute ? 'primary' : 'secondary'}
              disabled={!bankRoute}
              onClick={toBank}
              title="Trade with the bank at your rates (shown under your cards)"
            >
              🏦 Bank{bankRoute?.rate ? ` (${bankRoute.rate}:1)` : ''}
            </Button>
            {!bankOnly && (
              <Button variant={bankRoute ? 'secondary' : 'primary'} disabled={!canOffer} onClick={offer}>
                Offer to players
              </Button>
            )}
          </>
        )
      }
    >
      <div className="trade">
        <div className="trade-pick" role="group" aria-label="Cards to ask for">
          <span className="trade-pick-caption">Ask for</span>
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              className="trade-pick-btn"
              onClick={() => addGet(s)}
              disabled={n(give, s) > 0}
              aria-label={`Get one ${s}`}
              title={`Ask for one ${label(s)}`}
            >
              {card(s)}
            </button>
          ))}
        </div>
        <TradeLane
          side="get"
          label="You get"
          cards={getting.map((s) => laneCard(s, n(get, s), dropGet, 'Get'))}
          empty="Tap what you want above"
        />
        <TradeLane
          side="give"
          label="You give"
          cards={giving.map((s) => laneCard(s, n(give, s), dropGive, 'Give'))}
          empty="Tap your cards below"
        />
        <div className="trade-pick" role="group" aria-label="Your cards">
          <span className="trade-pick-caption">Your cards</span>
          {slots.map((s) => {
            const left = held(s) - n(give, s);
            return (
              <button
                key={s}
                type="button"
                className="trade-pick-btn"
                onClick={() => addGive(s)}
                disabled={left < lot(s) || n(get, s) > 0}
                aria-label={lot(s) > 1 ? `Give ${lot(s)} ${s}` : `Give one ${s}`}
                title={`Give ${lot(s) > 1 ? lot(s) : 'one'} ${label(s)} (you have ${left} left)`}
              >
                {card(s, left)}
                {showRates && s !== 'gold' && <span className="trade-pick-rate">{rateOf(s)}:1</span>}
              </button>
            );
          })}
        </div>
      </div>
    </DialogShell>
  );
}

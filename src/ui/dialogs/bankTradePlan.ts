import type { Action, PlayerId, Resource, TradeGood } from '@/game/types';
import { isCommodity } from '@/game/modules/citiesAndKnights/trade';

export type GoodCounts = Partial<Record<TradeGood, number>>;

// Split a bank trade with any mix of goods on either side into the engine's
// one-good-for-one-good `bankTrade` / `bankTradeCK` actions. Every `rate`
// cards of a given good buy one card of any good, so the trade fits only
// when each given count is a multiple of its rate and those lots add up to
// the cards received. Null when it doesn't fit or the supply is short; the
// caller checks the player holds what they give.
export function planBankTrade(
  playerId: PlayerId,
  give: GoodCounts,
  receive: GoodCounts,
  rateOf: (good: TradeGood) => number,
  supplyOf: (good: TradeGood) => number,
): Action[] | null {
  const lots: TradeGood[] = [];
  for (const [good, n] of counts(give)) {
    const rate = rateOf(good);
    if (n % rate !== 0) return null;
    for (let i = 0; i < n / rate; i++) lots.push(good);
  }
  const cards: TradeGood[] = [];
  for (const [good, n] of counts(receive)) {
    if (give[good] || supplyOf(good) < n) return null;
    for (let i = 0; i < n; i++) cards.push(good);
  }
  if (lots.length === 0 || lots.length !== cards.length) return null;

  const parts = new Map<string, { give: TradeGood; receive: TradeGood; count: number }>();
  lots.forEach((g, i) => {
    const r = cards[i]!;
    const part = parts.get(`${g}>${r}`);
    if (part) part.count++;
    else parts.set(`${g}>${r}`, { give: g, receive: r, count: 1 });
  });
  return [...parts.values()].map(({ give: g, receive: r, count }) =>
    isCommodity(g) || isCommodity(r)
      ? { type: 'bankTradeCK', playerId, give: g, receive: r, count }
      : { type: 'bankTrade', playerId, give: g as Resource, receive: r as Resource, count },
  );
}

function counts(c: GoodCounts): Array<[TradeGood, number]> {
  return (Object.entries(c) as Array<[TradeGood, number]>).filter(([, n]) => n > 0);
}

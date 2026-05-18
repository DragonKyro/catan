import type { Commodity, CommodityBank } from './types';
import { COMMODITIES } from './types';

export function emptyCommodities(): CommodityBank {
  return { paper: 0, cloth: 0, coin: 0 };
}

export function commoditiesFull(amount: number): CommodityBank {
  return { paper: amount, cloth: amount, coin: amount };
}

export function totalCommodities(bank: CommodityBank): number {
  return bank.paper + bank.cloth + bank.coin;
}

export function canAffordCommodities(
  bank: CommodityBank,
  cost: Partial<CommodityBank>,
): boolean {
  for (const c of COMMODITIES) {
    if ((cost[c] ?? 0) > bank[c]) return false;
  }
  return true;
}

export function addCommodities(
  bank: CommodityBank,
  delta: Partial<CommodityBank>,
): CommodityBank {
  return {
    paper: bank.paper + (delta.paper ?? 0),
    cloth: bank.cloth + (delta.cloth ?? 0),
    coin: bank.coin + (delta.coin ?? 0),
  };
}

export function subtractCommodities(
  bank: CommodityBank,
  delta: Partial<CommodityBank>,
): CommodityBank {
  return {
    paper: bank.paper - (delta.paper ?? 0),
    cloth: bank.cloth - (delta.cloth ?? 0),
    coin: bank.coin - (delta.coin ?? 0),
  };
}

export function flattenCommodities(bank: CommodityBank): Commodity[] {
  const out: Commodity[] = [];
  for (const c of COMMODITIES) {
    for (let i = 0; i < bank[c]; i++) out.push(c);
  }
  return out;
}

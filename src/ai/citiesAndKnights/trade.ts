import type {
  Action,
  CommodityBank,
  GameState,
  PendingTrade,
  PlayerId,
  ResourceBank,
  TradeGood,
} from '@/game/types';
import { COMMODITIES, RESOURCES, TRACK_COMMODITY } from '@/game/types';
import { ckBankTradeRate } from '@/game/modules/citiesAndKnights/trade';
import { MAX_IMPROVEMENT_LEVEL } from '@/game/modules/citiesAndKnights/constants';
import { assessThreats } from '../threats';
import { commoditiesOf, firstLegal, playerById } from './common';
import { ckReportNeeds, focusTrack, isCommodity, unitValue, type CardKind } from './value';

// Commodity trades for the Cities & Knights AI: bank trades with a
// commodity on either side (`bankTradeCK`: 4:1, 3:1 generic harbor, 2:1 with
// the Trading House / Merchant Fleet) and judging player offers that
// include commodities.

function holding(state: GameState, playerId: PlayerId): Record<CardKind, number> {
  const p = playerById(state, playerId);
  return { ...p.resources, ...commoditiesOf(p) };
}

function supply(state: GameState, good: TradeGood): number {
  return isCommodity(good)
    ? (state.commodityBank ?? { paper: 0, cloth: 0, coin: 0 })[good]
    : state.bank[good];
}

// Value change of giving `n` of `give` for one `receive`, by the marginal
// card values (so the top of a big stack is cheap to give away).
function tradeGain(
  state: GameState,
  playerId: PlayerId,
  have: Record<CardKind, number>,
  give: CardKind,
  n: number,
  receive: CardKind,
): number {
  let lost = 0;
  for (let i = 0; i < n; i++) lost += unitValue(state, playerId, give, have[give] - i);
  return unitValue(state, playerId, receive, have[receive] + 1) - lost;
}

// A bank trade with a commodity in it, when it moves us toward the next
// improvement on our focus track or fills a resource our next build lacks.
export function tryCommodityTrade(state: GameState, playerId: PlayerId): Action | null {
  if (state.phase !== 'main') return null;
  const p = playerById(state, playerId);
  if (p.cities.length === 0) return null;
  const have = holding(state, playerId);
  const track = focusTrack(state, playerId);
  const level = p.improvements?.[track] ?? 0;
  const focus = TRACK_COMMODITY[track];
  const wants: CardKind[] = [];
  if (level < MAX_IMPROVEMENT_LEVEL) {
    const short = level + 1 - commoditiesOf(p)[focus];
    if (short >= 1 && short <= 2) wants.push(focus);
  }
  const needs = ckReportNeeds(state, playerId);
  for (const r of RESOURCES) if (needs.byResource[r] > 0) wants.push(r);
  if (wants.length === 0) return null;

  let best: { give: CardKind; receive: CardKind; gain: number } | null = null;
  for (const receive of wants) {
    if (supply(state, receive) <= 0) continue;
    for (const give of [...RESOURCES, ...COMMODITIES] as CardKind[]) {
      if (give === receive) continue;
      // Resource-for-resource is the base bank trade's job.
      if (!isCommodity(give) && !isCommodity(receive)) continue;
      // Never trade the commodity we're saving away.
      if (give === focus) continue;
      // Don't sell what the next build needs.
      if (!isCommodity(give) && needs.byResource[give] > 0) continue;
      const rate = ckBankTradeRate(state, playerId, give);
      if (have[give] < rate) continue;
      const gain = tradeGain(state, playerId, have, give, rate, receive);
      if (!best || gain > best.gain) best = { give, receive, gain };
    }
  }
  if (!best || best.gain <= 0.15) return null;
  return firstLegal(state, [{ type: 'bankTradeCK', playerId, give: best.give, receive: best.receive }]);
}

// ---------------------------------------------------------------------------
// Player offers with commodities
// ---------------------------------------------------------------------------

export function tradeHasCommodities(trade: PendingTrade): boolean {
  const any = (c: Partial<CommodityBank> | undefined) => COMMODITIES.some((k) => (c?.[k] ?? 0) > 0);
  return any(trade.giveCommodities) || any(trade.receiveCommodities);
}

// Accept an offer that includes commodities? We'd receive `give` (+ its
// commodities) and hand over `receive` (+ its commodities). Judged by the
// marginal card values, with a per-card charge for feeding a leader.
export function ckShouldAcceptTrade(state: GameState, playerId: PlayerId): boolean {
  const trade = state.pendingTrade;
  if (!trade || trade.proposerId === playerId) return false;
  const have = holding(state, playerId);
  const giveUp: Partial<Record<CardKind, number>> = {
    ...(trade.receive as Partial<ResourceBank>),
    ...(trade.receiveCommodities ?? {}),
  };
  const get: Partial<Record<CardKind, number>> = {
    ...(trade.give as Partial<ResourceBank>),
    ...(trade.giveCommodities ?? {}),
  };
  for (const [k, n] of Object.entries(giveUp) as Array<[CardKind, number]>) {
    if ((n ?? 0) > have[k]) return false;
  }
  let gain = 0;
  let cards = 0;
  const after = { ...have };
  for (const [k, n] of Object.entries(giveUp) as Array<[CardKind, number]>) {
    for (let i = 0; i < (n ?? 0); i++) {
      gain -= unitValue(state, playerId, k, after[k]);
      after[k]--;
      cards++;
    }
  }
  for (const [k, n] of Object.entries(get) as Array<[CardKind, number]>) {
    for (let i = 0; i < (n ?? 0); i++) {
      after[k]++;
      gain += unitValue(state, playerId, k, after[k]);
    }
  }
  const t = assessThreats(state)[trade.proposerId];
  if (t?.closeToWin) gain -= 4 * cards;
  else if (t?.isLeader) gain -= 1.2 * cards;
  return gain >= 0.3;
}

// Offer a spare resource (two if we're flush) for the one commodity our
// next improvement lacks, to the table. Once per turn, and only when some
// opponent's city produces that commodity.
export function tryProposeCommodityTrade(state: GameState, playerId: PlayerId): Action | null {
  if (state.phase !== 'main' || state.pendingTrade || state.tradesProposedThisTurn > 0) return null;
  const p = playerById(state, playerId);
  if (p.cities.length === 0) return null;
  const track = focusTrack(state, playerId);
  const level = p.improvements?.[track] ?? 0;
  if (level >= MAX_IMPROVEMENT_LEVEL) return null;
  const focus = TRACK_COMMODITY[track];
  if (level + 1 - commoditiesOf(p)[focus] !== 1) return null;
  const producers = state.players.some(
    (o) =>
      o.id !== playerId &&
      o.cities.some((v) =>
        (state.board.vertices[v]?.hexes ?? []).some(
          (h) => TRACK_COMMODITY[track] === commodityOfHex(state, h),
        ),
      ),
  );
  if (!producers) return null;
  const needs = ckReportNeeds(state, playerId);
  const have = holding(state, playerId);
  let give: CardKind | null = null;
  let low = Infinity;
  for (const r of RESOURCES) {
    if (have[r] === 0 || needs.byResource[r] > 0) continue;
    const v = unitValue(state, playerId, r, have[r]);
    if (v < low) {
      low = v;
      give = r;
    }
  }
  if (!give || isCommodity(give)) return null;
  const n = have[give] >= 3 ? 2 : 1;
  return firstLegal(state, [
    {
      type: 'proposeTrade',
      playerId,
      give: { [give]: n },
      receive: {},
      receiveCommodities: { [focus]: 1 },
    },
  ]);
}

function commodityOfHex(state: GameState, hexId: string): string | null {
  const t = state.board.hexes[hexId]?.terrain;
  return t === 'wood' ? 'paper' : t === 'sheep' ? 'cloth' : t === 'ore' ? 'coin' : null;
}

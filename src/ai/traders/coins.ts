import type { Action, GameState, PlayerId, Resource } from '@/game/types';
import { RESOURCES, COSTS } from '@/game/types';
import { totalResources } from '@/game/resources';
import { getBankTradeRate } from '@/game/actions/trade';
import {
  GOLD_PER_RESOURCE,
  MAX_GOLD_SPENDS_PER_TURN,
} from '@/game/modules/traders/constants';
import { canPlaceSettlement } from '@/game/placement';
import { reportNeeds, RESOURCE_WEIGHT } from '../value';
import { wealthVpSwing } from './gold';

// Heuristic coin play (Rivers of Catan, and any scenario with
// `state.coinsInPlay`). Gold is a currency for spending (2 gold = 1 card of
// choice, twice a turn) and, in Rivers, a scoreboard: the unique richest
// player gets +1 VP and everyone tied for poorest gets -2 VP.

// One coin action, or null. Spends gold on a missing card for the current
// build goal when that doesn't cost wealth-tile VP (or the build it finishes
// pays for it), and buys gold with spare cards when that escapes the Poor
// tile / takes Wealthiest, or protects a big hand from the next 7.
export function tryCoinAction(state: GameState, playerId: PlayerId): Action | null {
  if (!state.coinsInPlay || state.phase !== 'main') return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const gold = player.gold ?? 0;
  const needs = reportNeeds(state, playerId);

  // 1) Spend 2 gold for a card the current goal is short of.
  if (
    gold >= GOLD_PER_RESOURCE &&
    (state.goldSpendsThisTurn ?? 0) < MAX_GOLD_SPENDS_PER_TURN &&
    needs.goal !== 'none'
  ) {
    let want: Resource | null = null;
    let wantShort = 0;
    for (const r of RESOURCES) {
      const short = needs.byResource[r] ?? 0;
      if (short > wantShort && state.bank[r] > 0) {
        wantShort = short;
        want = r;
      }
    }
    if (want) {
      const swing = wealthVpSwing(state, playerId, -GOLD_PER_RESOURCE);
      const shortfall = RESOURCES.reduce((s, r) => s + (needs.byResource[r] ?? 0), 0);
      const finishesVpBuild =
        shortfall <= 1 &&
        ((needs.goal === 'city' && player.settlements.length > 0) ||
          (needs.goal === 'settlement' && hasSettlementSpot(state, playerId)));
      // A finished city / settlement is +1 VP: worth losing Wealthiest
      // (-1) for the production, never worth dropping into Poor (-2).
      if (swing === 0 || (swing >= -1 && finishesVpBuild)) {
        return { type: 'spendGold', playerId, resource: want };
      }
    }
  }

  // 2) Buy gold with spare cards.
  const gain = wealthVpSwing(state, playerId, 1);
  const handSize = totalResources(player.resources);
  const discardRisk = handSize >= 8;
  if (gain <= 0 && !discardRisk) return null;
  let best: { give: Resource; score: number } | null = null;
  for (const r of RESOURCES) {
    const rate = getBankTradeRate(state, playerId, r);
    const spare = player.resources[r] - reserveFor(state, playerId, r);
    if (spare < rate) continue;
    // Cheapest card value given away wins.
    const cost = rate * RESOURCE_WEIGHT[r];
    const score = gain * 2.5 + (discardRisk ? 1.5 : 0) - cost * (gain > 0 ? 0.5 : 0.35);
    if (score > 0 && (!best || score > best.score)) best = { give: r, score };
  }
  return best ? { type: 'buyGold', playerId, give: best.give } : null;
}

// Cards of `r` to keep for the build we're working toward (the cheapest of
// city / settlement / road that the hand covers or nearly covers).
function reserveFor(state: GameState, playerId: PlayerId, r: Resource): number {
  const player = state.players.find((p) => p.id === playerId)!;
  const hand = player.resources;
  for (const cost of [COSTS.city, COSTS.settlement, COSTS.bridge, COSTS.road]) {
    let short = 0;
    for (const res of RESOURCES) short += Math.max(0, (cost[res] ?? 0) - hand[res]);
    if (short <= 1) return cost[r] ?? 0;
  }
  return 0;
}

function hasSettlementSpot(state: GameState, playerId: PlayerId): boolean {
  const player = state.players.find((p) => p.id === playerId)!;
  if (player.settlements.length >= 5) return false;
  return state.board.vertexIds.some((v) => canPlaceSettlement(state, playerId, v));
}

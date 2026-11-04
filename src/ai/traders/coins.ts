import type { Action, GameState, PlayerId, Resource } from '@/game/types';
import { RESOURCES, COSTS } from '@/game/types';
import { totalResources } from '@/game/resources';
import { getBankTradeRate } from '@/game/actions/trade';
import { recalcWealthTiles } from '@/game/modules/traders/scoring/wealthTiles';
import {
  GOLD_PER_RESOURCE,
  MAX_GOLD_SPENDS_PER_TURN,
  POOR_CATANIAN_VP,
  WEALTHIEST_CATANIAN_VP,
} from '@/game/modules/traders/constants';
import { canPlaceSettlement } from '@/game/placement';
import { reportNeeds, RESOURCE_WEIGHT } from '../value';

// Heuristic coin play (Rivers of Catan, and any scenario with
// `state.coinsInPlay`). Gold is a currency for spending (2 gold = 1 card of
// choice, twice a turn) and, in Rivers, a scoreboard: the unique richest
// player gets +1 VP and everyone tied for poorest gets -2 VP.

// VP change for `playerId` from the wealth tiles if their gold moved by
// `delta` (0 outside Rivers).
export function wealthVpSwing(state: GameState, playerId: PlayerId, delta: number): number {
  if (!state.wealthTiles) return 0;
  const before = wealthVp(state.wealthTiles, playerId);
  const players = state.players.map((p) =>
    p.id === playerId ? { id: p.id, gold: Math.max(0, (p.gold ?? 0) + delta) } : { id: p.id, gold: p.gold ?? 0 },
  );
  const after = wealthVp(recalcWealthTiles({ players }), playerId);
  return after - before;
}

function wealthVp(tiles: { wealthiest: PlayerId | null; poor: PlayerId[] }, pid: PlayerId): number {
  let vp = 0;
  if (tiles.wealthiest === pid) vp += WEALTHIEST_CATANIAN_VP;
  if (tiles.poor.includes(pid)) vp += POOR_CATANIAN_VP;
  return vp;
}

// Value of `delta` more gold for this player in vertex-score units: half a
// card per coin (2 gold buy a card), plus the wealth-tile swing. Tile swings
// are discounted because the race moves every turn.
export function goldValue(state: GameState, playerId: PlayerId, delta: number): number {
  return 0.6 * delta + 1.2 * wealthVpSwing(state, playerId, delta);
}

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

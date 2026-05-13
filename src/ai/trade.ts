import type {
  GameState,
  PlayerId,
  Resource,
  ResourceBank,
  ProposeTradeAction,
} from '@/game/types';
import { RESOURCES } from '@/game/types';
import { handValue, partialValue, reportNeeds, RESOURCE_WEIGHT } from './value';

// Strict-positive acceptance threshold to avoid swap-noise trades.
const ACCEPT_THRESHOLD = 0.5;

export function shouldAcceptTrade(state: GameState, playerId: PlayerId): boolean {
  const trade = state.pendingTrade;
  if (!trade) return false;
  if (trade.proposerId === playerId) return false;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  // Must have what proposer asked for
  for (const r of RESOURCES) {
    if ((trade.receive[r] ?? 0) > player.resources[r]) return false;
  }
  const before = handValue(player);
  // After we accept: lose `receive`, gain `give`
  const afterValue = before - partialValue(trade.receive) + partialValue(trade.give);
  // Boost the perceived gain if the incoming resource hits one of our needs.
  const needs = reportNeeds(state, playerId);
  let needBonus = 0;
  for (const r of RESOURCES) {
    if (needs.byResource[r] > 0 && (trade.give[r] ?? 0) > 0) {
      needBonus += needs.byResource[r] * 0.6;
    }
  }
  return afterValue + needBonus - before >= ACCEPT_THRESHOLD;
}

// Try to propose a useful 1-for-1 trade. Returns null if no compelling
// offer exists or if no opponent would rationally accept.
// AI proposes at most one trade per turn — after a cancelled proposal the
// situation is unchanged and we'd otherwise re-propose forever.
const MAX_AI_PROPOSALS_PER_TURN = 1;

export function tryProposeTrade(
  state: GameState,
  playerId: PlayerId,
): ProposeTradeAction | null {
  if (state.pendingTrade) return null; // can't propose if one is already open
  if (state.tradesProposedThisTurn >= MAX_AI_PROPOSALS_PER_TURN) return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const needs = reportNeeds(state, playerId);
  if (needs.goal === 'none') return null;

  // What do we need?
  const wantList: Resource[] = [];
  for (const r of RESOURCES) {
    if (needs.byResource[r] > 0) wantList.push(r);
  }
  if (wantList.length === 0) return null;

  // What can we give? Anything we have a lot of (≥ 2) AND don't need.
  const giveList: Resource[] = [];
  for (const r of RESOURCES) {
    if (needs.byResource[r] > 0) continue; // don't give what we need
    if (player.resources[r] >= 2) giveList.push(r);
  }
  if (giveList.length === 0) return null;

  // Try each give-want pair; pick the one most likely to be accepted.
  let best: { give: Resource; receive: Resource; score: number } | null = null;
  for (const want of wantList) {
    for (const give of giveList) {
      if (give === want) continue;
      // Does any opponent both have `want` and find this trade profitable?
      let anyAccepts = false;
      for (const op of state.players) {
        if (op.id === playerId) continue;
        if (op.resources[want] < 1) continue;
        // Their hand-value delta if they accepted
        const delta =
          RESOURCE_WEIGHT[give] - RESOURCE_WEIGHT[want];
        if (delta >= 0) {
          anyAccepts = true;
          break;
        }
      }
      if (!anyAccepts) continue;
      // Our gain
      const ourGain =
        (RESOURCE_WEIGHT[want] - RESOURCE_WEIGHT[give]) +
        needs.byResource[want] * 0.6; // big bonus when this resource is needed
      if (ourGain <= 0) continue;
      if (!best || ourGain > best.score) {
        best = { give, receive: want, score: ourGain };
      }
    }
  }
  if (!best) return null;
  return {
    type: 'proposeTrade',
    playerId,
    give: { [best.give]: 1 } as Partial<ResourceBank>,
    receive: { [best.receive]: 1 } as Partial<ResourceBank>,
  };
}

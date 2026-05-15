import type {
  GameState,
  PlayerId,
  Resource,
  ResourceBank,
  ProposeTradeAction,
  CounterTradeAction,
} from '@/game/types';
import { RESOURCES } from '@/game/types';
import { handValue, partialValue, reportNeeds } from './value';

// Threshold for accepting a trade as-is. Lower than before so AI doesn't
// stonewall reasonable swaps — colonist.io's AI accepts pretty liberally.
const ACCEPT_THRESHOLD = 0.0;

// Score a trade from the perspective of the player who'd receive `give`
// in exchange for losing `receive`. Positive = beneficial.
function tradeScore(
  state: GameState,
  playerId: PlayerId,
  give: Partial<ResourceBank>,
  receive: Partial<ResourceBank>,
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return -Infinity;
  // Must have what we'd give up
  for (const r of RESOURCES) {
    if ((receive[r] ?? 0) > player.resources[r]) return -Infinity;
  }
  const before = handValue(player);
  const after = before - partialValue(receive) + partialValue(give);
  const needs = reportNeeds(state, playerId);
  let needBonus = 0;
  for (const r of RESOURCES) {
    if (needs.byResource[r] > 0 && (give[r] ?? 0) > 0) {
      // Cap at the actual amount we'd be receiving (no double-counting beyond it).
      const helps = Math.min(needs.byResource[r], give[r] ?? 0);
      needBonus += helps * 0.7;
    }
  }
  // Mild penalty if we're giving up something we actually need.
  let needPenalty = 0;
  for (const r of RESOURCES) {
    if (needs.byResource[r] > 0 && (receive[r] ?? 0) > 0) {
      needPenalty += Math.min(needs.byResource[r], receive[r] ?? 0) * 0.7;
    }
  }
  return after + needBonus - needPenalty - before;
}

export function shouldAcceptTrade(state: GameState, playerId: PlayerId): boolean {
  const trade = state.pendingTrade;
  if (!trade) return false;
  if (trade.proposerId === playerId) return false;
  return tradeScore(state, playerId, trade.give, trade.receive) >= ACCEPT_THRESHOLD;
}

// If the trade isn't acceptable as-is, try small edits (±1 to one resource on
// either side) to find a counter-offer that *would* be acceptable to us AND
// would still be plausibly acceptable to the original proposer. Returns null
// if no improving tweak exists.
export function tryCounterTrade(
  state: GameState,
  playerId: PlayerId,
): CounterTradeAction | null {
  const trade = state.pendingTrade;
  if (!trade) return null;
  if (trade.proposerId === playerId) return null;
  // If we'd already accept, no counter needed.
  if (shouldAcceptTrade(state, playerId)) return null;
  const proposer = state.players.find((p) => p.id === trade.proposerId);
  const me = state.players.find((p) => p.id === playerId);
  if (!proposer || !me) return null;

  // Generate candidate tweaks. We're considering changes to either side
  // by ±1. The counter swaps perspective: in the counter action, `give`
  // is what *we* (the counterer) offer; `receive` is what we ask for.
  // The original `trade.give` was offered to us; we treat it as the
  // amount the original proposer is willing to give. The original
  // `trade.receive` is what they wanted.
  let best: { give: Partial<ResourceBank>; receive: Partial<ResourceBank>; myScore: number; theirScore: number } | null = null;
  const baseGive = { ...trade.receive }; // what we'll give them (their original ask)
  const baseRecv = { ...trade.give }; // what we'll ask back (their original offer)

  const tweaks: Array<{ res: Resource; side: 'give' | 'receive'; delta: number }> = [];
  for (const r of RESOURCES) {
    tweaks.push({ res: r, side: 'give', delta: -1 });
    tweaks.push({ res: r, side: 'receive', delta: 1 });
  }

  // Helper: deep clone of a partial bank.
  const clone = (b: Partial<ResourceBank>) => ({ ...b });

  // Evaluate all single-edit tweaks (edit distance 1).
  for (const t1 of tweaks) {
    const give = clone(baseGive);
    const recv = clone(baseRecv);
    const target = t1.side === 'give' ? give : recv;
    const cur = target[t1.res] ?? 0;
    const next = cur + t1.delta;
    if (next < 0) continue;
    target[t1.res] = next;
    // No-op: both sides must total > 0
    if (totalOf(give) === 0 || totalOf(recv) === 0) continue;
    // No mirror: same-resource both sides means a pure +N/-N which is silly
    let mirrored = false;
    for (const r of RESOURCES) {
      if ((give[r] ?? 0) > 0 && (recv[r] ?? 0) > 0) {
        mirrored = true;
        break;
      }
    }
    if (mirrored) continue;
    // We must have the resources we're offering
    let canAfford = true;
    for (const r of RESOURCES) {
      if ((give[r] ?? 0) > me.resources[r]) {
        canAfford = false;
        break;
      }
    }
    if (!canAfford) continue;
    // Proposer must have what we're asking for
    let theyHave = true;
    for (const r of RESOURCES) {
      if ((recv[r] ?? 0) > proposer.resources[r]) {
        theyHave = false;
        break;
      }
    }
    if (!theyHave) continue;
    // Would this be acceptable to us?
    const myScore = tradeScore(state, playerId, recv, give);
    if (myScore < ACCEPT_THRESHOLD) continue;
    // Would proposer plausibly accept? Use their own perspective.
    const theirScore = tradeScore(state, proposer.id, give, recv);
    if (theirScore < -0.2) continue;
    if (!best || myScore + theirScore > best.myScore + best.theirScore) {
      best = { give, receive: recv, myScore, theirScore };
    }
  }
  if (!best) return null;
  return {
    type: 'counterTrade',
    playerId,
    give: best.give,
    receive: best.receive,
  };
}

function totalOf(b: Partial<ResourceBank>): number {
  let t = 0;
  for (const r of RESOURCES) t += b[r] ?? 0;
  return t;
}

// Try to propose a useful 1-for-1 (or 2-for-1) trade. Returns null if no
// compelling offer exists or if no opponent would rationally accept.
const MAX_AI_PROPOSALS_PER_TURN = 2;

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

  // What can we give? Anything we have at all AND don't need (or have plenty of).
  const giveList: Array<{ res: Resource; available: number }> = [];
  for (const r of RESOURCES) {
    if (needs.byResource[r] > 0) continue; // don't give what we need
    if (player.resources[r] >= 1) giveList.push({ res: r, available: player.resources[r] });
  }
  if (giveList.length === 0) return null;

  type Candidate = {
    give: Partial<ResourceBank>;
    receive: Partial<ResourceBank>;
    ourScore: number;
    theirBestScore: number;
  };
  let best: Candidate | null = null;

  // Try 1-for-1 and 2-for-1 offers.
  const offers: Array<{ giveAmt: 1 | 2; recvAmt: 1 }> = [
    { giveAmt: 1, recvAmt: 1 },
    { giveAmt: 2, recvAmt: 1 },
  ];

  for (const want of wantList) {
    for (const g of giveList) {
      if (g.res === want) continue;
      for (const o of offers) {
        if (g.available < o.giveAmt) continue;
        const give: Partial<ResourceBank> = { [g.res]: o.giveAmt } as Partial<ResourceBank>;
        const receive: Partial<ResourceBank> = { [want]: o.recvAmt } as Partial<ResourceBank>;
        const ourScore = tradeScore(state, playerId, receive, give);
        if (ourScore <= 0) continue;
        // Is there any opponent who plausibly accepts? Use their actual hand.
        let theirBest = -Infinity;
        for (const op of state.players) {
          if (op.id === playerId) continue;
          if (op.resources[want] < o.recvAmt) continue;
          const s = tradeScore(state, op.id, give, receive);
          if (s > theirBest) theirBest = s;
        }
        if (theirBest < -0.2) continue;
        const total = ourScore + Math.max(0, theirBest);
        if (!best || total > best.ourScore + Math.max(0, best.theirBestScore)) {
          best = { give, receive, ourScore, theirBestScore: theirBest };
        }
      }
    }
  }
  if (!best) return null;
  // Prefer cheaper trades when scores are close (avoid offering 2 when 1 works).
  return {
    type: 'proposeTrade',
    playerId,
    give: best.give,
    receive: best.receive,
  };
}

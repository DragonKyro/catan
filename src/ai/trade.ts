import type {
  GameState,
  PlayerId,
  Resource,
  ResourceBank,
  ProposeTradeAction,
  CounterTradeAction,
} from '@/game/types';
import { RESOURCES, COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { handValue, partialValue, reportNeeds, pipsByResource } from './value';
import { assessThreats, isRival } from './threats';

// Threshold for accepting a trade as-is. Lower than before so AI doesn't
// stonewall reasonable swaps — colonist.io's AI accepts pretty liberally.
const ACCEPT_THRESHOLD = 0.0;
// Per-resource penalty when handing a "dangerous" resource to a threatening
// opponent. Set high enough that a normal 1:1 swap becomes unattractive
// (typical trade-score deltas are 1-3); doesn't make us paranoid, but
// flat-out refuses near-win trades.
const DANGEROUS_RESOURCE_PENALTY = 2.5;
// Multiplier applied to that penalty when the opponent is on the brink of
// winning the game (within 2 VP of the target). This effectively vetoes
// the trade.
const WIN_THREAT_MULTIPLIER = 3;

// "Did this player already touch any of these resources via trade THIS
// turn?" — used to reject reverse/roundabout trades. If player just
// received ore, don't propose giving ore back. If player just gave ore,
// don't propose receiving ore (the trade should have been done as a
// direct A→C instead of A→B then B→C).
function tradeWouldReverse(
  state: GameState,
  playerId: PlayerId,
  give: Partial<ResourceBank>,
  receive: Partial<ResourceBank>,
): boolean {
  const log = state.tradeResourcesThisTurn?.[playerId];
  if (!log) return false;
  const givenBefore = new Set(log.given);
  const receivedBefore = new Set(log.received);
  for (const r of RESOURCES) {
    if ((give[r] ?? 0) > 0 && receivedBefore.has(r)) return true;
    if ((receive[r] ?? 0) > 0 && givenBefore.has(r)) return true;
  }
  return false;
}

// Per-card scarcity bonuses by how many production pips we generate.
// A resource we produce ZERO of is one we'll have to trade for over and
// over — much more valuable to receive (and more costly to lose) than
// the linear handValue/RESOURCE_WEIGHT model captures on its own.
//
// Pips here are summed over all 36 dice outcomes (probabilityDots × hex
// multiplier). 0 = no production at all; 1-2 = at most one weak token;
// 3-4 = a typical mid-pip token; 5+ = strong production.
const SCARCITY_BONUS_NONE = 1.4;   // 0 pips
const SCARCITY_BONUS_WEAK = 0.6;   // 1-2 pips
// 3+ pips: no scarcity bonus (we have steady access).

function scarcityWeight(pips: number): number {
  if (pips === 0) return SCARCITY_BONUS_NONE;
  if (pips < 3) return SCARCITY_BONUS_WEAK;
  return 0;
}

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
  // FUTURE-NEED bias: even if the current goal doesn't need this
  // resource, we'll need it down the line if we never produce it.
  // Receiving a low-production resource is worth more than the linear
  // value; giving away one we can barely replace is worse than the
  // linear value would suggest. This is what stops the AI from happily
  // trading away its only wheat-producing surplus for a third surplus
  // of wood.
  const pips = pipsByResource(state, playerId);
  let futureBonus = 0;
  for (const r of RESOURCES) {
    const w = scarcityWeight(pips[r]);
    if (w === 0) continue;
    futureBonus += (give[r] ?? 0) * w;     // receiving scarce = good
    futureBonus -= (receive[r] ?? 0) * w;  // giving scarce away = bad
  }
  return after + needBonus - needPenalty + futureBonus - before;
}

// Penalty for giving `resources` to a known-threatening opponent. Bigger
// for win-threats; bonus-race threats still earn a meaningful penalty.
// `resources` is what WE would be giving up (which they would receive).
// `actorId` is the player evaluating the trade (used to detect rivalries
// between actor and recipient).
function threatPenaltyForGiving(
  state: GameState,
  actorId: PlayerId,
  recipientId: PlayerId,
  resources: Partial<ResourceBank>,
): number {
  const threats = assessThreats(state);
  const t = threats[recipientId];
  let penalty = 0;
  // Per-resource danger penalty (existing logic).
  if (t && t.dangerousResources.size > 0) {
    const mult = t.closeToWin ? WIN_THREAT_MULTIPLIER : 1;
    for (const r of RESOURCES) {
      const amt = resources[r] ?? 0;
      if (amt > 0 && t.dangerousResources.has(r)) {
        penalty += amt * DANGEROUS_RESOURCE_PENALTY * mult;
      }
    }
  }
  // Rivalry flat penalty: if we're in a direct LA / LR race with this
  // player, every card we hand them is one more card they can spend
  // racing us. Refuse most trades with rivals; the only exceptions are
  // when our score is so positive that even a heavy penalty leaves it
  // worth doing (e.g., they're offering 3 of something for 1 of ours).
  if (isRival(state, actorId, recipientId)) {
    let totalGiven = 0;
    for (const r of RESOURCES) totalGiven += resources[r] ?? 0;
    penalty += totalGiven * 1.5;
  }
  return penalty;
}

export function shouldAcceptTrade(state: GameState, playerId: PlayerId): boolean {
  const trade = state.pendingTrade;
  if (!trade) return false;
  if (trade.proposerId === playerId) return false;
  // From acceptor's perspective: we'd GIVE trade.receive, RECEIVE trade.give.
  // Refuse if accepting would reverse our own earlier trades this turn.
  if (tradeWouldReverse(state, playerId, trade.receive, trade.give)) return false;
  // Standard "is this swap valuable to me" score.
  const score = tradeScore(state, playerId, trade.give, trade.receive);
  // Threat penalty: accepting means we GIVE `trade.receive` to the proposer.
  // If giving them those resources advances their win, refuse the trade.
  const penalty = threatPenaltyForGiving(state, playerId, trade.proposerId, trade.receive);
  return score - penalty >= ACCEPT_THRESHOLD;
}

// When the proposer looks desperate (the trade would let them immediately
// build a settle/city, OR they're asking for a resource they don't produce
// at all), counter with ONE extra card on the receive side instead of
// accepting. They'll usually still take it — the alternative is bank-
// trading 4:1 or waiting many turns. We capture the upside instead of
// blindly accepting the proposer's preferred ratio.
export function tryExtractCounter(
  state: GameState,
  playerId: PlayerId,
): CounterTradeAction | null {
  const trade = state.pendingTrade;
  if (!trade) return null;
  if (trade.proposerId === playerId) return null;
  // Only fires when we'd already accept the original — this is value
  // extraction, not a way to refuse trades.
  if (!shouldAcceptTrade(state, playerId)) return null;

  const proposer = state.players.find((p) => p.id === trade.proposerId);
  if (!proposer) return null;

  // Desperation A: accepting this trade would put the proposer over the
  // top on a settlement or city RIGHT NOW. They badly want to close.
  const proposerAfterOriginal: ResourceBank = { ...proposer.resources };
  for (const r of RESOURCES) {
    proposerAfterOriginal[r] -= trade.give[r] ?? 0;
    proposerAfterOriginal[r] += trade.receive[r] ?? 0;
  }
  const completesSettle = canAfford(proposerAfterOriginal, COSTS.settlement);
  const completesCity = canAfford(proposerAfterOriginal, COSTS.city);
  const completesBuild = completesSettle || completesCity;

  // Desperation B: they're asking for a resource they produce 0 pips of —
  // they can't roll it themselves so a worse ratio still beats waiting.
  const proposerPips = pipsByResource(state, proposer.id);
  let wantsScarce = false;
  for (const r of RESOURCES) {
    if ((trade.receive[r] ?? 0) > 0 && proposerPips[r] === 0) {
      wantsScarce = true;
      break;
    }
  }

  if (!completesBuild && !wantsScarce) return null;

  // Find the BEST extra card to ask for. Prefer a resource we'd value
  // most receiving (our own tradeScore picks this up), subject to the
  // proposer actually having one more to give.
  let bestExtra: Resource | null = null;
  let bestExtraOurScore = -Infinity;
  for (const r of RESOURCES) {
    const alreadyOffered = trade.give[r] ?? 0;
    if (proposer.resources[r] <= alreadyOffered) continue;
    const tryReceive: Partial<ResourceBank> = { ...trade.give };
    tryReceive[r] = alreadyOffered + 1;
    const ourScore = tradeScore(state, playerId, tryReceive, trade.receive);
    if (ourScore > bestExtraOurScore) {
      bestExtraOurScore = ourScore;
      bestExtra = r;
    }
  }
  if (!bestExtra) return null;

  // The counter: we still give them what they asked for, but ask for
  // their original offer + 1 extra card of bestExtra.
  const greedyReceive: Partial<ResourceBank> = { ...trade.give };
  greedyReceive[bestExtra] = (greedyReceive[bestExtra] ?? 0) + 1;

  // Would the proposer plausibly accept this less-favorable deal?
  // From their perspective: they'd receive trade.receive (unchanged
  // from what they originally asked for) and pay greedyReceive (one
  // card more than they originally offered). Use their tradeScore with
  // a small tolerance — desperate proposers swallow somewhat-worse
  // ratios because the alternative is no trade at all.
  const proposerScore = tradeScore(
    state,
    proposer.id,
    trade.receive,
    greedyReceive,
  );
  const proposerTolerance = completesBuild ? -1.5 : -0.8;
  if (proposerScore < proposerTolerance) return null;

  return {
    type: 'counterTrade',
    playerId,
    give: { ...trade.receive },
    receive: greedyReceive,
  };
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
    let weCanAfford = true;
    for (const r of RESOURCES) {
      if ((give[r] ?? 0) > me.resources[r]) {
        weCanAfford = false;
        break;
      }
    }
    if (!weCanAfford) continue;
    // Proposer must have what we're asking for
    let theyHave = true;
    for (const r of RESOURCES) {
      if ((recv[r] ?? 0) > proposer.resources[r]) {
        theyHave = false;
        break;
      }
    }
    if (!theyHave) continue;
    // Skip counters that would reverse our own earlier trades this turn.
    if (tradeWouldReverse(state, playerId, give, recv)) continue;
    // Would this be acceptable to us? (Includes threat penalty: we don't
    // want to counter into a deal that hands a leader the win.)
    const proposerPenalty = threatPenaltyForGiving(state, playerId, proposer.id, give);
    const myScore = tradeScore(state, playerId, recv, give) - proposerPenalty;
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

// Convenience: a *favorable* trade is one where (a) the ratio is 2:1
// (clearly beneficial to both parties), and (b) the best plausible
// acceptor isn't a threat. Used to prefer player trades over bank trades
// when one is obviously good; reduces "AI just bank-trades constantly."
export function tryProposeFavorableTrade(
  state: GameState,
  playerId: PlayerId,
): ProposeTradeAction | null {
  return tryProposeTradeInternal(state, playerId, { onlyFavorable: true });
}

export function tryProposeTrade(
  state: GameState,
  playerId: PlayerId,
): ProposeTradeAction | null {
  return tryProposeTradeInternal(state, playerId, { onlyFavorable: false });
}

function tryProposeTradeInternal(
  state: GameState,
  playerId: PlayerId,
  opts: { onlyFavorable: boolean },
): ProposeTradeAction | null {
  if (state.pendingTrade) return null; // can't propose if one is already open
  if (state.tradesProposedThisTurn >= MAX_AI_PROPOSALS_PER_TURN) return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const needs = reportNeeds(state, playerId);
  const pips = pipsByResource(state, playerId);

  // What do we want? Currently-needed resources first, AND resources we
  // produce zero of (we'll need them eventually for SOMETHING, so it's
  // worth asking now while we have surplus to offer). If we have no
  // immediate need and no production gaps, there's no useful trade.
  const wantList: Resource[] = [];
  for (const r of RESOURCES) {
    if (needs.byResource[r] > 0) wantList.push(r);
    else if (pips[r] === 0 && player.resources[r] === 0) wantList.push(r);
  }
  if (wantList.length === 0) return null;

  // What can we give? Anything we have AND don't currently need AND
  // produce enough of that one card off the top isn't crippling. The
  // "produce enough" guard is what keeps us from offering away our
  // only access to a resource (e.g., trading away a single wheat when
  // we have no wheat hex).
  const giveList: Array<{ res: Resource; available: number }> = [];
  for (const r of RESOURCES) {
    if (needs.byResource[r] > 0) continue; // don't give what we need
    if (player.resources[r] < 1) continue;
    // Don't trade away our only card of a resource we can't replace.
    if (pips[r] === 0 && player.resources[r] <= 1) continue;
    giveList.push({ res: r, available: player.resources[r] });
  }
  if (giveList.length === 0) return null;

  type Candidate = {
    give: Partial<ResourceBank>;
    receive: Partial<ResourceBank>;
    ourScore: number;
    theirBestScore: number;
    ratio: number; // give/receive count ratio — 2.0 = 2:1, 1.0 = 1:1
  };
  let best: Candidate | null = null;

  const threats = assessThreats(state);

  // Already-proposed shapes this turn (whether accepted, rejected, or
  // cancelled). We won't re-propose the same shape — opponents' hands
  // didn't change, so the second attempt would just stall the game.
  const priorShapes = state.proposedTradesThisTurn?.[playerId] ?? [];
  const sameShape = (
    give: Partial<ResourceBank>,
    receive: Partial<ResourceBank>,
  ): boolean => {
    for (const shape of priorShapes) {
      let match = true;
      for (const r of RESOURCES) {
        if ((shape.give[r] ?? 0) !== (give[r] ?? 0)) {
          match = false;
          break;
        }
        if ((shape.receive[r] ?? 0) !== (receive[r] ?? 0)) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  };

  // Evaluate a candidate (give, receive). Updates `best` if it's the new
  // top-ranked offer. Returns void; the only mutation is `best`.
  const evalCandidate = (give: Partial<ResourceBank>, receive: Partial<ResourceBank>): void => {
    // Skip reverse / roundabout trades within the same turn.
    if (tradeWouldReverse(state, playerId, give, receive)) return;
    // Skip re-proposing the exact same shape we already tried this turn.
    if (sameShape(give, receive)) return;
    // We must have what we'd give.
    for (const r of RESOURCES) {
      if ((give[r] ?? 0) > player.resources[r]) return;
      // Don't propose giving away a resource we actually need for our goal.
      if ((give[r] ?? 0) > 0 && (needs.byResource[r] ?? 0) > 0) return;
    }
    const ourScore = tradeScore(state, playerId, receive, give);
    if (ourScore <= 0) return;
    // Find the BEST non-threat opponent who'd plausibly accept.
    let theirBest = -Infinity;
    for (const op of state.players) {
      if (op.id === playerId) continue;
      // They must have what we're asking for.
      let canFulfill = true;
      for (const r of RESOURCES) {
        if ((receive[r] ?? 0) > op.resources[r]) {
          canFulfill = false;
          break;
        }
      }
      if (!canFulfill) continue;
      // Rivalry filter: if this opponent is racing us for LA or LR,
      // skip them entirely. We don't want to fuel a rival's economy.
      if (isRival(state, playerId, op.id)) continue;
      let s = tradeScore(state, op.id, give, receive);
      // Threat penalty.
      const t = threats[op.id];
      if (t) {
        let dangerCount = 0;
        for (const r of RESOURCES) {
          if ((give[r] ?? 0) > 0 && t.dangerousResources.has(r)) {
            dangerCount += give[r] ?? 0;
          }
        }
        if (dangerCount > 0) {
          const mult = t.closeToWin ? WIN_THREAT_MULTIPLIER : 1;
          s -= dangerCount * DANGEROUS_RESOURCE_PENALTY * mult;
        }
      }
      if (s > theirBest) theirBest = s;
    }
    if (theirBest < -0.2) return;
    if (opts.onlyFavorable && theirBest < 0.5) return;
    const totalGive = totalOf(give);
    const totalRecv = totalOf(receive);
    const ratio = totalGive / Math.max(1, totalRecv);
    // Strong bias for >=2:1 ratios — clearly fair-to-both, less back-and-forth.
    const ratioBonus = ratio >= 2 ? 1.5 : 0;
    const total = ourScore + Math.max(0, theirBest) + ratioBonus;
    const incumbentBonus = best ? (best.ratio >= 2 ? 1.5 : 0) : 0;
    const incumbentTotal = best
      ? best.ourScore + Math.max(0, best.theirBestScore) + incumbentBonus
      : -Infinity;
    if (total > incumbentTotal) {
      best = { give, receive, ourScore, theirBestScore: theirBest, ratio };
    }
  };

  // === Single-resource offers ===
  // 1:1 and 2:1 — the bread and butter. `onlyFavorable` mode restricts
  // to 2:1 (called BEFORE bank trade as a "clearly mutually good" filter).
  const singleOffers: Array<{ giveAmt: 1 | 2; recvAmt: 1 }> = opts.onlyFavorable
    ? [{ giveAmt: 2, recvAmt: 1 }]
    : [
        { giveAmt: 1, recvAmt: 1 },
        { giveAmt: 2, recvAmt: 1 },
      ];

  for (const want of wantList) {
    for (const g of giveList) {
      if (g.res === want) continue;
      for (const o of singleOffers) {
        if (g.available < o.giveAmt) continue;
        evalCandidate(
          { [g.res]: o.giveAmt } as Partial<ResourceBank>,
          { [want]: o.recvAmt } as Partial<ResourceBank>,
        );
      }
    }
  }

  // === Creative multi-resource offers ===
  // Only outside `onlyFavorable` mode (creative trades are less obviously
  // good for the acceptor, so we don't use them as the "skip the bank"
  // signal). Tried only when we have enough surplus to make them work.
  if (!opts.onlyFavorable) {
    for (const want of wantList) {
      // 3-of-same → 1 (basically a bank-style trade with a player)
      for (const g of giveList) {
        if (g.res === want) continue;
        if (g.available < 3) continue;
        evalCandidate(
          { [g.res]: 3 } as Partial<ResourceBank>,
          { [want]: 1 } as Partial<ResourceBank>,
        );
      }
      // 2-of-different → 1 (offload two different surplus resources)
      for (let i = 0; i < giveList.length; i++) {
        for (let j = i + 1; j < giveList.length; j++) {
          const g1 = giveList[i]!;
          const g2 = giveList[j]!;
          if (g1.res === want || g2.res === want) continue;
          if (g1.available < 1 || g2.available < 1) continue;
          evalCandidate(
            { [g1.res]: 1, [g2.res]: 1 } as Partial<ResourceBank>,
            { [want]: 1 } as Partial<ResourceBank>,
          );
        }
      }
      // 3-of-different → 1 (clear out a wide surplus for the one resource
      // we really need — very generous to the acceptor)
      for (let i = 0; i < giveList.length; i++) {
        for (let j = i + 1; j < giveList.length; j++) {
          for (let k = j + 1; k < giveList.length; k++) {
            const g1 = giveList[i]!;
            const g2 = giveList[j]!;
            const g3 = giveList[k]!;
            if (g1.res === want || g2.res === want || g3.res === want) continue;
            if (g1.available < 1 || g2.available < 1 || g3.available < 1) continue;
            evalCandidate(
              { [g1.res]: 1, [g2.res]: 1, [g3.res]: 1 } as Partial<ResourceBank>,
              { [want]: 1 } as Partial<ResourceBank>,
            );
          }
        }
      }
    }
  }

  if (!best) return null;
  const winner = best as Candidate;
  return {
    type: 'proposeTrade',
    playerId,
    give: winner.give,
    receive: winner.receive,
  };
}

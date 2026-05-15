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
import { assessThreats } from './threats';

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

// Penalty for giving `resources` to a known-threatening opponent. Bigger
// for win-threats; bonus-race threats still earn a meaningful penalty.
// `resources` is what WE would be giving up (which they would receive).
function threatPenaltyForGiving(
  state: GameState,
  recipientId: PlayerId,
  resources: Partial<ResourceBank>,
): number {
  const threats = assessThreats(state);
  const t = threats[recipientId];
  if (!t) return 0;
  if (t.dangerousResources.size === 0) return 0;
  let penalty = 0;
  const mult = t.closeToWin ? WIN_THREAT_MULTIPLIER : 1;
  for (const r of RESOURCES) {
    const amt = resources[r] ?? 0;
    if (amt > 0 && t.dangerousResources.has(r)) {
      penalty += amt * DANGEROUS_RESOURCE_PENALTY * mult;
    }
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
  const penalty = threatPenaltyForGiving(state, trade.proposerId, trade.receive);
  return score - penalty >= ACCEPT_THRESHOLD;
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
    // Skip counters that would reverse our own earlier trades this turn.
    if (tradeWouldReverse(state, playerId, give, recv)) continue;
    // Would this be acceptable to us? (Includes threat penalty: we don't
    // want to counter into a deal that hands a leader the win.)
    const proposerPenalty = threatPenaltyForGiving(state, proposer.id, give);
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
    ratio: number; // give/receive count ratio — 2.0 = 2:1, 1.0 = 1:1
  };
  let best: Candidate | null = null;

  const threats = assessThreats(state);

  // Evaluate a candidate (give, receive). Updates `best` if it's the new
  // top-ranked offer. Returns void; the only mutation is `best`.
  const evalCandidate = (give: Partial<ResourceBank>, receive: Partial<ResourceBank>): void => {
    // Skip reverse / roundabout trades within the same turn.
    if (tradeWouldReverse(state, playerId, give, receive)) return;
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

// Catan learned agent — what one seat has been able to work out from the
// public history of the game: a card counter, plus the dev-card and dice
// record a human at the table would remember.
//
// GameState carries no history, so knowledge is folded forward one action at
// a time: `observeTransition(k, before, action, after)` after every applied
// action (or `knowledgeFromHistory` to replay a whole log). The tracker reads
// both states in full, but only keeps what the viewer saw happen:
//
//   public    production, setup grants, builds, dev-card buys (the cost, not
//             the card), bank and player trades, discards, year of plenty,
//             monopoly (which reveals every victim's exact count), and a
//             trade offer (which shows the offerer holds what they offer).
//   private   a steal is seen only by thief and victim. Anyone else learns
//             that one card moved, not which.
//   hidden    which dev cards anyone bought, the deck order, the RNG.
//
// Hands are tracked as a weighted set of joint hypotheses over every seat's
// hand — exact Bayesian card counting. A hidden steal splits each hypothesis
// by what the victim could have lost (weighted by how many of each they
// held). Every later public change is applied to every hypothesis and those
// that go negative are dropped, so a thief who then builds a city with
// "their" stolen ore collapses the guess, just as a human would conclude.
// The viewer's own hand is always exact.
//
// Knowledge must start at game creation (every hand empty, so every hand
// known). Starting from a mid-game state would mean guessing hands.

import type { Action, DevCardType, GameState, PlayerId } from '@/game/types';
import { COSTS, RESOURCES } from '@/game/types';
import { applyAction } from '@/game/engine';

export type PlayableDev = Exclude<DevCardType, 'victoryPoint'>;
export const PLAYABLE_DEV: readonly PlayableDev[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly'];
export const DEV_TYPES: readonly DevCardType[] = [...PLAYABLE_DEV, 'victoryPoint'];

const R = RESOURCES.length;

/** Joint hypotheses kept; the least likely are dropped past this. Peaks seen
 *  over 30 heuristic games: ~200 at 4 players, ~360 at 6, ~1300 at 8. */
export const MAX_HYPOTHESES = 2048;

export interface HandHypothesis {
  /** Row per seat (`playerIds` order) × column per resource (RESOURCES order). */
  hands: number[];
  /** Probability; weights sum to 1. */
  weight: number;
}

export interface CatanKnowledge {
  viewerId: PlayerId;
  /** `state.players` order — the row order of every hypothesis. */
  playerIds: PlayerId[];
  hypotheses: HandHypothesis[];
  /** The starting dev deck's make-up (public: it's the rulebook's). */
  devDeckTotals: Record<DevCardType, number>;
  /** Dev cards bought, per seat. */
  devBought: number[];
  /** Dev cards played face-up, per seat. */
  devPlayed: Array<Record<PlayableDev, number>>;
  /** Every dice total rolled, in order. */
  rolls: number[];
  /** Steals the viewer saw happen but not the card of. */
  hiddenSteals: number;
  /** Hypotheses dropped by the MAX_HYPOTHESES cap (approximation, not error). */
  dropped: number;
  /** Times every hypothesis was ruled out and one had to be patched — a tracking bug if ever non-zero. */
  repairs: number;
}

export interface HandEstimate {
  /** Expected count per resource. */
  mean: number[];
  /** P(count ≥ 1), P(count ≥ 2) per resource. */
  atLeast1: number[];
  atLeast2: number[];
  /** P(the hand covers) road, settlement, city, dev card. */
  afford: number[];
  /** Probability of the single most likely hand (1 = known exactly). */
  certainty: number;
}

export const AFFORD_COSTS = [COSTS.road, COSTS.settlement, COSTS.city, COSTS.devCard].map((c) =>
  RESOURCES.map((r) => c[r] ?? 0),
);

export function initialKnowledge(state: GameState, viewerId: PlayerId): CatanKnowledge {
  if (!state.players.some((p) => p.id === viewerId)) throw new Error(`knowledge: ${viewerId} is not seated`);
  for (const p of state.players) {
    if (RESOURCES.some((r) => p.resources[r] !== 0)) {
      throw new Error('knowledge must start at game creation (every hand empty); replay history instead');
    }
  }
  const devDeckTotals = { knight: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0, victoryPoint: 0 };
  for (const c of state.devCardDeck) devDeckTotals[c] += 1;
  return {
    viewerId,
    playerIds: state.players.map((p) => p.id),
    hypotheses: [{ hands: new Array<number>(state.players.length * R).fill(0), weight: 1 }],
    devDeckTotals,
    devBought: state.players.map(() => 0),
    devPlayed: state.players.map(() => ({ knight: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 })),
    rolls: [],
    hiddenSteals: 0,
    dropped: 0,
    repairs: 0,
  };
}

/** Replay a whole game log (e.g. logStore's initialState + actions) into one seat's knowledge. */
export function knowledgeFromHistory(initial: GameState, actions: readonly Action[], viewerId: PlayerId): CatanKnowledge {
  let k = initialKnowledge(initial, viewerId);
  let s = initial;
  for (const a of actions) {
    const next = applyAction(s, a);
    k = observeTransition(k, s, a, next);
    s = next;
  }
  return k;
}

interface Constraint {
  seat: number;
  resource: number;
  /** After the change the count must be exactly / at least this. */
  exactly?: number;
  atLeast?: number;
}

/** Fold one applied action into the viewer's knowledge. Pure; returns a new object. */
export function observeTransition(
  k: CatanKnowledge,
  before: GameState,
  action: Action,
  after: GameState,
): CatanKnowledge {
  const seatOf = (id: PlayerId) => {
    const i = k.playerIds.indexOf(id);
    if (i === -1) throw new Error(`knowledge: unknown player ${id}`);
    return i;
  };
  const actor = seatOf(action.playerId);
  let next: CatanKnowledge = k;
  const edit = () => (next === k ? (next = { ...k }) : next);

  switch (action.type) {
    case 'rollDice':
      if (after.lastRoll) edit().rolls = [...k.rolls, after.lastRoll.total];
      break;
    case 'buyDevCard':
      edit().devBought = k.devBought.map((n, i) => (i === actor ? n + 1 : n));
      break;
    case 'playKnight':
    case 'playRoadBuilding':
    case 'playYearOfPlenty':
    case 'playMonopoly': {
      const card: PlayableDev = action.type === 'playKnight' ? 'knight'
        : action.type === 'playRoadBuilding' ? 'roadBuilding'
          : action.type === 'playYearOfPlenty' ? 'yearOfPlenty' : 'monopoly';
      edit().devPlayed = k.devPlayed.map((d, i) => (i === actor ? { ...d, [card]: d[card] + 1 } : d));
      break;
    }
  }

  const n = k.playerIds.length;
  const delta = new Array<number>(n * R).fill(0);
  let changed = false;
  for (let i = 0; i < n; i++) {
    const b = before.players.find((p) => p.id === k.playerIds[i])!.resources;
    const a = after.players.find((p) => p.id === k.playerIds[i])!.resources;
    for (let r = 0; r < R; r++) {
      const d = a[RESOURCES[r]!] - b[RESOURCES[r]!];
      delta[i * R + r] = d;
      if (d !== 0) changed = true;
    }
  }
  const totals = k.playerIds.map((id) => {
    const res = after.players.find((p) => p.id === id)!.resources;
    return RESOURCES.reduce((s, r) => s + res[r], 0);
  });
  const viewer = seatOf(k.viewerId);
  const own = after.players.find((p) => p.id === k.viewerId)!.resources;
  const ownHand = RESOURCES.map((r) => own[r]);

  if (action.type === 'moveRobber' && action.stealFrom !== null && changed) {
    const victim = seatOf(action.stealFrom);
    if (viewer !== actor && viewer !== victim) {
      const n2 = edit();
      n2.hiddenSteals = k.hiddenSteals + 1;
      return withHypotheses(n2, hiddenSteal(k.hypotheses, actor, victim), k.hypotheses, delta, totals, viewer, ownHand);
    }
  }

  const constraints: Constraint[] = [];
  if (action.type === 'playMonopoly') {
    const r = RESOURCES.indexOf(action.resource);
    for (let i = 0; i < n; i++) if (i !== actor) constraints.push({ seat: i, resource: r, exactly: 0 });
  }
  if (action.type === 'proposeTrade' || action.type === 'counterTrade') {
    RESOURCES.forEach((res, r) => {
      const want = action.give[res] ?? 0;
      if (want > 0) constraints.push({ seat: actor, resource: r, atLeast: want });
    });
  }
  if (!changed && constraints.length === 0) return next;
  return withHypotheses(edit(), publicChange(k.hypotheses, delta, constraints), k.hypotheses, delta, totals, viewer, ownHand);
}

function publicChange(hs: HandHypothesis[], delta: number[], constraints: Constraint[]): HandHypothesis[] {
  const out: HandHypothesis[] = [];
  outer: for (const h of hs) {
    const hands = h.hands.map((c, i) => c + delta[i]!);
    for (const c of hands) if (c < 0) continue outer;
    for (const c of constraints) {
      const v = hands[c.seat * R + c.resource]!;
      if (c.exactly !== undefined && v !== c.exactly) continue outer;
      if (c.atLeast !== undefined && v < c.atLeast) continue outer;
    }
    out.push({ hands, weight: h.weight });
  }
  return out;
}

/** One card moved victim → thief, unseen: branch on which, weighted by the victim's holding. */
function hiddenSteal(hs: HandHypothesis[], thief: number, victim: number): HandHypothesis[] {
  const out: HandHypothesis[] = [];
  for (const h of hs) {
    let total = 0;
    for (let r = 0; r < R; r++) total += h.hands[victim * R + r]!;
    if (total === 0) continue;
    for (let r = 0; r < R; r++) {
      const have = h.hands[victim * R + r]!;
      if (have === 0) continue;
      const hands = h.hands.slice();
      hands[victim * R + r]! -= 1;
      hands[thief * R + r]! += 1;
      out.push({ hands, weight: (h.weight * have) / total });
    }
  }
  return out;
}

function withHypotheses(
  k: CatanKnowledge,
  candidates: HandHypothesis[],
  prior: HandHypothesis[],
  delta: number[],
  totals: number[],
  viewer: number,
  ownHand: number[],
): CatanKnowledge {
  let hs = candidates;
  if (hs.length === 0) {
    // Nothing fits what was seen — only possible if some card movement wasn't
    // reported. Patch the likeliest prior guess to match the public totals.
    hs = [repair(prior, delta, totals)];
    k.repairs += 1;
  }
  // The viewer's own row is always exact.
  for (const h of hs) for (let r = 0; r < R; r++) h.hands[viewer * R + r] = ownHand[r]!;
  const merged = new Map<string, HandHypothesis>();
  for (const h of hs) {
    const key = h.hands.join(',');
    const seen = merged.get(key);
    if (seen) seen.weight += h.weight;
    else merged.set(key, { hands: h.hands, weight: h.weight });
  }
  let out = [...merged.values()];
  if (out.length > MAX_HYPOTHESES) {
    out.sort((a, b) => b.weight - a.weight);
    k.dropped += out.length - MAX_HYPOTHESES;
    out = out.slice(0, MAX_HYPOTHESES);
  }
  const total = out.reduce((s, h) => s + h.weight, 0);
  for (const h of out) h.weight = total > 0 ? h.weight / total : 1 / out.length;
  k.hypotheses = out;
  return k;
}

function repair(prior: HandHypothesis[], delta: number[], totals: number[]): HandHypothesis {
  const best = prior.reduce((a, b) => (b.weight > a.weight ? b : a));
  const hands = best.hands.map((c, i) => Math.max(0, c + delta[i]!));
  totals.forEach((target, seat) => {
    const row = hands.slice(seat * R, seat * R + R);
    let sum = row.reduce((s, c) => s + c, 0);
    while (sum !== target) {
      // Add to / take from the largest pile — a guess, but totals stay right.
      let r = 0;
      for (let j = 1; j < R; j++) if (row[j]! > row[r]!) r = j;
      row[r]! += sum < target ? 1 : -1;
      sum += sum < target ? 1 : -1;
    }
    for (let j = 0; j < R; j++) hands[seat * R + j] = row[j]!;
  });
  return { hands, weight: 1 };
}

/** What the viewer can infer about each hand, by seat (`playerIds` order). */
export function estimateHands(k: CatanKnowledge): HandEstimate[] {
  const n = k.playerIds.length;
  const out: HandEstimate[] = [];
  for (let seat = 0; seat < n; seat++) {
    const mean = new Array<number>(R).fill(0);
    const atLeast1 = new Array<number>(R).fill(0);
    const atLeast2 = new Array<number>(R).fill(0);
    const afford = new Array<number>(AFFORD_COSTS.length).fill(0);
    const marginal = new Map<string, number>();
    for (const h of k.hypotheses) {
      const row = h.hands.slice(seat * R, seat * R + R);
      for (let r = 0; r < R; r++) {
        mean[r]! += h.weight * row[r]!;
        if (row[r]! >= 1) atLeast1[r]! += h.weight;
        if (row[r]! >= 2) atLeast2[r]! += h.weight;
      }
      AFFORD_COSTS.forEach((cost, j) => {
        if (cost.every((c, r) => row[r]! >= c)) afford[j]! += h.weight;
      });
      const key = row.join(',');
      marginal.set(key, (marginal.get(key) ?? 0) + h.weight);
    }
    out.push({ mean, atLeast1, atLeast2, afford, certainty: Math.max(...marginal.values()) });
  }
  return out;
}

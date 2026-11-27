// Catan learned agent — how close each seat is to winning, worked out from
// what's public (encoder v3).
//
// A strong player doesn't read the leader off the scoreboard: five
// settlements with no ore can be stuck at 7 while two cities on ore / wheat /
// sheep at 5 are about to run away. So for every seat this estimates, from
// its production, pieces left, open corners, hand (the card counter's guess
// for opponents) and face-down dev cards:
//
//   points     permanent (buildings), temporary (Longest Road / Largest Army)
//              and expected (public + what its hidden dev cards likely hold),
//   soon       the chance it reaches the target by the end of its next turn,
//   options    turns to its next point by each route — a settlement (roads
//              to the nearest open corner + the settlement), a city, VP dev
//              cards, Longest Road, Largest Army (knights in hand count),
//   eta        turns to the target, taking the cheapest route first each time,
//   plans      every minimal way to reach the target (how many new
//              settlements, cities, VP cards, and whether Longest Road /
//              Largest Army), each costed as a whole — the cards it needs,
//              turned into turns with the seat's income — so a greedy path
//              into a dead end isn't the only view: the best plan's turns,
//              how far behind the next best is, how many plans are close to
//              the best (options still open), and which routes those
//              near-best plans use (a route in most of them keeps options
//              open; one in only one is a gamble),
//
// and for each open corner how many turns each seat needs to settle it, so
// the viewer sees which races it wins and which roads lead into a cut-off.
// Turns are rounds of the table; a seat earns every round from every roll.
// Pure function of the observation and its board facts.

import { RESOURCES } from '@/game/types';
import { probabilityDots } from '../value';
import type { BoardFacts } from './encode';
import type { CatanObservation, ObservedPlayer } from './observation';

/** Road-distance bucket meaning "4 or more roads / unreachable" (encode.ts's FAR). */
export const DIST_FAR = 4;
const R = RESOURCES.length;
const MAX_SETTLEMENTS = 5;
const MAX_CITIES = 4;
const MAX_ROADS = 15;
// RESOURCES order: wood, brick, sheep, wheat, ore.
const ROAD = [1, 1, 0, 0, 0];
const SETTLEMENT = [1, 1, 1, 1, 0];
const CITY = [0, 0, 0, 2, 3];
const DEV = [0, 0, 1, 1, 1];
/** Turns reported for a route that's closed (no piece, spot or card left). */
export const NEVER = 30;
const ETA_CAP = 40;

export const PLAN_OPTIONS = ['settlement', 'city', 'devVp', 'longestRoad', 'largestArmy'] as const;
/** Points each route gives. */
const GAIN = [1, 1, 1, 2, 2];

export interface SeatPlan {
  permVp: number;
  tempVp: number;
  expVp: number;
  /** P(it reaches the target by the end of its next turn). */
  soon: number;
  /** Turns to the next point by each PLAN_OPTIONS route (NEVER if closed). */
  options: number[];
  /** Turns to the target, cheapest route first (capped). */
  eta: number;
  /** Turns until the seat's own turn starts (0 while it's playing). */
  delay: number;
  /** Turns to settle a corner `d` roads away, d = 0..3 (NEVER without a settlement piece). */
  settleTurns: number[];
  plans: WinPlans;
}

/** Every minimal winning combination, costed whole (see the header). */
export interface WinPlans {
  /** Turns for the best plan (NEVER when none can reach the target). */
  best: number;
  /** ... the second best (NEVER if there's only one). */
  second: number;
  /** Plans within NEAR_TURNS of the best, the best included. */
  near: number;
  /** Per PLAN_OPTIONS route: the share of near-best plans that use it. */
  share: number[];
  /** The best plan: new settlements, cities, VP cards, Longest Road (0/1), Largest Army (0/1). */
  bestMix: number[];
}

/** "Close to the best" for keeping options open, in turns. */
export const NEAR_TURNS = 3;
const NO_PLANS: WinPlans = { best: NEVER, second: NEVER, near: 0, share: [0, 0, 0, 0, 0], bestMix: [0, 0, 0, 0, 0] };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Pips per resource from settlements (×1) and cities (×2), robber hex excluded. */
function pips(obs: CatanObservation, p: ObservedPlayer): number[] {
  const out = new Array<number>(R).fill(0);
  const add = (v: string, mult: number) => {
    for (const h of obs.board.vertices[v]!.hexes) {
      if (h === obs.board.robberHex) continue;
      const hex = obs.board.hexes[h]!;
      const r = RESOURCES.indexOf(hex.terrain as (typeof RESOURCES)[number]);
      if (r >= 0) out[r]! += probabilityDots(hex.numberToken) * mult;
    }
  };
  for (const v of p.settlements) add(v, 1);
  for (const v of p.cities) add(v, 2);
  return out;
}

/** Turns for a seat with this income to gather `cost` on top of `hand`. */
function collectTurns(cost: number[], hand: number[], income: number[], rate: number[]): number {
  const short = cost.map((c, r) => Math.max(0, c - hand[r]!));
  const total = sum(short);
  if (total <= 1e-9) return 0;
  const all = sum(income);
  let worst = total / Math.max(all, 0.05);
  for (let r = 0; r < R; r++) {
    if (short[r]! <= 1e-9) continue;
    // Its own income of r, plus about half its other income traded in at its rate.
    let eff = income[r]!;
    for (let s = 0; s < R; s++) if (s !== r) eff += (0.5 * income[s]!) / rate[s]!;
    worst = Math.max(worst, short[r]! / Math.max(eff, 0.05));
  }
  return Math.min(NEVER, worst);
}

/** P(X ≥ t) for X ~ Hypergeometric(population N, K successes, n draws). */
function atLeast(t: number, N: number, K: number, n: number): number {
  if (t <= 0) return 1;
  if (n <= 0 || K <= 0 || N <= 0 || t > Math.min(n, K)) return 0;
  // pmf(x) = C(K,x) C(N-K,n-x) / C(N,n), built up from x = max(0, n-(N-K)).
  const lo = Math.max(0, n - (N - K));
  const logC = (a: number, b: number) => {
    let s = 0;
    for (let i = 1; i <= b; i++) s += Math.log((a - b + i) / i);
    return s;
  };
  const total = logC(N, n);
  let p = 0;
  for (let x = Math.max(lo, t); x <= Math.min(n, K); x++) p += Math.exp(logC(K, x) + logC(N - K, n - x) - total);
  return Math.min(1, p);
}

/** Facts every seat's plan shares. */
interface Shared {
  n: number;
  target: number;
  unseen: number;
  pVp: number;
  pKnight: number;
  routes: number[];
  knights: number[];
  lrHold: number;
  laHold: number;
}

function sharedFacts(obs: CatanObservation): Shared {
  const unseen = sum(Object.values(obs.unseenDev));
  return {
    n: obs.playerCount,
    target: obs.vpToWin,
    unseen,
    pVp: unseen > 0 ? obs.unseenDev.victoryPoint / unseen : 0,
    pKnight: unseen > 0 ? obs.unseenDev.knight / unseen : 0,
    routes: obs.players.map((p) => p.longestRoad),
    knights: obs.players.map((p) => p.played.knight),
    lrHold: Math.max(5, obs.longestRoad ? obs.longestRoad.length + 1 : 5),
    laHold: Math.max(3, obs.largestArmy ? obs.largestArmy.size + 1 : 3),
  };
}

/** One seat's economy and hidden-card estimates. */
interface Seat {
  k: number;
  p: ObservedPlayer;
  mine: boolean;
  /** Expected cards per resource per round of the table. */
  income: number[];
  rate: number[];
  hand: number[];
  delay: number;
  hiddenVp: number;
  expVp: number;
  /** Knights it holds (exact for the viewer, expected for others). */
  knightsHeld: number;
}

function seatOf(obs: CatanObservation, sh: Shared, k: number): Seat {
  const p = obs.players[k]!;
  const mine = k === 0;
  const n = sh.n;
  const held = p.devCardCount;
  const hiddenVp = mine ? p.devCards!.victoryPoints : held * sh.pVp;
  return {
    k,
    p,
    mine,
    income: pips(obs, p).map((x) => (x / 36) * n),
    rate: RESOURCES.map((r) => (p.ports.includes(r) ? 2 : p.ports.includes('generic') ? 3 : 4)),
    hand: mine ? RESOURCES.map((r) => p.hand![r]) : p.estimate.mean.slice(),
    delay: obs.currentOffset === k ? 0 : ((k - obs.currentOffset + n) % n) / n,
    hiddenVp,
    expVp: mine ? p.trueVp! : p.publicVp + hiddenVp,
    knightsHeld: mine ? p.devCards!.playable.knight + p.devCards!.boughtThisTurn.knight : held * sh.pKnight,
  };
}

/** Where a seat's win plans start from: now, or after a build it's weighing (`buildGains`). */
interface Position {
  income: number[];
  hand: number[];
  /** Road distances to the open corners it can reach, nearest first. */
  spots: number[];
  settlements: number;
  cities: number;
  roads: number;
  /** Points gained over the seat's expected points. */
  points: number;
  delay: number;
}

function planFrom(obs: CatanObservation, sh: Shared, seat: Seat, pos: Position): WinPlans {
  const { p, k, mine } = seat;
  return winPlans({
    need: Math.ceil(sh.target - seat.expVp - pos.points - 1e-9),
    spots: pos.spots,
    settlementsOnBoard: pos.settlements,
    cities: pos.cities,
    roadsLeft: MAX_ROADS - pos.roads,
    vpCardsLeft: obs.devDeckSize > 0 ? Math.max(0, Math.floor(obs.unseenDev.victoryPoint - (mine ? 0 : seat.hiddenVp))) : 0,
    pVp: sh.pVp,
    pKnight: sh.pKnight,
    lrRoads: p.hasLongestRoad ? null : sh.lrHold - sh.routes[k]!,
    laKnights: p.hasLargestArmy ? null : sh.laHold - sh.knights[k]!,
    knightsHeld: seat.knightsHeld,
    turns: (cost) => collectTurns(cost, pos.hand, pos.income, seat.rate),
    delay: pos.delay,
  });
}

/** Road distances from a seat's network to every open corner it can reach, nearest first. */
function spotsFrom(b: BoardFacts, dist: ArrayLike<number>): number[] {
  const spots: number[] = [];
  for (let v = 0; v < b.idx.vertexIds.length; v++) if (b.open[v] === 1 && dist[v]! < DIST_FAR) spots.push(dist[v]!);
  return spots.sort((a, c) => a - c);
}

export function seatPlans(obs: CatanObservation, b: BoardFacts): SeatPlan[] {
  const sh = sharedFacts(obs);
  const { target, unseen, pVp, pKnight, routes, knights, lrHold, laHold } = sh;

  return obs.players.map((p, k) => {
    const seat = seatOf(obs, sh, k);
    const { mine, income, rate, hand, delay, hiddenVp, expVp, knightsHeld } = seat;
    const turns = (cost: number[], from: number[] = hand) => collectTurns(cost, from, income, rate);

    const permVp = p.settlements.length + 2 * p.cities.length;
    const tempVp = (p.hasLongestRoad ? 2 : 0) + (p.hasLargestArmy ? 2 : 0);
    const held = p.devCardCount;

    // Corners it could settle: road distance to each open one.
    const spots = spotsFrom(b, b.dist[k]!);
    const settlementsLeft = MAX_SETTLEMENTS - p.settlements.length;
    const settleTurns = [0, 1, 2, 3].map((d) =>
      settlementsLeft > 0 && p.roads.length + d <= MAX_ROADS
        ? delay + turns(SETTLEMENT.map((c, r) => c + d * ROAD[r]!)) : NEVER);

    // One route's next point from `from` cards in hand; NEVER when closed.
    const option = (j: number, from: number[], s: { settle: number; cities: number; vpCards: number; lr: boolean; la: boolean }) => {
      switch (j) {
        case 0: {
          if (s.settle >= spots.length || settlementsLeft - s.settle <= 0) return NEVER;
          const d = spots[s.settle]!;
          return turns(SETTLEMENT.map((c, r) => c + d * ROAD[r]!), from);
        }
        case 1:
          return s.cities > 0 ? turns(CITY, from) : NEVER;
        case 2: {
          if (obs.devDeckSize <= 0 || s.vpCards <= 0 || pVp <= 0) return NEVER;
          return turns(DEV.map((c) => c / pVp), from);
        }
        case 3: {
          if (!s.lr) return NEVER;
          const need = lrHold - routes[k]!;
          if (need <= 0 || p.roads.length + need > MAX_ROADS) return NEVER;
          return turns(ROAD.map((c) => c * need), from);
        }
        case 4: {
          if (!s.la) return NEVER;
          const need = laHold - knights[k]!;
          if (need <= 0) return NEVER;
          const buy = Math.max(0, need - knightsHeld);
          if (buy > 0 && pKnight <= 0) return NEVER;
          // One knight a turn, and the cards for the ones still to buy.
          return Math.max(need - 1, buy > 0 ? turns(DEV.map((c) => (c * buy) / pKnight), from) : 0);
        }
      }
      return NEVER;
    };

    const start = {
      settle: 0,
      cities: Math.min(MAX_CITIES - p.cities.length, p.settlements.length),
      vpCards: Math.max(0, obs.unseenDev.victoryPoint - (mine ? 0 : hiddenVp)),
      lr: !p.hasLongestRoad,
      la: !p.hasLargestArmy,
    };
    const options = PLAN_OPTIONS.map((_, j) => Math.min(NEVER, delay + option(j, hand, start)));

    // Cheapest route first until the target: the hand pays for the first.
    let vp = expVp;
    let eta = delay;
    const s = { ...start };
    let from = hand;
    for (let step = 0; step < 14 && vp < target && eta < ETA_CAP; step++) {
      let best = -1;
      let bestCost = Infinity;
      for (let j = 0; j < PLAN_OPTIONS.length; j++) {
        const t = option(j, from, s);
        if (t >= NEVER) continue;
        const per = t / Math.min(GAIN[j]!, target - vp);
        if (per < bestCost) {
          bestCost = per;
          best = j;
        }
      }
      if (best < 0) {
        eta = ETA_CAP;
        break;
      }
      eta += option(best, from, s);
      vp += GAIN[best]!;
      if (best === 0) {
        s.settle += 1;
        s.cities = Math.min(s.cities + 1, MAX_CITIES - p.cities.length);
      } else if (best === 1) s.cities -= 1;
      else if (best === 2) s.vpCards -= 1;
      else if (best === 3) s.lr = false;
      else s.la = false;
      from = [0, 0, 0, 0, 0];
    }
    eta = Math.min(ETA_CAP, eta);

    // Reaching the target on its next turn: hidden VP cards, plus one build now if it can afford it.
    const missing = target - p.publicVp;
    let soon: number;
    if (mine) {
      const canBuild = obs.decision?.type === 'main'
        && (b.canCity.some((x) => x === 1) && covers(hand, CITY) || b.canSettle.some((x) => x === 1) && covers(hand, SETTLEMENT));
      soon = p.trueVp! + (canBuild ? 1 : 0) >= target ? 1 : 0;
    } else {
      const afford = Math.max(
        p.settlements.length > 0 && p.cities.length < MAX_CITIES ? p.estimate.afford[2]! : 0,
        spots.length > 0 && spots[0] === 0 && settlementsLeft > 0 ? p.estimate.afford[1]! : 0,
      );
      const vpUnseen = obs.unseenDev.victoryPoint;
      soon = afford * atLeast(missing - 1, unseen, vpUnseen, held) + (1 - afford) * atLeast(missing, unseen, vpUnseen, held);
    }
    // Every minimal way to the target, costed whole.
    const plans = planFrom(obs, sh, seat, {
      income, hand, spots, settlements: p.settlements.length, cities: p.cities.length, roads: p.roads.length, points: 0, delay,
    });
    return { permVp, tempVp, expVp, soon, options, eta, delay, settleTurns, plans };
  });
}

/** Per resource: pips of the hexes at corner `v`, robber hex excluded. */
function cornerPips(obs: CatanObservation, b: BoardFacts, v: number): number[] {
  const out = new Array<number>(R).fill(0);
  for (let j = 0; j < 3; j++) {
    const h = b.idx.vertexHexes[v * 3 + j]!;
    if (h < 0 || h === b.robberHex) continue;
    const hex = obs.board.hexes[b.idx.hexIds[h]!]!;
    const r = RESOURCES.indexOf(hex.terrain as (typeof RESOURCES)[number]);
    if (r >= 0) out[r]! += probabilityDots(hex.numberToken);
  }
  return out;
}

/** Roads needed from corner `from` to every vertex (bucketed 0..DIST_FAR), as distances() does for a network. */
function distFrom(b: BoardFacts, from: number, offset: number): Int8Array {
  const idx = b.idx;
  const dist = new Int8Array(idx.vertexIds.length).fill(DIST_FAR);
  dist[from] = 0;
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q]!;
    const d = dist[u]!;
    if (d >= DIST_FAR - 1) continue;
    if (u !== from && b.vertexOwner[u] !== -1 && b.vertexOwner[u] !== offset) continue;
    for (let j = 0; j < 3; j++) {
      const e = idx.vertexEdges[u * 3 + j]!;
      if (e < 0 || b.edgeOwner[e] !== -1 || !b.landEdge[e]) continue;
      const a = idx.edgeVertices[e * 2]!;
      const w = a === u ? idx.edgeVertices[e * 2 + 1]! : a;
      if (d + 1 < dist[w]!) {
        dist[w] = d + 1;
        queue.push(w);
      }
    }
  }
  return dist;
}

const isNeighbour = (b: BoardFacts, v: number, u: number) => {
  for (let j = 0; j < 3; j++) if (b.idx.vertexNeighbors[v * 3 + j] === u) return true;
  return false;
};

/**
 * What each build the viewer could make now does for its win: per vertex, the
 * turns its best win plan saves by settling there first (open corners within
 * three roads; roads + settlement paid, its production added, the corner and
 * its neighbours off the map, corners near it now closer) or by a city there
 * (its own settlements); per edge it could road, the best such corner that
 * road is on a shortest way to. Positive = a faster win than the plan without
 * it. NaN where there's no such build. Only for the viewer's own build
 * decisions (main turn, Road Building), the only time they're needed.
 */
export interface BuildGains {
  vertex: Float32Array;
  edge: Float32Array;
}

export function buildGains(obs: CatanObservation, b: BoardFacts, plans: SeatPlan[]): BuildGains {
  const V = b.idx.vertexIds.length;
  const E = b.idx.edgeIds.length;
  const vertex = new Float32Array(V).fill(Number.NaN);
  const edge = new Float32Array(E).fill(Number.NaN);
  const type = obs.decision?.type;
  if (type !== 'main' && type !== 'roadBuilding') return { vertex, edge };
  const sh = sharedFacts(obs);
  const seat = seatOf(obs, sh, 0);
  const { p, income, hand, rate, delay } = seat;
  const scale = sh.n / 36;
  const base = plans[0]!.plans.best;
  const dist0 = b.dist[0]!;
  const after = (pv: number[], m: Partial<Position> & { hand: number[] }) => planFrom(obs, sh, seat, {
    income: income.map((x, r) => x + pv[r]! * scale),
    spots: m.spots ?? spotsFrom(b, dist0),
    settlements: p.settlements.length,
    cities: p.cities.length,
    roads: p.roads.length,
    points: 1,
    delay: 0,
    ...m,
  }).best;

  if (p.settlements.length < MAX_SETTLEMENTS) {
    for (let v = 0; v < V; v++) {
      const d = dist0[v]!;
      if (b.open[v] !== 1 || d >= DIST_FAR || p.roads.length + d > MAX_ROADS) continue;
      const build = plans[0]!.settleTurns[d]!;
      if (build >= NEVER) continue;
      const cost = SETTLEMENT.map((c, r) => c + d * ROAD[r]!);
      const near = distFrom(b, v, 0);
      const spots: number[] = [];
      for (let u = 0; u < V; u++) {
        if (b.open[u] !== 1 || u === v || isNeighbour(b, v, u)) continue;
        const du = Math.min(dist0[u]!, near[u]!);
        if (du < DIST_FAR) spots.push(du);
      }
      spots.sort((a, c) => a - c);
      const t = after(cornerPips(obs, b, v), {
        hand: hand.map((h, r) => Math.max(0, h - cost[r]!)),
        spots,
        settlements: p.settlements.length + 1,
        roads: p.roads.length + d,
      });
      vertex[v] = base - Math.min(ETA_CAP, build + t);
    }
  }
  if (p.cities.length < MAX_CITIES) {
    const build = delay + collectTurns(CITY, hand, income, rate);
    for (const id of p.settlements) {
      const v = b.idx.vertexIndex.get(id)!;
      const t = after(cornerPips(obs, b, v), {
        hand: hand.map((h, r) => Math.max(0, h - CITY[r]!)),
        settlements: p.settlements.length - 1,
        cities: p.cities.length + 1,
      });
      vertex[v] = base - Math.min(ETA_CAP, build + t);
    }
  }
  // A road counts toward a corner when it's on a shortest way there.
  for (let e = 0; e < E; e++) {
    if (b.canRoad[e] !== 1) continue;
    const a = b.idx.edgeVertices[e * 2]!;
    const c = b.idx.edgeVertices[e * 2 + 1]!;
    const far = dist0[a] === 0 ? (dist0[c] === 0 ? -1 : c) : a;
    if (far < 0) continue;
    const near = distFrom(b, far, 0);
    let best = Number.NaN;
    for (let u = 0; u < V; u++) {
      const g = vertex[u]!;
      if (Number.isNaN(g) || b.open[u] !== 1 || 1 + near[u]! > dist0[u]!) continue;
      if (Number.isNaN(best) || g > best) best = g;
    }
    edge[e] = best;
  }
  return { vertex, edge };
}

/**
 * Where each opponent most likely settles next: per opponent a softmax over
 * the open corners it can reach, by their production (resources it doesn't
 * make yet weigh more) less the turns to get there. Per vertex the highest
 * such chance and that opponent's turns to settle it.
 */
export interface OpponentTargets {
  chance: Float32Array;
  turns: Float32Array;
}

export function opponentTargets(obs: CatanObservation, b: BoardFacts, plans: SeatPlan[]): OpponentTargets {
  const V = b.idx.vertexIds.length;
  const chance = new Float32Array(V);
  const turns = new Float32Array(V);
  const type = obs.decision?.type;
  if (type === 'setupSettlement' || type === 'setupRoad') return { chance, turns };
  for (let k = 1; k < plans.length; k++) {
    const made = pips(obs, obs.players[k]!);
    const dist = b.dist[k]!;
    const cand: number[] = [];
    const score: number[] = [];
    for (let v = 0; v < V; v++) {
      const d = dist[v]!;
      if (b.open[v] !== 1 || d >= DIST_FAR) continue;
      const t = plans[k]!.settleTurns[d]!;
      if (t >= NEVER) continue;
      const pv = cornerPips(obs, b, v);
      let value = 0;
      for (let r = 0; r < R; r++) value += pv[r]! * (made[r]! > 0 ? 1 : 1.5);
      cand.push(v);
      score.push(value / 3 - t);
    }
    if (cand.length === 0) continue;
    const top = Math.max(...score);
    const w = score.map((s) => Math.exp(s - top));
    const z = sum(w);
    cand.forEach((v, j) => {
      const q = w[j]! / z;
      if (q > chance[v]!) {
        chance[v] = q;
        turns[v] = plans[k]!.settleTurns[dist[v]!]!;
      }
    });
  }
  return { chance, turns };
}

/**
 * The opening, looking ahead to the viewer's second settlement. In round 1:
 * per open corner, the chance it's still open when the viewer places its
 * second (the opponents placing before then — snake order — modelled as each
 * taking a corner by its pips, weighted by the chance it's still there, and
 * blocking its neighbours), and for a first settlement here the expected best
 * second one among what's likely left (pair value: pips of both plus the
 * resource kinds they cover). In round 2 the pair value with the viewer's
 * first settlement. Null outside the opening.
 */
export interface OpeningOutlook {
  round: 1 | 2;
  secondOpen: Float32Array;
  /** NaN where not meaningful. */
  pairBest: Float32Array;
}

const KIND_WEIGHT = 0.8;
const PICK_TEMPERATURE = 2;
/** Pair value scale: two strong corners ≈ 25 pips + kinds. */
export const PAIR_SCALE = 25;

export function openingOutlook(obs: CatanObservation, b: BoardFacts): OpeningOutlook | null {
  const d = obs.decision;
  if (d?.type !== 'setupSettlement' && d?.type !== 'setupRoad') return null;
  const V = b.idx.vertexIds.length;
  const n = obs.playerCount;
  const pv = (v: number) => b.vertexPips.subarray(v * R, v * R + R);
  const value = (v: number) => {
    let s = 0;
    let kinds = 0;
    for (const x of pv(v)) {
      s += x;
      if (x > 0) kinds++;
    }
    return s + KIND_WEIGHT * kinds;
  };
  const pair = (v: number, u: number) => {
    const a = pv(v);
    const c = pv(u);
    let s = 0;
    let kinds = 0;
    for (let r = 0; r < R; r++) {
      s += a[r]! + c[r]!;
      if (a[r]! + c[r]! > 0) kinds++;
    }
    return s + KIND_WEIGHT * kinds;
  };
  const secondOpen = new Float32Array(V);
  const pairBest = new Float32Array(V).fill(Number.NaN);
  for (let v = 0; v < V; v++) secondOpen[v] = b.open[v]!;
  const me = obs.players[0]!;
  const first = me.settlements[0] ? b.idx.vertexIndex.get(me.settlements[0])! : -1;

  if (d.round === 1) {
    const placed = obs.players.reduce((s, p) => s + p.settlements.length + p.cities.length, 0);
    const i = d.type === 'setupRoad' ? placed - 1 : placed;
    const picks = Math.max(0, 2 * n - 2 - 2 * i);
    const a = secondOpen;
    const vals = Array.from({ length: V }, (_, v) => value(v));
    const top = Math.max(...vals);
    const pref = vals.map((x) => Math.exp((x - top) / PICK_TEMPERATURE));
    for (let pick = 0; pick < picks; pick++) {
      let z = 0;
      for (let v = 0; v < V; v++) z += a[v]! * pref[v]!;
      if (z <= 1e-12) break;
      const q = new Float32Array(V);
      for (let v = 0; v < V; v++) q[v] = (a[v]! * pref[v]!) / z;
      for (let v = 0; v < V; v++) {
        if (a[v]! <= 0) continue;
        let nb = 0;
        for (let j = 0; j < 3; j++) {
          const u = b.idx.vertexNeighbors[v * 3 + j]!;
          if (u >= 0) nb += q[u]!;
        }
        a[v] = Math.max(0, a[v]! - q[v]! - a[v]! * nb);
      }
    }
  }
  for (let v = 0; v < V; v++) {
    if (b.open[v] !== 1) continue;
    if (d.round === 2 || d.type === 'setupRoad') {
      // The first settlement is down: how well each corner would pair with it.
      if (first >= 0 && first !== v) pairBest[v] = pair(first, v) / PAIR_SCALE;
      continue;
    }
    // Expected best second settlement, each corner open with its own chance (independently).
    const opts: Array<[number, number]> = [];
    for (let u = 0; u < V; u++) {
      if (u === v || secondOpen[u]! <= 0 || isNeighbour(b, v, u)) continue;
      opts.push([pair(v, u), secondOpen[u]!]);
    }
    opts.sort((x, y) => y[0] - x[0]);
    let expect = 0;
    let none = 1;
    for (const [val, open] of opts) {
      expect += val * open * none;
      none *= 1 - open;
      if (none < 1e-4) break;
    }
    pairBest[v] = expect / PAIR_SCALE;
  }
  return { round: d.round, secondOpen, pairBest };
}

interface PlanInputs {
  /** Points still needed (whole points; ≤ 0 = already there). */
  need: number;
  /** Road distances to the open corners it can reach, nearest first. */
  spots: number[];
  settlementsOnBoard: number;
  cities: number;
  roadsLeft: number;
  /** VP cards it could still draw. */
  vpCardsLeft: number;
  pVp: number;
  pKnight: number;
  /** Roads more to take Longest Road / knights more to take Largest Army; null when it holds it. */
  lrRoads: number | null;
  laKnights: number | null;
  knightsHeld: number;
  /** Turns to gather a whole cost on top of the hand. */
  turns: (cost: number[]) => number;
  delay: number;
}

/** Enumerate the minimal winning combinations and summarise them (WinPlans). */
function winPlans(x: PlanInputs): WinPlans {
  if (x.need <= 0) return { best: x.delay, second: x.delay, near: 1, share: [0, 0, 0, 0, 0], bestMix: [0, 0, 0, 0, 0] };
  // Cards for the first n new settlements: roads to the n nearest corners + the settlements.
  const settleCost: number[][] = [[0, 0, 0, 0, 0]];
  let roadsForSettle = 0;
  for (let n = 1; n <= Math.min(x.spots.length, MAX_SETTLEMENTS); n++) {
    const d = x.spots[n - 1]!;
    roadsForSettle += d;
    settleCost.push(SETTLEMENT.map((c, r) => c * n + roadsForSettle * ROAD[r]!));
  }
  const roadsAt = (n: number) => settleCost[n]![0]! - n; // wood in the cost minus the settlements' own
  const found: Array<{ t: number; mix: number[] }> = [];
  const lrOk = x.lrRoads !== null && x.lrRoads > 0 && x.lrRoads <= x.roadsLeft;
  const laOk = x.laKnights !== null && x.laKnights > 0 && (x.laKnights <= x.knightsHeld || x.pKnight > 0);
  for (let s = 0; s < settleCost.length; s++) {
    if (roadsAt(s) > x.roadsLeft) break;
    for (let c = 0; c <= MAX_CITIES - x.cities; c++) {
      if (c > x.settlementsOnBoard + s) break; // a city needs a settlement under it
      if (x.settlementsOnBoard + s - c > MAX_SETTLEMENTS) continue; // a city frees its settlement piece
      for (let v = 0; v <= Math.min(x.vpCardsLeft, 5); v++) {
        if (v > 0 && x.pVp <= 0) break;
        for (let lr = 0; lr <= (lrOk ? 1 : 0); lr++) {
          for (let la = 0; la <= (laOk ? 1 : 0); la++) {
            const points = s + c + v + 2 * lr + 2 * la;
            if (points < x.need) continue;
            // Minimal: without its smallest part it would fall short.
            const smallest = s + c + v > 0 ? 1 : 2;
            if (points - smallest >= x.need) continue;
            const cost = settleCost[s]!.map((q, r) => q + c * CITY[r]! + lr * (x.lrRoads ?? 0) * ROAD[r]!);
            // VP cards and knights come out of the same dev-card draws.
            const knightsToBuy = la ? Math.max(0, x.laKnights! - x.knightsHeld) : 0;
            const draws = Math.max(v > 0 ? v / x.pVp : 0, knightsToBuy > 0 ? knightsToBuy / x.pKnight : 0);
            for (let r = 0; r < R; r++) cost[r]! += draws * DEV[r]!;
            let t = x.delay + x.turns(cost);
            if (la) t = Math.max(t, x.delay + x.laKnights! - 1); // one knight a turn
            found.push({ t: Math.min(NEVER, t), mix: [s, c, v, lr, la] });
          }
        }
      }
    }
  }
  if (found.length === 0) return NO_PLANS;
  found.sort((a, b) => a.t - b.t);
  const best = found[0]!;
  const near = found.filter((f) => f.t <= best.t + NEAR_TURNS);
  const share = [0, 1, 2, 3, 4].map((j) => near.filter((f) => f.mix[j]! > 0).length / near.length);
  return { best: best.t, second: found[1]?.t ?? NEVER, near: near.length, share, bestMix: best.mix };
}

function covers(hand: number[], cost: number[]): boolean {
  return cost.every((c, r) => hand[r]! >= c);
}

/** The opponent (offset) closest to winning by eta, then expected points; −1 with none. */
export function trueLeader(plans: SeatPlan[]): number {
  let best = -1;
  for (let k = 1; k < plans.length; k++) {
    const p = plans[k]!;
    if (best < 0 || p.eta < plans[best]!.eta - 1e-9 || (Math.abs(p.eta - plans[best]!.eta) <= 1e-9 && p.expVp > plans[best]!.expVp)) best = k;
  }
  return best;
}

/**
 * Per vertex: turns the best opponent needs to settle it minus the viewer's
 * (positive = the viewer gets there first). NaN for corners nobody can take.
 */
export function cornerRaces(b: BoardFacts, plans: SeatPlan[]): Float32Array {
  const V = b.idx.vertexIds.length;
  const out = new Float32Array(V).fill(Number.NaN);
  for (let v = 0; v < V; v++) {
    if (b.open[v] !== 1) continue;
    const at = (k: number) => {
      const d = b.dist[k]![v]!;
      return d < DIST_FAR ? plans[k]!.settleTurns[d]! : NEVER;
    };
    const me = at(0);
    let opp = NEVER;
    for (let k = 1; k < plans.length; k++) opp = Math.min(opp, at(k));
    if (me >= NEVER && opp >= NEVER) continue;
    out[v] = opp - me;
  }
  return out;
}

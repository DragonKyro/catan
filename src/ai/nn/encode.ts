// Catan learned agent — observation → feature tensors (encoder v1).
//
// Pure function of CatanObservation (never GameState), so hidden information
// can't leak in here. The output is entity-structured for a graph network:
// one row per hex, vertex and edge (board.ts's canonical order) plus one
// global vector. Row widths don't depend on the board, so a network trained
// on the 19-hex 3–4 player board reads the same per-entity features on the
// 30- and 37-hex boards; a flat network can concatenate the four arrays.
//
// Seats are encoded by role. A board piece carries its owner as a seat slot
// — me, next1..next3 (the next three seats in turn order) or far (every seat
// further round, 5–8 players only). The global vector has a block for me,
// one per next seat, a pooled block for the far seats, and summaries over
// every opponent. At 3 players next3 is absent (zeros).
//
// Placement features ("could build here now", road distance from each
// network) re-derive the base rules from the observation; encode.test.ts
// checks them against the engine's own predicates.
//
// Values stay within ±4, mostly [0, 1]. Bump ENCODER_VERSION whenever a
// segment is added, removed, reordered or rescaled; trained weights are only
// valid for the version they saw.
//
// v2 (2026-11-19) only appended segments at the end of each row (the `v2.`
// ones below): v1's columns are a prefix of v2's, so a v1 network upgrades
// exactly by giving the new inputs zero weight (training/catan/upgrade_policy.py
// --encoder). They add what a player works out from what's public: robber
// damage per hex and seat, what a steal would likely give, what each opponent
// still needs, Longest Road / Largest Army races, VP ceilings with hidden
// cards, knights in hand, room to expand, income after the robber, and the
// snake order of the opening.
//
// v3 (2026-11-25) appends the `v3.` segments the same way: how close each seat
// is to winning (plan.ts — permanent / temporary / expected points with its
// face-down dev cards, the chance it wins on its next turn, turns to its next
// point by each route and to the target), the true leader by that measure
// and the robber's damage to it, who wins the race to each open corner and
// what a road toward it risks, this turn's offers and answers, the partner
// pick (actions.ts PolicyRules.tradePick), every minimal winning combination,
// how many turns each build the viewer could make saves its best plan, where
// each opponent likely settles next, and in the opening, which corners are
// likely still open at the viewer's second settlement and the best pair a
// first settlement leaves.

import type { PortType, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { probabilityDots } from '../value';
import type { BoardIndex } from './board';
import { AFFORD_COSTS, DEV_TYPES, PLAYABLE_DEV } from './knowledge';
import type { CatanObservation, ObservedPlayer } from './observation';
import {
  DIST_FAR, NEVER, PLAN_OPTIONS, buildGains, cornerRaces, openingOutlook, opponentTargets, seatPlans, trueLeader,
  type BuildGains, type OpeningOutlook, type OpponentTargets, type SeatPlan,
} from './plan';

export const ENCODER_VERSION = 3;

/** me, next1, next2, next3, far. */
export const SEAT_SLOTS = 5;
const OPP_SLOTS = SEAT_SLOTS - 1;
const NEXT_SEATS = 3;
const seatSlot = (offset: number) => Math.min(offset, SEAT_SLOTS - 1);

const TERRAINS = ['wood', 'brick', 'sheep', 'wheat', 'ore', 'desert', 'sea'] as const;
const NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const PORTS: readonly PortType[] = ['generic', ...RESOURCES];
export const DECISIONS = [
  'setupSettlement', 'setupRoad', 'roll', 'main', 'discard', 'robberHex', 'robberVictim', 'roadBuilding', 'tradeResponse',
] as const;
/** Roads needed to reach a vertex: 0, 1, 2, 3, or 4+ / unreachable. */
const DIST_BUCKETS = DIST_FAR + 1;
const FAR = DIST_FAR;
const MAX_SETTLEMENTS = 5;
const MAX_CITIES = 4;
const MAX_ROADS = 15;
const MAX_PLAYERS = 8;
const RECENT_ROLLS = 3;
const TOTALS = 11; // dice totals 2..12
const R = RESOURCES.length;

export interface FeatureSegment {
  name: string;
  offset: number;
  size: number;
}

export class FeatureLayout {
  readonly segments: FeatureSegment[] = [];
  private readonly byName = new Map<string, FeatureSegment>();
  dim = 0;

  add(name: string, size: number): this {
    if (this.byName.has(name)) throw new Error(`duplicate feature segment ${name}`);
    const seg = { name, offset: this.dim, size };
    this.segments.push(seg);
    this.byName.set(name, seg);
    this.dim += size;
    return this;
  }

  seg(name: string): FeatureSegment {
    const s = this.byName.get(name);
    if (!s) throw new Error(`unknown feature segment ${name}`);
    return s;
  }
}

export const HEX_LAYOUT = new FeatureLayout()
  .add('present', 1)
  .add('terrain', TERRAINS.length)
  .add('number', NUMBERS.length)
  .add('pips', 1)
  .add('robber', 1)
  .add('robberChosen', 1) // picked as the robber's hex in this decision
  .add('coastal', 1)
  .add('rollShare', 1) // how often its number has come up
  .add('rolledNow', 1) // this turn's roll is its number
  .add('buildings', SEAT_SLOTS) // settlements + 2 × cities on its corners, per seat slot
  // ---- v2 ----
  .add('v2.harm', SEAT_SLOTS) // what the robber here would cost each seat (pips × buildings)
  .add('v2.harmLeader', 1) // ... the leading opponent
  .add('v2.stealable', 1) // opponents with cards on its corners
  // ---- v3 ----
  .add('v3.harmTrueLeader', 1); // ... the opponent closest to winning (plan.ts), not the one with most points

export const VERTEX_LAYOUT = new FeatureLayout()
  .add('present', 1)
  .add('settlement', 1)
  .add('city', 1)
  .add('owner', SEAT_SLOTS)
  .add('open', 1) // empty and clear of the distance rule
  .add('canSettle', 1) // the viewer may place a settlement here now (setup: anywhere open)
  .add('canCity', 1)
  .add('myDistance', DIST_BUCKETS) // new roads the viewer needs to reach it
  .add('oppDistance', DIST_BUCKETS) // the same for the closest opponent
  .add('pips', R)
  .add('totalPips', 1)
  .add('resourceKinds', 1)
  .add('robberAdjacent', 1)
  .add('port', PORTS.length)
  .add('coastal', 1)
  .add('hexCount', 1)
  .add('setupAnchor', 1) // the settlement a setup road must touch
  // ---- v2 ----
  .add('v2.diversity', 1) // resources here the viewer doesn't produce yet
  .add('v2.portFit', 1) // a harbor here, weighted by what the viewer would produce for it
  .add('v2.startCards', 1) // cards a second starting settlement here would pay
  .add('v2.contest', 1) // opponents' best road distance minus the viewer's, for open corners
  // ---- v3 ----
  .add('v3.race', 1) // turns the fastest opponent needs to settle it minus the viewer's (+ = the viewer's)
  .add('v3.speedup', 1) // turns a settlement / city here saves the viewer's best win plan (plan.ts buildGains)
  .add('v3.oppNext', 1) // the chance an opponent's next settlement goes here (the likeliest opponent)
  .add('v3.oppNextTurns', 1) // ... and that opponent's turns to settle it
  .add('v3.secondOpen', 1) // opening, round 1: the chance it's still open at the viewer's second settlement
  .add('v3.pairBest', 1); // opening: round 1, the expected best second settlement with a first here; later, the pair with the first

export const EDGE_LAYOUT = new FeatureLayout()
  .add('present', 1)
  .add('road', SEAT_SLOTS)
  .add('draftRoad', 1) // chosen earlier in this Road Building
  .add('canRoad', 1)
  .add('port', 1)
  .add('coastal', 1)
  .add('blockedEnd', 1) // an opponent's building sits on an endpoint
  // ---- v3 ----
  .add('v3.wins', 1) // open corners near a road the viewer could build here that it reaches first
  .add('v3.loses', 1) // ... that an opponent reaches first: building toward them risks a cut-off
  .add('v3.speedup', 1) // the best speedup of a corner this road is on a shortest way to
  .add('v3.oppNextNear', 1); // the highest opponent next-settlement chance among the corners near it

export const GLOBAL_LAYOUT = (() => {
  const l = new FeatureLayout();
  // ---- the decision at hand ----
  l.add('decision', DECISIONS.length)
    .add('decision.setupRound2', 1)
    .add('decision.discardRequired', 1)
    .add('decision.discardLeft', 1)
    .add('decision.discardChosen', R)
    .add('decision.robberKnight', 1)
    .add('decision.victims', OPP_SLOTS)
    .add('decision.roadsPlaced', 1)
    .add('decision.tradeProposer', OPP_SLOTS)
    .add('decision.tradeGive', R)
    .add('decision.tradeGet', R)
    .add('decision.tradeCounter', 1)
    .add('decision.canPlayDev', 1)
    .add('decision.playerTrades', 1);
  // ---- this turn ----
  l.add('turn.mine', 1)
    .add('turn.actor', SEAT_SLOTS)
    .add('turn.holder', SEAT_SLOTS)
    .add('turn.rolled', 1)
    .add('turn.playedDev', 1)
    .add('turn.pairedPlayer2', 1)
    .add('turn.tradesProposed', 1)
    .add('turn.tradePending', 1)
    .add('turn.tradedAway', R)
    .add('turn.tradedFor', R);
  // ---- game, bank, dev deck, dice ----
  l.add('game.players', MAX_PLAYERS - 1)
    .add('game.variant', 3)
    .add('game.vpToWin', 1)
    .add('game.turn', 1)
    .add('bank.resources', R)
    .add('bank.total', 1)
    .add('dev.deck', 1)
    .add('dev.unseen', DEV_TYPES.length)
    .add('dev.unseenTotal', 1)
    .add('dice.histogram', TOTALS)
    .add('dice.recent', RECENT_ROLLS * TOTALS)
    .add('dice.sinceSeven', 1)
    .add('largestArmy.holder', SEAT_SLOTS)
    .add('largestArmy.size', 1)
    .add('longestRoad.holder', SEAT_SLOTS)
    .add('longestRoad.length', 1);
  // ---- me ----
  l.add('me.hand', R)
    .add('me.handSize', 1)
    .add('me.over7', 1)
    .add('me.playable', PLAYABLE_DEV.length)
    .add('me.boughtThisTurn', PLAYABLE_DEV.length)
    .add('me.vpCards', 1)
    .add('me.played', PLAYABLE_DEV.length)
    .add('me.devBought', 1)
    .add('me.publicVp', 1)
    .add('me.trueVp', 1)
    .add('me.vpGap', 1)
    .add('me.pieces', 3)
    .add('me.ports', PORTS.length)
    .add('me.tradeRate', R)
    .add('me.production', R)
    .add('me.productionTotal', 1)
    .add('me.afford', AFFORD_COSTS.length)
    .add('me.longestRoad', 1)
    .add('me.hasLongestRoad', 1)
    .add('me.hasLargestArmy', 1)
    .add('me.settleSpots', 1)
    .add('me.citySpots', 1)
    .add('me.roadSpots', 1);
  // ---- the next three seats ----
  for (let k = 1; k <= NEXT_SEATS; k++) {
    const t = `next${k}`;
    l.add(`${t}.present`, 1)
      .add(`${t}.handSize`, 1)
      .add(`${t}.over7`, 1)
      .add(`${t}.mean`, R)
      .add(`${t}.atLeast1`, R)
      .add(`${t}.atLeast2`, R)
      .add(`${t}.afford`, AFFORD_COSTS.length)
      .add(`${t}.certainty`, 1)
      .add(`${t}.devCards`, 1)
      .add(`${t}.hiddenVp`, 1)
      .add(`${t}.played`, PLAYABLE_DEV.length)
      .add(`${t}.devBought`, 1)
      .add(`${t}.publicVp`, 1)
      .add(`${t}.vpGap`, 1)
      .add(`${t}.pieces`, 3)
      .add(`${t}.ports`, PORTS.length)
      .add(`${t}.production`, R)
      .add(`${t}.productionTotal`, 1)
      .add(`${t}.longestRoad`, 1)
      .add(`${t}.hasLongestRoad`, 1)
      .add(`${t}.hasLargestArmy`, 1);
  }
  // ---- seats further round (5–8 players), pooled ----
  l.add('far.count', 1)
    .add('far.maxVp', 1)
    .add('far.hands', 1)
    .add('far.devCards', 1)
    .add('far.maxKnights', 1)
    .add('far.maxLongestRoad', 1)
    .add('far.production', R);
  // ---- every opponent ----
  l.add('opps.maxVp', 1)
    .add('opps.leader', OPP_SLOTS)
    .add('opps.hands', 1)
    .add('opps.devCards', 1)
    .add('opps.hiddenVp', 1);
  // ---- v2: the opening, and what a player works out about each seat ----
  l.add('v2.setup.placed', 1) // settlements placed so far / 2n
    .add('v2.setup.picksBefore', 1); // others' settlements before the viewer's next one (snake order)
  for (let k = 0; k <= NEXT_SEATS; k++) {
    const t = `v2.s${k}`; // s0 = the viewer, s1..s3 = the next seats
    l.add(`${t}.income`, R) // expected cards per roll, robber excluded
      .add(`${t}.pAnyIncome`, 1) // P(a roll pays this seat anything)
      .add(`${t}.robbed`, 1) // share of its pips under the robber
      .add(`${t}.lrGap`, 1) // route length minus the best other seat's
      .add(`${t}.roadsToLr`, 1) // roads still needed to hold Longest Road
      .add(`${t}.laGap`, 1) // knights played minus the best other seat's
      .add(`${t}.knightsToLa`, 1) // knights still needed to hold Largest Army
      .add(`${t}.vpCeiling`, 1) // public VP + every possible hidden VP card
      .add(`${t}.pKnight`, 1) // P(a knight in hand)
      .add(`${t}.need`, R) // cards short of its next settlement / city, per resource
      .add(`${t}.needSettle`, 1)
      .add(`${t}.needCity`, 1)
      .add(`${t}.stealOdds`, R) // what a steal from it would likely give
      .add(`${t}.spots1`, 1) // open corners within one road
      .add(`${t}.spots2`, 1) // ... within two roads
      .add(`${t}.contested`, 1); // ... of those, ones another seat reaches as fast
  }
  // ---- v3: how close each seat is to winning (plan.ts) ----
  for (let k = 0; k <= NEXT_SEATS; k++) {
    const t = `v3.s${k}`;
    l.add(`${t}.permVp`, 1) // settlements + cities
      .add(`${t}.tempVp`, 1) // Longest Road + Largest Army
      .add(`${t}.expVp`, 1) // public points + what its face-down dev cards likely hold
      .add(`${t}.soon`, 1) // P(it reaches the target by the end of its next turn)
      .add(`${t}.options`, PLAN_OPTIONS.length) // turns to its next point: settlement, city, VP card, Longest Road, Largest Army
      .add(`${t}.eta`, 1) // turns to the target, cheapest route first
      .add(`${t}.etaLead`, 1) // its eta minus the best other seat's
      // Every minimal winning combination, costed whole (plan.ts WinPlans):
      .add(`${t}.planBest`, 1) // the best plan's turns
      .add(`${t}.planGap`, 1) // the next best's extra turns
      .add(`${t}.planNear`, 1) // plans within NEAR_TURNS of the best: options still open
      .add(`${t}.planShare`, PLAN_OPTIONS.length) // per route, the share of those plans that use it
      .add(`${t}.planMix`, PLAN_OPTIONS.length); // the best plan: settlements, cities, VP cards, LR, LA
  }
  l.add('v3.trueLeader', OPP_SLOTS) // the opponent with the lowest eta
    .add('v3.leaderGap', 1) // that opponent's eta minus the viewer's
    // ---- v3: this turn's offers and answers ----
    .add('v3.turn.rejectedBy', OPP_SLOTS) // the viewer's offers each seat said no to
    .add('v3.turn.acceptedBy', OPP_SLOTS) // ... said yes to
    .add('v3.turn.refused', R) // resources the viewer asked for that nobody would give
    .add('v3.turn.asked', NEXT_SEATS * R) // resources each next seat asked for in its own offers
    // ---- v3: picking a partner for the viewer's own offer ----
    .add('v3.decision.tradePick', 1)
    .add('v3.decision.counterOffer', 1) // choosing the counter (the offer answered is in decision.trade*)
    .add('v3.pick.acceptors', OPP_SLOTS)
    .add('v3.pick.give', R)
    .add('v3.pick.get', R);
  return l;
})();

export const HEX_DIM = HEX_LAYOUT.dim;
export const VERTEX_DIM = VERTEX_LAYOUT.dim;
export const EDGE_DIM = EDGE_LAYOUT.dim;
export const GLOBAL_DIM = GLOBAL_LAYOUT.dim;

/** Row-major [entity][feature] arrays, entities in the board index's order. */
export interface CatanFeatures {
  numHexes: number;
  numVertices: number;
  numEdges: number;
  hexes: Float32Array;
  vertices: Float32Array;
  edges: Float32Array;
  global: Float32Array;
}

/** Writes one row (an entity, or the global vector) by segment name, bounds-checked.
 *  One Row per layout is moved from entity to entity with `at`. */
class Row {
  private base = 0;
  constructor(private readonly x: Float32Array, private readonly layout: FeatureLayout) {}

  at(base: number): this {
    this.base = base;
    return this;
  }

  set(name: string, v: number, i = 0): void {
    const s = this.layout.seg(name);
    if (i < 0 || i >= s.size) throw new Error(`feature ${name}[${i}] is outside its ${s.size} slots`);
    this.x[this.base + s.offset + i] = v;
  }

  flag(name: string, on: boolean): void {
    if (on) this.set(name, 1);
  }

  /** One-hot; a negative index writes nothing. */
  oneHot(name: string, i: number): void {
    if (i >= 0) this.set(name, 1, i);
  }

  values(name: string, vs: ArrayLike<number>, scale = 1): void {
    const s = this.layout.seg(name);
    if (vs.length !== s.size) throw new Error(`feature ${name} takes ${s.size} values, got ${vs.length}`);
    for (let i = 0; i < vs.length; i++) this.x[this.base + s.offset + i] = clamp(vs[i]! * scale, -4, 4);
  }
}

/** Derived board facts the writers (and the action mask) share. */
export interface BoardFacts {
  idx: BoardIndex;
  /** Seat offset owning each vertex / edge, −1 if empty. Draft roads count as the viewer's. */
  vertexOwner: Int16Array;
  vertexCity: Uint8Array;
  edgeOwner: Int16Array;
  draftEdge: Uint8Array;
  landEdge: Uint8Array;
  open: Uint8Array;
  /** Per seat offset: bucketed road distance to every vertex. */
  dist: Int8Array[];
  canSettle: Uint8Array;
  canCity: Uint8Array;
  canRoad: Uint8Array;
  robberHex: number;
  /** Per vertex × resource: pips of the adjacent hexes. */
  vertexPips: Float32Array;
}

export function analyseBoard(obs: CatanObservation): BoardFacts {
  const idx = obs.index;
  const H = idx.hexIds.length;
  const V = idx.vertexIds.length;
  const E = idx.edgeIds.length;
  const land = new Uint8Array(H);
  idx.hexIds.forEach((id, h) => { land[h] = obs.board.hexes[id]!.terrain === 'sea' ? 0 : 1; });

  const vertexOwner = new Int16Array(V).fill(-1);
  const vertexCity = new Uint8Array(V);
  const edgeOwner = new Int16Array(E).fill(-1);
  for (const p of obs.players) {
    for (const v of p.settlements) vertexOwner[idx.vertexIndex.get(v)!] = p.offset;
    for (const v of p.cities) {
      const i = idx.vertexIndex.get(v)!;
      vertexOwner[i] = p.offset;
      vertexCity[i] = 1;
    }
    for (const e of p.roads) edgeOwner[idx.edgeIndex.get(e)!] = p.offset;
  }
  const decision = obs.decision;
  const draftEdge = new Uint8Array(E);
  for (const e of decision?.type === 'roadBuilding' ? decision.placed : []) {
    const i = idx.edgeIndex.get(e)!;
    draftEdge[i] = 1;
    edgeOwner[i] = 0;
  }

  const landEdge = new Uint8Array(E);
  for (let e = 0; e < E; e++) {
    for (let k = 0; k < 2; k++) {
      const h = idx.edgeHexes[e * 2 + k]!;
      if (h >= 0 && land[h]) landEdge[e] = 1;
    }
  }
  const open = new Uint8Array(V);
  for (let v = 0; v < V; v++) {
    let ok = vertexOwner[v] === -1;
    let touchesLand = false;
    for (let k = 0; k < 3 && ok; k++) {
      const n = idx.vertexNeighbors[v * 3 + k]!;
      if (n >= 0 && vertexOwner[n] !== -1) ok = false;
      const h = idx.vertexHexes[v * 3 + k]!;
      if (h >= 0 && land[h]) touchesLand = true;
    }
    open[v] = ok && touchesLand ? 1 : 0;
  }

  const dist = obs.players.map((p) => distances(idx, vertexOwner, edgeOwner, landEdge, p.offset));
  const me = obs.players[0]!;
  const setup = decision?.type === 'setupSettlement' || decision?.type === 'setupRoad';
  const canSettle = new Uint8Array(V);
  const canCity = new Uint8Array(V);
  if (me.settlements.length < MAX_SETTLEMENTS) {
    for (let v = 0; v < V; v++) canSettle[v] = open[v] && (setup || dist[0]![v] === 0) ? 1 : 0;
  }
  if (me.cities.length < MAX_CITIES) for (const s of me.settlements) canCity[idx.vertexIndex.get(s)!] = 1;

  const canRoad = new Uint8Array(E);
  const roadsLeft = MAX_ROADS - me.roads.length - (decision?.type === 'roadBuilding' ? decision.placed.length : 0);
  const anchor = decision?.type === 'setupRoad' ? idx.vertexIndex.get(decision.settlement)! : -1;
  for (let e = 0; e < E && roadsLeft > 0; e++) {
    if (edgeOwner[e] !== -1 || !landEdge[e]) continue;
    for (let k = 0; k < 2; k++) {
      const v = idx.edgeVertices[e * 2 + k]!;
      if (anchor >= 0) {
        if (v === anchor) canRoad[e] = 1;
        continue;
      }
      if (vertexOwner[v] === 0) canRoad[e] = 1;
      else if (vertexOwner[v] === -1) {
        for (let j = 0; j < 3; j++) {
          const other = idx.vertexEdges[v * 3 + j]!;
          if (other >= 0 && other !== e && edgeOwner[other] === 0) canRoad[e] = 1;
        }
      }
    }
  }

  const vertexPips = new Float32Array(V * R);
  for (let v = 0; v < V; v++) {
    for (let k = 0; k < 3; k++) {
      const h = idx.vertexHexes[v * 3 + k]!;
      if (h < 0) continue;
      const hex = obs.board.hexes[idx.hexIds[h]!]!;
      const r = RESOURCES.indexOf(hex.terrain as (typeof RESOURCES)[number]);
      if (r >= 0) vertexPips[v * R + r]! += probabilityDots(hex.numberToken);
    }
  }

  return {
    idx, vertexOwner, vertexCity, edgeOwner, draftEdge, landEdge, open, dist, canSettle, canCity, canRoad,
    robberHex: idx.hexIndex.get(obs.board.robberHex) ?? -1, vertexPips,
  };
}

/** Roads `offset` would need to build to reach each vertex, bucketed 0..FAR.
 *  Roads can't run through an opponent's building or along an occupied edge. */
function distances(idx: BoardIndex, vertexOwner: Int16Array, edgeOwner: Int16Array, landEdge: Uint8Array, offset: number): Int8Array {
  const V = idx.vertexIds.length;
  const dist = new Int8Array(V).fill(FAR);
  const queue: number[] = [];
  const reach = (v: number, d: number) => {
    if (d < dist[v]!) {
      dist[v] = d;
      queue.push(v);
    }
  };
  for (let v = 0; v < V; v++) if (vertexOwner[v] === offset) reach(v, 0);
  for (let e = 0; e < idx.edgeIds.length; e++) {
    if (edgeOwner[e] === offset) for (let k = 0; k < 2; k++) reach(idx.edgeVertices[e * 2 + k]!, 0);
  }
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q]!;
    const d = dist[u]!;
    if (d >= FAR - 1) continue;
    if (vertexOwner[u] !== -1 && vertexOwner[u] !== offset) continue;
    for (let k = 0; k < 3; k++) {
      const e = idx.vertexEdges[u * 3 + k]!;
      if (e < 0 || edgeOwner[e] !== -1 || !landEdge[e]) continue;
      const a = idx.edgeVertices[e * 2]!;
      reach(a === u ? idx.edgeVertices[e * 2 + 1]! : a, d + 1);
    }
  }
  return dist;
}

/** Pips per resource from a player's settlements (×1) and cities (×2), robber hex excluded. */
function production(obs: CatanObservation, p: ObservedPlayer): number[] {
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

const portFlags = (p: ObservedPlayer) => PORTS.map((t) => (p.ports.includes(t) ? 1 : 0));
const pieces = (p: ObservedPlayer) => [
  (MAX_SETTLEMENTS - p.settlements.length) / MAX_SETTLEMENTS,
  (MAX_CITIES - p.cities.length) / MAX_CITIES,
  (MAX_ROADS - p.roads.length) / MAX_ROADS,
];
const played = (p: ObservedPlayer) => PLAYABLE_DEV.map((c) => p.played[c]);
const counts = (b: ResourceBank) => RESOURCES.map((r) => b[r]);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function writeHexes(obs: CatanObservation, b: BoardFacts, x: Float32Array, plans: SeatPlan[]): void {
  const idx = b.idx;
  const rolls = obs.rolls;
  const draftHex = obs.decision?.type === 'robberVictim' ? idx.hexIndex.get(obs.decision.hex)! : -1;
  const rolled = new Array<number>(13).fill(0);
  for (const t of rolls) rolled[t]! += 1;
  const buildings = HEX_LAYOUT.seg('buildings').offset;
  const harm = HEX_LAYOUT.seg('v2.harm').offset;
  const leader = leadingOpponent(obs);
  const realLeader = trueLeader(plans);
  const w = new Row(x, HEX_LAYOUT);
  idx.hexIds.forEach((id, h) => {
    const hex = obs.board.hexes[id]!;
    w.at(h * HEX_DIM);
    w.set('present', 1);
    w.oneHot('terrain', TERRAINS.indexOf(hex.terrain as (typeof TERRAINS)[number]));
    const num = hex.numberToken;
    w.oneHot('number', num === null ? -1 : NUMBERS.indexOf(num));
    w.set('pips', probabilityDots(num) / 5);
    w.flag('robber', h === b.robberHex);
    w.flag('robberChosen', h === draftHex);
    w.flag('coastal', idx.coastalHex[h] === 1);
    if (num !== null && rolls.length > 0) w.set('rollShare', clamp((rolled[num]! / rolls.length) * 6, 0, 4));
    w.flag('rolledNow', num !== null && obs.lastRoll === num);
    const pips = probabilityDots(num) / 5;
    const victims = new Set<number>();
    let leaderHarm = 0;
    let realHarm = 0;
    for (let k = 0; k < 6; k++) {
      const v = idx.hexVertices[h * 6 + k]!;
      const owner = b.vertexOwner[v]!;
      if (owner < 0) continue;
      const weight = b.vertexCity[v] ? 2 : 1;
      x[h * HEX_DIM + buildings + seatSlot(owner)]! += weight / 3;
      x[h * HEX_DIM + harm + seatSlot(owner)]! += (pips * weight) / 3;
      if (owner === leader) leaderHarm += (pips * weight) / 3;
      if (owner === realLeader) realHarm += (pips * weight) / 3;
      if (owner > 0 && obs.players[owner]!.handSize > 0) victims.add(owner);
    }
    if (leaderHarm > 0) w.set('v2.harmLeader', leaderHarm);
    if (victims.size > 0) w.set('v2.stealable', victims.size / 3);
    if (realHarm > 0) w.set('v3.harmTrueLeader', realHarm);
  });
}

/** Offset of the opponent with the most public VP (the first in turn order on a tie), or −1. */
function leadingOpponent(obs: CatanObservation): number {
  let best = -1;
  let vp = -1;
  for (let k = 1; k < obs.players.length; k++) {
    if (obs.players[k]!.publicVp > vp) {
      vp = obs.players[k]!.publicVp;
      best = k;
    }
  }
  return best;
}

/** Port lookups, built once per board (ports don't move during a game). */
const portCache = new WeakMap<object, { byVertex: Map<string, PortType>; edges: Set<string> }>();
function portsOf(obs: CatanObservation): { byVertex: Map<string, PortType>; edges: Set<string> } {
  let p = portCache.get(obs.board.ports);
  if (!p) {
    const byVertex = new Map<string, PortType>();
    for (const port of obs.board.ports) {
      for (const v of obs.board.edges[port.edge]!.vertices) byVertex.set(v, port.type);
    }
    p = { byVertex, edges: new Set(obs.board.ports.map((port) => port.edge)) };
    portCache.set(obs.board.ports, p);
  }
  return p;
}

/** The v3 per-corner / per-road look-ahead (plan.ts). */
interface Lookahead {
  races: Float32Array;
  gains: BuildGains;
  opp: OpponentTargets;
  opening: OpeningOutlook | null;
}

function writeVertices(obs: CatanObservation, b: BoardFacts, x: Float32Array, look: Lookahead): void {
  const { races, gains, opp: oppNext, opening } = look;
  const idx = b.idx;
  const portAt = portsOf(obs).byVertex;
  const anchor = obs.decision?.type === 'setupRoad' ? obs.decision.settlement : null;
  const mine = production(obs, obs.players[0]!);
  const w = new Row(x, VERTEX_LAYOUT);
  idx.vertexIds.forEach((id, v) => {
    w.at(v * VERTEX_DIM);
    w.set('present', 1);
    const owner = b.vertexOwner[v]!;
    if (owner >= 0) {
      w.set(b.vertexCity[v] ? 'city' : 'settlement', 1);
      w.oneHot('owner', seatSlot(owner));
    }
    w.flag('open', b.open[v] === 1);
    w.flag('canSettle', b.canSettle[v] === 1);
    w.flag('canCity', b.canCity[v] === 1);
    w.oneHot('myDistance', b.dist[0]![v]!);
    let opp = FAR;
    for (let o = 1; o < b.dist.length; o++) opp = Math.min(opp, b.dist[o]![v]!);
    w.oneHot('oppDistance', opp);
    const pips = b.vertexPips.subarray(v * R, v * R + R);
    w.values('pips', pips, 1 / 10);
    let total = 0;
    let kinds = 0;
    for (let r = 0; r < R; r++) {
      total += pips[r]!;
      if (pips[r]! > 0) kinds++;
    }
    w.set('totalPips', total / 15);
    w.set('resourceKinds', kinds / 3);
    let hexes = 0;
    for (let k = 0; k < 3; k++) {
      const h = idx.vertexHexes[v * 3 + k]!;
      if (h < 0) continue;
      hexes++;
      if (h === b.robberHex) w.set('robberAdjacent', 1);
    }
    const port = portAt.get(id);
    w.oneHot('port', port ? PORTS.indexOf(port) : -1);
    w.flag('coastal', idx.coastalVertex[v] === 1);
    w.set('hexCount', hexes / 3);
    w.flag('setupAnchor', id === anchor);
    // ---- v2 ----
    let fresh = 0;
    let cards = 0;
    for (let r = 0; r < R; r++) if (pips[r]! > 0 && mine[r] === 0) fresh++;
    for (let k = 0; k < 3; k++) {
      const h = idx.vertexHexes[v * 3 + k]!;
      if (h >= 0 && obs.board.hexes[idx.hexIds[h]!]!.numberToken !== null) cards++;
    }
    w.set('v2.diversity', fresh / 3);
    w.set('v2.startCards', cards / 3);
    if (port) {
      const r = RESOURCES.indexOf(port as (typeof RESOURCES)[number]);
      w.set('v2.portFit', r >= 0 ? clamp((mine[r]! + pips[r]!) / 10, 0, 2) : 0.3);
    }
    if (b.open[v] === 1) w.set('v2.contest', clamp((opp - b.dist[0]![v]!) / 2, -2, 2));
    // ---- v3 ----
    if (!Number.isNaN(races[v]!)) w.set('v3.race', clamp(races[v]! / 3, -2, 2));
    if (!Number.isNaN(gains.vertex[v]!)) w.set('v3.speedup', clamp(gains.vertex[v]! / 5, -2, 2));
    if (oppNext.chance[v]! > 0) {
      w.set('v3.oppNext', oppNext.chance[v]!);
      w.set('v3.oppNextTurns', Math.min(3, oppNext.turns[v]! / 10));
    }
    if (opening) {
      if (opening.round === 1) w.set('v3.secondOpen', opening.secondOpen[v]!);
      if (!Number.isNaN(opening.pairBest[v]!)) w.set('v3.pairBest', clamp(opening.pairBest[v]!, 0, 2));
    }
  });
}

function writeEdges(obs: CatanObservation, b: BoardFacts, x: Float32Array, look: Lookahead): void {
  const { races, gains, opp: oppNext } = look;
  const idx = b.idx;
  const portEdges = portsOf(obs).edges;
  const w = new Row(x, EDGE_LAYOUT);
  idx.edgeIds.forEach((id, e) => {
    w.at(e * EDGE_DIM);
    w.set('present', 1);
    const owner = b.edgeOwner[e]!;
    if (owner >= 0) w.oneHot('road', seatSlot(owner));
    w.flag('draftRoad', b.draftEdge[e] === 1);
    w.flag('canRoad', b.canRoad[e] === 1);
    w.flag('port', portEdges.has(id));
    w.flag('coastal', idx.coastalEdge[e] === 1);
    for (let k = 0; k < 2; k++) {
      const vo = b.vertexOwner[idx.edgeVertices[e * 2 + k]!]!;
      if (vo > 0) w.set('blockedEnd', 1);
    }
    // ---- v3: what lies past a road the viewer could build here ----
    if (b.canRoad[e] === 1) {
      let wins = 0;
      let loses = 0;
      let threat = 0;
      for (const v of cornersNear(b, e)) {
        threat = Math.max(threat, oppNext.chance[v]!);
        const m = races[v]!;
        if (Number.isNaN(m)) continue;
        if (m > 0.25) wins++;
        else if (m < -0.25) loses++;
      }
      w.set('v3.wins', Math.min(2, wins / 3));
      w.set('v3.loses', Math.min(2, loses / 3));
      w.set('v3.oppNextNear', threat);
      if (!Number.isNaN(gains.edge[e]!)) w.set('v3.speedup', clamp(gains.edge[e]! / 5, -2, 2));
    }
  });
}

/** Vertices within two steps of edge `e`'s ends, not through an opponent's building. */
function cornersNear(b: BoardFacts, e: number): number[] {
  const idx = b.idx;
  const seen = new Set<number>();
  let frontier = [idx.edgeVertices[e * 2]!, idx.edgeVertices[e * 2 + 1]!];
  for (const v of frontier) seen.add(v);
  for (let step = 0; step < 2; step++) {
    const next: number[] = [];
    for (const u of frontier) {
      if (b.vertexOwner[u]! > 0) continue;
      for (let k = 0; k < 3; k++) {
        const n = idx.vertexNeighbors[u * 3 + k]!;
        if (n >= 0 && !seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

function writeGlobal(obs: CatanObservation, b: BoardFacts, x: Float32Array, plans: SeatPlan[]): void {
  const w = new Row(x, GLOBAL_LAYOUT);
  const n = obs.playerCount;
  const target = obs.vpToWin;
  const d = obs.decision;
  const me = obs.players[0]!;

  // ---- the decision at hand ----
  w.oneHot('decision', d ? (DECISIONS as readonly string[]).indexOf(d.type) : -1);
  if (d?.type === 'setupSettlement' || d?.type === 'setupRoad') w.flag('decision.setupRound2', d.round === 2);
  if (d?.type === 'discard') {
    const chosen = counts(d.chosen);
    w.set('decision.discardRequired', d.required / 10);
    w.set('decision.discardLeft', (d.required - sum(chosen)) / 10);
    w.values('decision.discardChosen', chosen, 1 / 10);
  }
  if (d?.type === 'robberHex') w.flag('decision.robberKnight', d.reason === 'knight');
  if (d?.type === 'robberVictim') for (const off of d.candidates) w.set('decision.victims', 1, seatSlot(off) - 1);
  if (d?.type === 'roadBuilding') w.set('decision.roadsPlaced', d.placed.length / 2);
  if (d?.type === 'tradeResponse' || d?.type === 'counterOffer') {
    w.set('decision.tradeProposer', 1, seatSlot(d.proposerOffset) - 1);
    w.values('decision.tradeGive', counts(d.give), 1 / 5);
    w.values('decision.tradeGet', counts(d.get), 1 / 5);
    w.flag('decision.tradeCounter', d.type === 'tradeResponse' && d.counter);
  }
  if (d?.type === 'main') {
    w.flag('decision.canPlayDev', d.canPlayDev);
    w.flag('decision.playerTrades', d.playerTrades);
  }

  // ---- this turn ----
  w.flag('turn.mine', obs.currentOffset === 0);
  w.oneHot('turn.actor', seatSlot(obs.currentOffset));
  w.oneHot('turn.holder', seatSlot(obs.turnHolderOffset));
  w.flag('turn.rolled', obs.hasRolled);
  w.flag('turn.playedDev', obs.hasPlayedDevCard);
  w.flag('turn.pairedPlayer2', obs.pairedPlayer2);
  w.set('turn.tradesProposed', Math.min(1, obs.tradesProposedThisTurn / 3));
  w.flag('turn.tradePending', obs.pendingTrade !== null);
  w.values('turn.tradedAway', RESOURCES.map((r) => (obs.tradedThisTurn.given.includes(r) ? 1 : 0)));
  w.values('turn.tradedFor', RESOURCES.map((r) => (obs.tradedThisTurn.received.includes(r) ? 1 : 0)));

  // ---- game, bank, dev deck, dice ----
  w.oneHot('game.players', Math.min(MAX_PLAYERS, Math.max(2, n)) - 2);
  w.oneHot('game.variant', ['3-4', '5-6', '7-8'].indexOf(obs.boardVariant));
  w.set('game.vpToWin', target / 10);
  w.set('game.turn', Math.min(2, obs.rolls.length / 100));
  w.values('bank.resources', counts(obs.bank), 1 / obs.bankSize);
  w.set('bank.total', sum(counts(obs.bank)) / (R * obs.bankSize));
  const devTotal = sum(DEV_TYPES.map((c) => obs.devDeckTotals[c]));
  const unseenTotal = sum(DEV_TYPES.map((c) => obs.unseenDev[c]));
  w.set('dev.deck', devTotal > 0 ? obs.devDeckSize / devTotal : 0);
  w.values('dev.unseen', DEV_TYPES.map((c) => (obs.devDeckTotals[c] > 0 ? obs.unseenDev[c] / obs.devDeckTotals[c] : 0)));
  w.set('dev.unseenTotal', devTotal > 0 ? unseenTotal / devTotal : 0);
  const rolls = obs.rolls;
  if (rolls.length > 0) {
    const hist = new Array<number>(TOTALS).fill(0);
    for (const t of rolls) hist[t - 2]! += 1 / rolls.length;
    w.values('dice.histogram', hist);
  }
  for (let k = 0; k < RECENT_ROLLS && k < rolls.length; k++) {
    w.set('dice.recent', 1, k * TOTALS + rolls[rolls.length - 1 - k]! - 2);
  }
  const lastSeven = rolls.lastIndexOf(7);
  w.set('dice.sinceSeven', Math.min(1, (rolls.length - 1 - lastSeven) / 12));
  if (obs.largestArmy) {
    w.oneHot('largestArmy.holder', seatSlot(obs.largestArmy.holderOffset));
    w.set('largestArmy.size', obs.largestArmy.size / 10);
  }
  if (obs.longestRoad) {
    w.oneHot('longestRoad.holder', seatSlot(obs.longestRoad.holderOffset));
    w.set('longestRoad.length', obs.longestRoad.length / MAX_ROADS);
  }

  // ---- me ----
  const hand = counts(me.hand!);
  const unplayed = me.devCards!;
  const myProduction = production(obs, me);
  w.values('me.hand', hand, 1 / 10);
  w.set('me.handSize', Math.min(4, me.handSize / 20));
  w.flag('me.over7', me.handSize > 7);
  w.values('me.playable', PLAYABLE_DEV.map((c) => unplayed.playable[c]), 1 / 5);
  w.values('me.boughtThisTurn', PLAYABLE_DEV.map((c) => unplayed.boughtThisTurn[c]), 1 / 3);
  w.set('me.vpCards', unplayed.victoryPoints / 5);
  w.values('me.played', played(me), 1 / 5);
  w.set('me.devBought', Math.min(4, me.devBought / 10));
  w.set('me.publicVp', me.publicVp / target);
  w.set('me.trueVp', me.trueVp! / target);
  w.set('me.vpGap', clamp((target - me.trueVp!) / target, -1, 1));
  w.values('me.pieces', pieces(me));
  w.values('me.ports', portFlags(me));
  w.values('me.tradeRate', RESOURCES.map((r) => (4 - (me.ports.includes(r) ? 2 : me.ports.includes('generic') ? 3 : 4)) / 2));
  w.values('me.production', myProduction, 1 / 10);
  w.set('me.productionTotal', sum(myProduction) / 20);
  w.values('me.afford', AFFORD_COSTS.map((cost) => (cost.every((c, r) => hand[r]! >= c) ? 1 : 0)));
  w.set('me.longestRoad', me.longestRoad / MAX_ROADS);
  w.flag('me.hasLongestRoad', me.hasLongestRoad);
  w.flag('me.hasLargestArmy', me.hasLargestArmy);
  const count = (xs: Uint8Array) => xs.reduce((n, v) => n + v, 0);
  w.set('me.settleSpots', Math.min(4, count(b.canSettle) / 5));
  w.set('me.citySpots', count(b.canCity) / MAX_CITIES);
  w.set('me.roadSpots', Math.min(4, count(b.canRoad) / 10));

  // ---- the next three seats ----
  const pVp = unseenTotal > 0 ? obs.unseenDev.victoryPoint / unseenTotal : 0;
  for (let k = 1; k <= NEXT_SEATS && k < n; k++) {
    const p = obs.players[k]!;
    const t = `next${k}`;
    const prod = production(obs, p);
    w.set(`${t}.present`, 1);
    w.set(`${t}.handSize`, Math.min(4, p.handSize / 20));
    w.flag(`${t}.over7`, p.handSize > 7);
    w.values(`${t}.mean`, p.estimate.mean, 1 / 10);
    w.values(`${t}.atLeast1`, p.estimate.atLeast1);
    w.values(`${t}.atLeast2`, p.estimate.atLeast2);
    w.values(`${t}.afford`, p.estimate.afford);
    w.set(`${t}.certainty`, p.estimate.certainty);
    w.set(`${t}.devCards`, Math.min(4, p.devCardCount / 5));
    w.set(`${t}.hiddenVp`, Math.min(4, p.devCardCount * pVp));
    w.values(`${t}.played`, played(p), 1 / 5);
    w.set(`${t}.devBought`, Math.min(4, p.devBought / 10));
    w.set(`${t}.publicVp`, p.publicVp / target);
    w.set(`${t}.vpGap`, clamp((target - p.publicVp) / target, -1, 1));
    w.values(`${t}.pieces`, pieces(p));
    w.values(`${t}.ports`, portFlags(p));
    w.values(`${t}.production`, prod, 1 / 10);
    w.set(`${t}.productionTotal`, sum(prod) / 20);
    w.set(`${t}.longestRoad`, p.longestRoad / MAX_ROADS);
    w.flag(`${t}.hasLongestRoad`, p.hasLongestRoad);
    w.flag(`${t}.hasLargestArmy`, p.hasLargestArmy);
  }

  // ---- seats further round, pooled ----
  const far = obs.players.slice(NEXT_SEATS + 1);
  if (far.length > 0) {
    const farProd = new Array<number>(R).fill(0);
    for (const p of far) production(obs, p).forEach((v, r) => { farProd[r]! += v; });
    w.set('far.count', far.length / (MAX_PLAYERS - 1 - NEXT_SEATS));
    w.set('far.maxVp', Math.max(...far.map((p) => p.publicVp)) / target);
    w.set('far.hands', Math.min(4, sum(far.map((p) => p.handSize)) / 40));
    w.set('far.devCards', Math.min(4, sum(far.map((p) => p.devCardCount)) / 10));
    w.set('far.maxKnights', Math.max(...far.map((p) => p.played.knight)) / 5);
    w.set('far.maxLongestRoad', Math.max(...far.map((p) => p.longestRoad)) / MAX_ROADS);
    w.values('far.production', farProd, 1 / 20);
  }

  // ---- every opponent ----
  const opps = obs.players.slice(1);
  if (opps.length > 0) {
    const maxVp = Math.max(...opps.map((p) => p.publicVp));
    w.set('opps.maxVp', maxVp / target);
    w.set('opps.leader', 1, seatSlot(opps.find((p) => p.publicVp === maxVp)!.offset) - 1);
    w.set('opps.hands', Math.min(4, sum(opps.map((p) => p.handSize)) / 40));
    w.set('opps.devCards', Math.min(4, sum(opps.map((p) => p.devCardCount)) / 10));
    w.set('opps.hiddenVp', Math.min(4, sum(opps.map((p) => p.devCardCount)) * pVp / 3));
  }

  writeGlobalV2(obs, b, w);
  writeGlobalV3(obs, w, plans);
}

function writeGlobalV3(obs: CatanObservation, w: Row, plans: SeatPlan[]): void {
  const n = obs.playerCount;
  const target = obs.vpToWin;
  // How close each seat is to winning.
  for (let k = 0; k <= NEXT_SEATS && k < n; k++) {
    const p = plans[k]!;
    const t = `v3.s${k}`;
    w.set(`${t}.permVp`, p.permVp / target);
    w.set(`${t}.tempVp`, p.tempVp / target);
    w.set(`${t}.expVp`, clamp(p.expVp / target, 0, 2));
    w.set(`${t}.soon`, p.soon);
    w.values(`${t}.options`, p.options.map((o) => clamp(o / 10, 0, NEVER / 10)));
    w.set(`${t}.eta`, clamp(p.eta / 20, 0, 2));
    const others = plans.filter((_, j) => j !== k).map((q) => q.eta);
    if (others.length > 0) w.set(`${t}.etaLead`, clamp((p.eta - Math.min(...others)) / 10, -2, 2));
    const wp = p.plans;
    w.set(`${t}.planBest`, clamp(wp.best / 20, 0, NEVER / 20));
    w.set(`${t}.planGap`, clamp((wp.second - wp.best) / 10, 0, 3));
    w.set(`${t}.planNear`, Math.min(3, wp.near / 10));
    w.values(`${t}.planShare`, wp.share);
    w.values(`${t}.planMix`, [wp.bestMix[0]! / 5, wp.bestMix[1]! / 4, wp.bestMix[2]! / 5, wp.bestMix[3]!, wp.bestMix[4]!]);
  }
  const leader = trueLeader(plans);
  if (leader > 0) {
    w.set('v3.trueLeader', 1, seatSlot(leader) - 1);
    w.set('v3.leaderGap', clamp((plans[leader]!.eta - plans[0]!.eta) / 10, -2, 2));
  }
  // This turn's offers: who refused the viewer, what nobody would give, what others asked for.
  const refused = new Array<number>(R).fill(0);
  const asked = new Array<number>(NEXT_SEATS * R).fill(0);
  for (const o of obs.turnOffers) {
    if (o.proposerOffset === 0) {
      for (const off of o.rejected) w.set('v3.turn.rejectedBy', Math.min(1, offerCount(obs, off, 'rejected') / 2), seatSlot(off) - 1);
      for (const off of o.accepted) w.set('v3.turn.acceptedBy', Math.min(1, offerCount(obs, off, 'accepted') / 2), seatSlot(off) - 1);
      if (o.accepted.length === 0 && o.tradedWithOffset === null) RESOURCES.forEach((r, j) => { if (o.receive[r] > 0) refused[j] = 1; });
    } else if (o.proposerOffset <= NEXT_SEATS) {
      RESOURCES.forEach((r, j) => { if (o.receive[r] > 0) asked[(o.proposerOffset - 1) * R + j] = 1; });
    }
  }
  w.values('v3.turn.refused', refused);
  w.values('v3.turn.asked', asked);
  // The partner pick.
  const d = obs.decision;
  if (d?.type === 'counterOffer') w.set('v3.decision.counterOffer', 1);
  if (d?.type === 'tradePick') {
    w.set('v3.decision.tradePick', 1);
    for (const off of d.acceptors) w.set('v3.pick.acceptors', 1, seatSlot(off) - 1);
    w.values('v3.pick.give', counts(d.give), 1 / 5);
    w.values('v3.pick.get', counts(d.get), 1 / 5);
  }
}

/** How many of the viewer's offers this turn seat `off` answered that way. */
function offerCount(obs: CatanObservation, off: number, how: 'accepted' | 'rejected'): number {
  return obs.turnOffers.filter((o) => o.proposerOffset === 0 && o[how].includes(off)).length;
}

const SETTLEMENT_COST = [1, 1, 1, 1, 0]; // RESOURCES order: wood, brick, sheep, wheat, ore
const CITY_COST = [0, 0, 0, 2, 3];

/** P(at least one knight among `held` cards drawn blind from `unseen`, `knights` of them knights). */
function pAnyKnight(held: number, unseen: number, knights: number): number {
  if (held <= 0 || knights <= 0 || unseen <= 0) return 0;
  let none = 1;
  for (let j = 0; j < held && j < unseen; j++) none *= Math.max(0, unseen - knights - j) / (unseen - j);
  return 1 - none;
}

function writeGlobalV2(obs: CatanObservation, b: BoardFacts, w: Row): void {
  const n = obs.playerCount;
  const target = obs.vpToWin;
  const placed = obs.players.reduce((s, p) => s + p.settlements.length + p.cities.length, 0);
  const d = obs.decision;
  if (d?.type === 'setupSettlement' || d?.type === 'setupRoad') {
    // The viewer's own settlement this turn: still to place, or just placed (its road next).
    const i = d.type === 'setupRoad' ? placed - 1 : placed;
    w.set('v2.setup.placed', i / (2 * n));
    // Snake order: the viewer's i-th-overall settlement in round 1 is followed
    // by 2n - 2 - 2i others before its second; round 2 is its last.
    if (d.round === 1) w.set('v2.setup.picksBefore', Math.max(0, 2 * n - 2 - 2 * i) / (2 * n));
  }
  const unseenTotal = sum(DEV_TYPES.map((c) => obs.unseenDev[c]));
  const routes = obs.players.map((p) => p.longestRoad);
  const knights = obs.players.map((p) => p.played.knight);
  const V = b.idx.vertexIds.length;
  for (let k = 0; k <= NEXT_SEATS && k < n; k++) {
    const p = obs.players[k]!;
    const t = `v2.s${k}`;
    // Income after the robber, and how much of it the robber is sitting on.
    const prod = production(obs, p);
    w.values(`${t}.income`, prod, 1 / 9); // pips / 36 per roll, × 4
    const numbers = new Set<number>();
    let all = 0;
    let robbed = 0;
    const add = (v: string, mult: number) => {
      for (const h of obs.board.vertices[v]!.hexes) {
        const hex = obs.board.hexes[h]!;
        if (hex.numberToken === null || !RESOURCES.includes(hex.terrain as (typeof RESOURCES)[number])) continue;
        const dots = probabilityDots(hex.numberToken) * mult;
        all += dots;
        if (h === obs.board.robberHex) robbed += dots;
        else numbers.add(hex.numberToken);
      }
    };
    for (const v of p.settlements) add(v, 1);
    for (const v of p.cities) add(v, 2);
    w.set(`${t}.pAnyIncome`, sum([...numbers].map((num) => probabilityDots(num))) / 36);
    if (all > 0) w.set(`${t}.robbed`, robbed / all);
    // Races for the two bonuses.
    const otherRoute = Math.max(0, ...routes.filter((_, j) => j !== k));
    const otherKnights = Math.max(0, ...knights.filter((_, j) => j !== k));
    w.set(`${t}.lrGap`, clamp((routes[k]! - otherRoute) / 5, -2, 2));
    const lrHold = obs.longestRoad ? obs.longestRoad.length + 1 : 5;
    w.set(`${t}.roadsToLr`, p.hasLongestRoad ? 0 : clamp((Math.max(5, lrHold) - routes[k]!) / 5, 0, 3));
    w.set(`${t}.laGap`, clamp((knights[k]! - otherKnights) / 3, -2, 2));
    const laHold = obs.largestArmy ? obs.largestArmy.size + 1 : 3;
    w.set(`${t}.knightsToLa`, p.hasLargestArmy ? 0 : clamp((Math.max(3, laHold) - knights[k]!) / 3, 0, 3));
    // Hidden cards: every VP card it might hold, and the odds it holds a knight.
    if (k === 0) {
      w.set(`${t}.vpCeiling`, p.trueVp! / target);
      const own = p.devCards!;
      w.set(`${t}.pKnight`, own.playable.knight + own.boughtThisTurn.knight > 0 ? 1 : 0);
    } else {
      w.set(`${t}.vpCeiling`, (p.publicVp + Math.min(p.devCardCount, obs.unseenDev.victoryPoint)) / target);
      w.set(`${t}.pKnight`, pAnyKnight(p.devCardCount, unseenTotal, obs.unseenDev.knight));
    }
    // What it still needs for its next settlement / city (where it can build one).
    const mean = k === 0 ? counts(p.hand!) : p.estimate.mean;
    let spots1 = 0;
    let spots2 = 0;
    let contested = 0;
    const dist = b.dist[k]!;
    for (let v = 0; v < V; v++) {
      if (b.open[v] !== 1) continue;
      const dv = dist[v]!;
      if (dv <= 1) spots1++;
      if (dv <= 2) {
        spots2++;
        for (let o = 0; o < b.dist.length; o++) {
          if (o !== k && b.dist[o]![v]! <= dv) {
            contested++;
            break;
          }
        }
      }
    }
    const canSettle = spots1 > 0 && p.settlements.length < MAX_SETTLEMENTS;
    const canCity = p.settlements.length > 0 && p.cities.length < MAX_CITIES;
    const need = RESOURCES.map((_, r) =>
      Math.max(canSettle ? Math.max(0, SETTLEMENT_COST[r]! - mean[r]!) : 0, canCity ? Math.max(0, CITY_COST[r]! - mean[r]!) : 0),
    );
    w.values(`${t}.need`, need, 1 / 3);
    w.set(`${t}.needSettle`, canSettle ? sum(RESOURCES.map((_, r) => Math.max(0, SETTLEMENT_COST[r]! - mean[r]!))) / 4 : 0);
    w.set(`${t}.needCity`, canCity ? sum(RESOURCES.map((_, r) => Math.max(0, CITY_COST[r]! - mean[r]!))) / 5 : 0);
    if (k > 0 && p.handSize > 0) w.values(`${t}.stealOdds`, mean.map((m) => m / p.handSize));
    w.set(`${t}.spots1`, Math.min(4, spots1 / 5));
    w.set(`${t}.spots2`, Math.min(4, spots2 / 8));
    w.set(`${t}.contested`, Math.min(4, contested / 5));
  }
}

/** `facts` — analyseBoard(obs), if the caller already has it (the action mask needs it too). */
export function encodeObservation(obs: CatanObservation, facts?: BoardFacts): CatanFeatures {
  const idx = obs.index;
  const out: CatanFeatures = {
    numHexes: idx.hexIds.length,
    numVertices: idx.vertexIds.length,
    numEdges: idx.edgeIds.length,
    hexes: new Float32Array(idx.hexIds.length * HEX_DIM),
    vertices: new Float32Array(idx.vertexIds.length * VERTEX_DIM),
    edges: new Float32Array(idx.edgeIds.length * EDGE_DIM),
    global: new Float32Array(GLOBAL_DIM),
  };
  const b = facts ?? analyseBoard(obs);
  const plans = seatPlans(obs, b);
  const look: Lookahead = {
    races: cornerRaces(b, plans),
    gains: buildGains(obs, b, plans),
    opp: opponentTargets(obs, b, plans),
    opening: openingOutlook(obs, b),
  };
  writeHexes(obs, b, out.hexes, plans);
  writeVertices(obs, b, out.vertices, look);
  writeEdges(obs, b, out.edges, look);
  writeGlobal(obs, b, out.global, plans);
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}


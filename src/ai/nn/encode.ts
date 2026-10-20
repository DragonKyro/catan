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

import type { PortType, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { probabilityDots } from '../value';
import type { BoardIndex } from './board';
import { AFFORD_COSTS, DEV_TYPES, PLAYABLE_DEV } from './knowledge';
import type { CatanObservation, ObservedPlayer } from './observation';

export const ENCODER_VERSION = 1;

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
const DIST_BUCKETS = 5;
const FAR = DIST_BUCKETS - 1;
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
  .add('buildings', SEAT_SLOTS); // settlements + 2 × cities on its corners, per seat slot

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
  .add('setupAnchor', 1); // the settlement a setup road must touch

export const EDGE_LAYOUT = new FeatureLayout()
  .add('present', 1)
  .add('road', SEAT_SLOTS)
  .add('draftRoad', 1) // chosen earlier in this Road Building
  .add('canRoad', 1)
  .add('port', 1)
  .add('coastal', 1)
  .add('blockedEnd', 1); // an opponent's building sits on an endpoint

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

function writeHexes(obs: CatanObservation, b: BoardFacts, x: Float32Array): void {
  const idx = b.idx;
  const rolls = obs.rolls;
  const draftHex = obs.decision?.type === 'robberVictim' ? idx.hexIndex.get(obs.decision.hex)! : -1;
  const rolled = new Array<number>(13).fill(0);
  for (const t of rolls) rolled[t]! += 1;
  const buildings = HEX_LAYOUT.seg('buildings').offset;
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
    for (let k = 0; k < 6; k++) {
      const v = idx.hexVertices[h * 6 + k]!;
      const owner = b.vertexOwner[v]!;
      if (owner < 0) continue;
      x[h * HEX_DIM + buildings + seatSlot(owner)]! += (b.vertexCity[v] ? 2 : 1) / 3;
    }
  });
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

function writeVertices(obs: CatanObservation, b: BoardFacts, x: Float32Array): void {
  const idx = b.idx;
  const portAt = portsOf(obs).byVertex;
  const anchor = obs.decision?.type === 'setupRoad' ? obs.decision.settlement : null;
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
  });
}

function writeEdges(obs: CatanObservation, b: BoardFacts, x: Float32Array): void {
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
  });
}

function writeGlobal(obs: CatanObservation, b: BoardFacts, x: Float32Array): void {
  const w = new Row(x, GLOBAL_LAYOUT);
  const n = obs.playerCount;
  const target = obs.vpToWin;
  const d = obs.decision;
  const me = obs.players[0]!;

  // ---- the decision at hand ----
  w.oneHot('decision', d ? DECISIONS.indexOf(d.type) : -1);
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
  if (d?.type === 'tradeResponse') {
    w.set('decision.tradeProposer', 1, seatSlot(d.proposerOffset) - 1);
    w.values('decision.tradeGive', counts(d.give), 1 / 5);
    w.values('decision.tradeGet', counts(d.get), 1 / 5);
    w.flag('decision.tradeCounter', d.counter);
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
  writeHexes(obs, b, out.hexes);
  writeVertices(obs, b, out.vertices);
  writeEdges(obs, b, out.edges);
  writeGlobal(obs, b, out.global);
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}


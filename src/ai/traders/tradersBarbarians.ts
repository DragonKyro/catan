import type {
  Action,
  CommodityGood,
  CommodityLocationId,
  EdgeId,
  GameState,
  PlayerId,
  Resource,
  VertexId,
} from '@/game/types';
import { COSTS, RESOURCES } from '@/game/types';
import { canAfford, totalResources } from '@/game/resources';
import { canConnectRoad, canPlaceSettlement } from '@/game/placement';
import { calculateVictoryPoints } from '@/game/scoring/points';
import {
  barbarianTargetEdges,
  destinationOf,
  driveOffTargets,
  isPlaza,
  isTradersBarbarians,
  legalWagonSteps,
  locationById,
  roadOwner,
  wagonEdgeCost,
  wagonLevelInfo,
  wagonOf,
} from '@/game/modules/traders/tradersBarbarians/state';
import {
  TB_BOOST_COST,
  TB_BOOST_MP,
  TB_MAX_WAGON_LEVEL,
  TB_MP_BARBARIAN,
  TB_WAGON_UPGRADE_COSTS,
} from '@/game/modules/traders/tradersBarbarians/constants';
import { getBankTradeRate } from '@/game/actions/trade';
import { RESOURCE_WEIGHT, reportNeeds, vertexScore } from '../value';

// Heuristic AI for the Traders & Barbarians scenario (2025 rulebook
// pp. 20-24). Pure and stateless: every call re-plans from the state.
//
// The core is a route planner over the board graph (corners, plazas and the
// interior paths), with each edge costing what the wagon pays for it: 2 MP
// with no road, 1 on our road, 1 + a toll on a rival's, +2 with a barbarian.
// Plazas other than the destination can't be passed through (entering one
// ends the move). On top of it:
//   - wagon phase: head for the delivery plaza (or, empty, the plaza whose
//     next pickup is expected to be delivered soonest — only the remaining
//     composition of each face-down stack, never its order), spend wheat when
//     it reaches the plaza this move, try every drive-off within reach (a
//     try is free and a success lets us park that barbarian on a rival's
//     route), play Swift Journey for an extra move that delivers or helps;
//   - barbarian placement: block the route a rival (weighted by how close
//     they are to winning) is about to take, rob a rival's road, keep our
//     own route clear;
//   - Knights for Largest Army or a strong barbarian move; Road Building
//     along our routes;
//   - main phase: upgrade the wagon when it pays, roads on our delivery
//     routes (1 MP instead of 2 on every trip).

// Planning weight of paying a toll (a coin is worth about half a card).
const TOLL_WEIGHT = 0.8;
const UNREACHABLE = 1e9;

interface Dist {
  dist: Map<VertexId, number>;
  target: VertexId;
}

function playerGold(state: GameState, pid: PlayerId): number {
  return state.players.find((p) => p.id === pid)?.gold ?? 0;
}

// Planning cost of an edge for `pid` (MP + toll weight). Without gold a
// rival's road is closed for now — priced high rather than removed, since
// gold comes in with every delivery.
function planCost(state: GameState, pid: PlayerId, edge: EdgeId, gold: number): number {
  const c = wagonEdgeCost(state, pid, edge);
  if (!c.toll) return c.mp;
  return c.mp + (gold > 0 ? TOLL_WEIGHT : 4);
}

// Planning distance from every intersection to `target` (Dijkstra from the
// target). A plaza other than the target is a dead end: the move would stop
// there.
function distancesTo(state: GameState, pid: PlayerId, target: VertexId): Dist {
  const gold = playerGold(state, pid);
  const dist = new Map<VertexId, number>([[target, 0]]);
  const done = new Set<VertexId>();
  const frontier: Array<[VertexId, number]> = [[target, 0]];
  while (frontier.length > 0) {
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) if (frontier[i]![1] < frontier[bi]![1]) bi = i;
    const [u, du] = frontier.splice(bi, 1)[0]!;
    if (done.has(u)) continue;
    done.add(u);
    if (u !== target && isPlaza(state, u)) continue;
    for (const eid of state.board.vertices[u]?.edges ?? []) {
      const e = state.board.edges[eid]!;
      const v = e.vertices[0] === u ? e.vertices[1] : e.vertices[0];
      const nd = du + planCost(state, pid, eid, gold);
      if (nd < (dist.get(v) ?? UNREACHABLE)) {
        dist.set(v, nd);
        frontier.push([v, nd]);
      }
    }
  }
  return { dist, target };
}

function distFrom(d: Dist, v: VertexId): number {
  return d.dist.get(v) ?? UNREACHABLE;
}

// The edges of one shortest route from `from` along `d`, with the MP spent
// when each is reached.
function routeEdges(
  state: GameState,
  pid: PlayerId,
  from: VertexId,
  d: Dist,
): Array<{ edge: EdgeId; mpAt: number }> {
  const gold = playerGold(state, pid);
  const out: Array<{ edge: EdgeId; mpAt: number }> = [];
  let cur = from;
  let mp = 0;
  for (let guard = 0; guard < 60 && cur !== d.target; guard++) {
    const here = distFrom(d, cur);
    if (here >= UNREACHABLE) break;
    let best: { edge: EdgeId; to: VertexId; cost: number } | null = null;
    for (const eid of state.board.vertices[cur]?.edges ?? []) {
      const e = state.board.edges[eid]!;
      const to = e.vertices[0] === cur ? e.vertices[1] : e.vertices[0];
      if (to !== d.target && isPlaza(state, to)) continue;
      const cost = planCost(state, pid, eid, gold);
      const via = cost + distFrom(d, to);
      if (via <= here + 1e-9 && (!best || eid < best.edge)) best = { edge: eid, to, cost };
    }
    if (!best) break;
    mp += wagonEdgeCost(state, pid, best.edge).mp;
    out.push({ edge: best.edge, mpAt: mp });
    cur = best.to;
  }
  return out;
}

// Where `pid`'s wagon is heading: the plaza wanting its token, or (empty)
// the plaza with the soonest expected delivery. Null = nothing to do.
export function wagonTarget(state: GameState, pid: PlayerId): VertexId | null {
  const tb = state.tradersBarbarians;
  const wagon = wagonOf(state, pid);
  if (!tb || !wagon) return null;
  if (wagon.cargo) return locationById(state, destinationOf(wagon.cargo.good))?.plaza ?? null;
  let best: { plaza: VertexId; score: number } | null = null;
  const plazaDist = new Map<CommodityLocationId, Dist>();
  for (const loc of tb.locations) plazaDist.set(loc.id, distancesTo(state, pid, loc.plaza));
  for (const loc of tb.locations) {
    if (loc.stack.length === 0) continue;
    if (loc.plaza === wagon.vertex) continue; // nothing left here to take
    const reach = distFrom(plazaDist.get(loc.id)!, wagon.vertex);
    if (reach >= UNREACHABLE) continue;
    // Expected trip on from this plaza, by what is left in the stack.
    const counts = new Map<CommodityGood, number>();
    for (const g of loc.stack) counts.set(g, (counts.get(g) ?? 0) + 1);
    let onward = 0;
    for (const [g, n] of counts) {
      const dest = plazaDist.get(destinationOf(g))!;
      onward += (n / loc.stack.length) * Math.min(distFrom(dest, loc.plaza), 40);
    }
    const score = reach + onward;
    if (!best || score < best.score) best = { plaza: loc.plaza, score };
  }
  return best?.plaza ?? null;
}

interface Reach {
  vertex: VertexId;
  mp: number;
  firstStep: VertexId | null;
}

// Intersections reachable with `mp` movement points this move action (real
// MP, tolls limited by gold, never through a plaza).
function reachable(state: GameState, pid: PlayerId, from: VertexId, mp: number): Reach[] {
  const gold = playerGold(state, pid);
  const best = new Map<VertexId, { mp: number; tolls: number; first: VertexId | null }>([
    [from, { mp: 0, tolls: 0, first: null }],
  ]);
  const frontier: VertexId[] = [from];
  const done = new Set<VertexId>();
  while (frontier.length > 0) {
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (best.get(frontier[i]!)!.mp < best.get(frontier[bi]!)!.mp) bi = i;
    }
    const u = frontier.splice(bi, 1)[0]!;
    if (done.has(u)) continue;
    done.add(u);
    const bu = best.get(u)!;
    if (u !== from && isPlaza(state, u)) continue;
    for (const eid of state.board.vertices[u]?.edges ?? []) {
      const e = state.board.edges[eid]!;
      const v = e.vertices[0] === u ? e.vertices[1] : e.vertices[0];
      const c = wagonEdgeCost(state, pid, eid);
      const nm = bu.mp + c.mp;
      const nt = bu.tolls + (c.toll ? 1 : 0);
      if (nm > mp || nt > gold) continue;
      const cur = best.get(v);
      if (!cur || nm < cur.mp) {
        best.set(v, { mp: nm, tolls: nt, first: bu.first ?? v });
        frontier.push(v);
      }
    }
  }
  return [...best.entries()].map(([vertex, b]) => ({ vertex, mp: b.mp, firstStep: b.first }));
}

// The best spot to end this move on, toward `d.target`.
function bestStop(state: GameState, pid: PlayerId, from: VertexId, mp: number, d: Dist): Reach & { dist: number } {
  let best: (Reach & { dist: number }) | null = null;
  for (const r of reachable(state, pid, from, mp)) {
    const dist = distFrom(d, r.vertex);
    if (
      !best ||
      dist < best.dist - 1e-9 ||
      (Math.abs(dist - best.dist) < 1e-9 && (r.mp < best.mp || (r.mp === best.mp && r.vertex < best.vertex)))
    ) {
      best = { ...r, dist };
    }
  }
  return best!;
}

function wheatToSpare(state: GameState, pid: PlayerId): boolean {
  const p = state.players.find((x) => x.id === pid)!;
  if (!canAfford(p.resources, TB_BOOST_COST)) return false;
  const needs = reportNeeds(state, pid);
  // Keep the last wheat when a city / settlement is close and needs it.
  if ((needs.goal === 'city' || needs.goal === 'settlement') && p.resources.wheat <= 2) {
    const short = RESOURCES.reduce((s, r) => s + (needs.byResource[r] ?? 0), 0);
    if (short <= 1 && p.resources.wheat <= (needs.goal === 'city' ? 2 : 1)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Phase 'wagonMoves'
// ---------------------------------------------------------------------------

export function chooseWagonMove(state: GameState, pid: PlayerId): Action | null {
  if (!isTradersBarbarians(state) || state.phase !== 'wagonMoves') return null;
  const tb = state.tradersBarbarians;
  const turn = tb.wagonTurn;
  const wagon = tb.wagons[pid];
  if (!turn || !wagon) return null;
  const player = state.players.find((p) => p.id === pid)!;

  // A drive-off try costs nothing; a success lets us re-park the barbarian.
  const tries = driveOffTargets(state, pid);
  if (tries.length > 0) return { type: 'driveOffBarbarian', playerId: pid, barbarian: tries[0]! };

  // A Knight that clears our route (or blocks a rival) before we move on.
  const knight = chooseTbKnightPlay(state, pid);
  if (knight) return knight;

  const target = wagonTarget(state, pid);
  const d = target ? distancesTo(state, pid, target) : null;
  const level = wagonLevelInfo(wagon.level);

  if (!turn.ended && d) {
    const now = bestStop(state, pid, wagon.vertex, turn.mp, d);
    if (!turn.boosted && now.dist > 0 && wheatToSpare(state, pid)) {
      const boosted = bestStop(state, pid, wagon.vertex, turn.mp + TB_BOOST_MP, d);
      // +2 MP when it reaches the plaza this move, or (wheat to burn) brings
      // us clearly closer.
      const wheat = player.resources.wheat;
      if (boosted.dist === 0 || (wheat >= 3 && now.dist - boosted.dist >= 2)) {
        return { type: 'boostWagon', playerId: pid };
      }
    }
    if (now.firstStep && now.vertex !== wagon.vertex) {
      const legal = legalWagonSteps(state, pid);
      if (legal.some((s) => s.to === now.firstStep)) {
        return { type: 'moveWagon', playerId: pid, to: now.firstStep };
      }
    }
  }

  // Swift Journey: a second full move when it delivers or gets us well on.
  const sj = tb.swiftJourney[pid]?.unplayed ?? 0;
  if (sj > 0 && turn.moveAction === 1 && !state.hasPlayedDevCardThisTurn) {
    const nextTarget = target;
    if (nextTarget && d) {
      const fresh = bestStop(state, pid, wagon.vertex, level.mp, d);
      const here = distFrom(d, wagon.vertex);
      if (fresh.dist === 0 || here - fresh.dist >= 4 || (sj >= 2 && here - fresh.dist >= 2)) {
        return { type: 'playSwiftJourney', playerId: pid };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Barbarian placement (phase 'moveBarbarian', and Knight decisions)
// ---------------------------------------------------------------------------

interface RouteMark {
  // Edge → how much a barbarian there hurts this wagon (≈ value of the
  // 2 MP it adds, more when it denies a delivery this coming move).
  harm: Map<EdgeId, number>;
}

function routeMark(state: GameState, pid: PlayerId, horizonTurns = 2): RouteMark {
  const harm = new Map<EdgeId, number>();
  const wagon = wagonOf(state, pid);
  const target = wagonTarget(state, pid);
  if (!wagon || !target) return { harm };
  const d = distancesTo(state, pid, target);
  const level = wagonLevelInfo(wagon.level);
  const hasWheat = (state.players.find((p) => p.id === pid)?.resources.wheat ?? 0) > 0;
  const nextMove = level.mp + (hasWheat ? TB_BOOST_MP : 0);
  const route = routeEdges(state, pid, wagon.vertex, d);
  const total = route.length > 0 ? route[route.length - 1]!.mpAt : 0;
  const deliversNext = total > 0 && total <= nextMove;
  for (const step of route) {
    if (step.mpAt > level.mp * horizonTurns + 2) break;
    let h = step.mpAt <= nextMove ? 1.2 : 0.6;
    // A barbarian here pushes the delivery past this move.
    if (deliversNext && total + TB_MP_BARBARIAN > nextMove) h += 1.5;
    // Already blocked: a second… can't stack, nothing to add.
    harm.set(step.edge, Math.max(harm.get(step.edge) ?? 0, h));
  }
  return { harm };
}

function vpOf(state: GameState, pid: PlayerId): number {
  return calculateVictoryPoints(state, pid, false);
}

// How much more a rival matters (leaders and near-winners count double).
function threatWeight(state: GameState, me: PlayerId, rival: PlayerId): number {
  const mine = vpOf(state, me);
  const theirs = vpOf(state, rival);
  let w = 1 + Math.max(0, theirs - mine) * 0.15;
  if (theirs >= state.settings.victoryPointsToWin - 3) w += 0.6;
  return w;
}

export interface BarbarianChoice {
  barbarian: number;
  edge: EdgeId;
  score: number;
}

// Best barbarian + edge for `pid`. `fixed` = the barbarian that must move
// (drive-off). `steal` = whether a road there is robbed (7 / Knight).
export function bestBarbarianMove(
  state: GameState,
  pid: PlayerId,
  fixed: number | undefined,
  steal: boolean,
): BarbarianChoice | null {
  const tb = state.tradersBarbarians;
  if (!tb) return null;
  const mine = routeMark(state, pid);
  const rivals = state.players
    .filter((p) => p.id !== pid && wagonOf(state, p.id))
    .map((p) => ({ id: p.id, w: threatWeight(state, pid, p.id), mark: routeMark(state, p.id) }));
  const rivalHarm = (e: EdgeId) => rivals.reduce((s, r) => s + (r.mark.harm.get(e) ?? 0) * r.w, 0);
  const myHarm = (e: EdgeId) => mine.harm.get(e) ?? 0;
  const stealValue = (e: EdgeId): number => {
    if (!steal) return 0;
    const owner = roadOwner(state, e);
    if (!owner || owner === pid) return 0;
    const victim = state.players.find((p) => p.id === owner)!;
    if (totalResources(victim.resources) === 0) return 0;
    return 1.0 + 0.4 * (threatWeight(state, pid, owner) - 1) + Math.min(totalResources(victim.resources), 8) * 0.05;
  };
  const targets = barbarianTargetEdges(state);
  let best: BarbarianChoice | null = null;
  const indices = fixed !== undefined ? [fixed] : tb.barbarians.map((_, i) => i);
  for (const i of indices) {
    const from = tb.barbarians[i]!;
    const leave = myHarm(from) - rivalHarm(from);
    for (const e of targets) {
      const score = leave + rivalHarm(e) - myHarm(e) * 1.2 + stealValue(e);
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && e < best.edge)) {
        best = { barbarian: i, edge: e, score };
      }
    }
  }
  return best;
}

export function chooseTbBarbarianMove(state: GameState, pid: PlayerId): Action | null {
  const pending = state.tradersBarbarians?.pendingBarbarian;
  if (state.phase !== 'moveBarbarian' || !pending || pending.playerId !== pid) return null;
  const choice = bestBarbarianMove(state, pid, pending.barbarian, pending.reason !== 'driveOff');
  if (choice) return { type: 'moveTbBarbarian', playerId: pid, barbarian: choice.barbarian, edge: choice.edge };
  // Fallback (never expected): first free edge.
  const edge = barbarianTargetEdges(state)[0];
  if (edge === undefined) return null;
  return { type: 'moveTbBarbarian', playerId: pid, barbarian: pending.barbarian ?? 0, edge };
}

// ---------------------------------------------------------------------------
// Development cards
// ---------------------------------------------------------------------------

// Knight: for Largest Army (in play in this scenario), or when moving a
// barbarian is clearly worth it (frees our route, blocks a leader, robs).
export function chooseTbKnightPlay(state: GameState, pid: PlayerId): Action | null {
  if (!isTradersBarbarians(state)) return null;
  if (state.hasPlayedDevCardThisTurn) return null;
  if (state.phase !== 'main' && state.phase !== 'wagonMoves') return null;
  const player = state.players.find((p) => p.id === pid);
  if (!player || !player.devCards.unplayed.includes('knight')) return null;
  const army = state.largestArmy;
  const played = player.devCards.playedKnights;
  if (!state.noLargestArmy) {
    if (army?.holder !== pid && played + 1 >= (army ? army.size + 1 : 3)) {
      return { type: 'playKnight', playerId: pid };
    }
    // Defend the tile when a rival is one knight behind.
    if (army?.holder === pid) {
      const close = state.players.some((p) => p.id !== pid && p.devCards.playedKnights + 1 >= army.size);
      if (close) return { type: 'playKnight', playerId: pid };
    }
  }
  const move = bestBarbarianMove(state, pid, undefined, true);
  const threshold = state.phase === 'wagonMoves' ? 1.5 : 2.0;
  if (move && move.score >= threshold) return { type: 'playKnight', playerId: pid };
  return null;
}

// Road Building in this scenario: two roads on our delivery routes or
// toward a settlement spot.
export function chooseTbRoadBuilding(state: GameState, pid: PlayerId): Action | null {
  if (!isTradersBarbarians(state) || state.phase !== 'main' || state.hasPlayedDevCardThisTurn) return null;
  const player = state.players.find((p) => p.id === pid);
  if (!player || !player.devCards.unplayed.includes('roadBuilding') || player.roads.length >= 15) return null;
  const edges: EdgeId[] = [];
  let sim: GameState = state;
  for (let k = 0; k < 2 && player.roads.length + edges.length < 15; k++) {
    const pick = bestRouteRoad(sim, pid, true);
    if (!pick) break;
    edges.push(pick.edge);
    sim = {
      ...sim,
      players: sim.players.map((p) => (p.id === pid ? { ...p, roads: [...p.roads, pick.edge] } : p)),
    };
  }
  if (edges.length === 0) return null;
  return { type: 'playRoadBuilding', playerId: pid, edges };
}

// ---------------------------------------------------------------------------
// Main phase
// ---------------------------------------------------------------------------

// Road value for wagon routes: the edges of our current trip and of the
// plaza-to-plaza trips we'll keep making (each road there turns 2 MP into 1
// on every pass), plus the usual expansion value of the new endpoint.
function routeEdgeValues(state: GameState, pid: PlayerId): Map<EdgeId, number> {
  const out = new Map<EdgeId, number>();
  const tb = state.tradersBarbarians;
  if (!tb) return out;
  const add = (e: EdgeId, v: number) => out.set(e, (out.get(e) ?? 0) + v);
  const wagon = wagonOf(state, pid);
  const target = wagonTarget(state, pid);
  if (wagon && target) {
    for (const s of routeEdges(state, pid, wagon.vertex, distancesTo(state, pid, target))) add(s.edge, 1.5);
  }
  const live = tb.locations.filter((l) => l.stack.length > 0 || wagon?.cargo);
  for (const a of live) {
    const d = distancesTo(state, pid, a.plaza);
    for (const b of tb.locations) {
      if (b.id === a.id) continue;
      for (const s of routeEdges(state, pid, b.plaza, d)) add(s.edge, 0.5);
    }
  }
  return out;
}

function bestRouteRoad(
  state: GameState,
  pid: PlayerId,
  allowExpansion: boolean,
): { edge: EdgeId; score: number } | null {
  const values = routeEdgeValues(state, pid);
  let best: { edge: EdgeId; score: number } | null = null;
  for (const eid of state.board.edgeIds) {
    if (!canConnectRoad(state, pid, eid)) continue;
    let score = values.get(eid) ?? 0;
    if (allowExpansion) {
      for (const v of state.board.edges[eid]!.vertices) {
        const sim: GameState = {
          ...state,
          players: state.players.map((p) => (p.id === pid ? { ...p, roads: [...p.roads, eid] } : p)),
        };
        if (canPlaceSettlement(sim, pid, v)) score = Math.max(score, vertexScore(state, v, pid) / 3);
      }
    }
    if (score <= 0) continue;
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && eid < best.edge)) {
      best = { edge: eid, score };
    }
  }
  return best;
}

// Build a road on our delivery routes. Called after the normal road step
// found nothing worth an expansion road. Doesn't take wood / brick a near
// settlement needs.
export function tryTbRouteRoad(state: GameState, pid: PlayerId): Action | null {
  if (!isTradersBarbarians(state) || state.phase !== 'main') return null;
  const player = state.players.find((p) => p.id === pid)!;
  if (!canAfford(player.resources, COSTS.road) || player.roads.length >= 15) return null;
  const needs = reportNeeds(state, pid);
  const short = RESOURCES.reduce((s, r) => s + (needs.byResource[r] ?? 0), 0);
  const settlementSoon =
    needs.goal === 'settlement' &&
    short <= 1 &&
    state.board.vertexIds.some((v) => canPlaceSettlement(state, pid, v));
  if (settlementSoon && (player.resources.wood < 2 || player.resources.brick < 2)) return null;
  const pick = bestRouteRoad(state, pid, false);
  if (!pick || pick.score < 1) return null;
  return { type: 'buildRoad', playerId: pid, edge: pick.edge };
}

// Upgrade the wagon: more MP, drive-offs, more gold per delivery, and the
// fifth column is worth 1 VP. Skipped when it would spend the cards a city
// or settlement one card away needs (unless the hand is large).
export function tryUpgradeWagon(state: GameState, pid: PlayerId): Action | null {
  if (!isTradersBarbarians(state) || state.phase !== 'main') return null;
  const wagon = wagonOf(state, pid);
  if (!wagon || wagon.level >= TB_MAX_WAGON_LEVEL) return null;
  const player = state.players.find((p) => p.id === pid)!;
  const cost = TB_WAGON_UPGRADE_COSTS[wagon.level]!;
  if (!canAfford(player.resources, cost)) return null;
  // Nothing left to deliver: only the VP column is worth it.
  const tb = state.tradersBarbarians;
  const anyWork = wagon.cargo !== null || tb.locations.some((l) => l.stack.length > 0);
  if (!anyWork && wagon.level + 1 < TB_MAX_WAGON_LEVEL) return null;
  if (wagon.level + 1 === TB_MAX_WAGON_LEVEL) return { type: 'upgradeWagon', playerId: pid };
  const hand = totalResources(player.resources);
  if (hand >= 7) return { type: 'upgradeWagon', playerId: pid };
  const needs = reportNeeds(state, pid);
  if (needs.goal === 'city' || needs.goal === 'settlement') {
    const goalCost = needs.goal === 'city' ? COSTS.city : COSTS.settlement;
    const after = { ...player.resources };
    for (const r of RESOURCES) after[r] -= cost[r] ?? 0;
    const shortBefore = shortfall(player.resources, goalCost);
    const shortAfter = shortfall(after, goalCost);
    if (shortBefore <= 1 && shortAfter > shortBefore) return null;
  }
  return { type: 'upgradeWagon', playerId: pid };
}

function shortfall(hand: Record<Resource, number>, cost: Partial<Record<Resource, number>>): number {
  let s = 0;
  for (const r of RESOURCES) s += Math.max(0, (cost[r] ?? 0) - hand[r]);
  return s;
}

// Out of gold with the route ahead on rivals' roads: buy a coin for the
// toll (resources → 1 gold at the bank rate) when that clearly gets the
// wagon further next move.
export function tryTbBuyGold(state: GameState, pid: PlayerId): Action | null {
  if (!isTradersBarbarians(state) || state.phase !== 'main' || !state.coinsInPlay) return null;
  const player = state.players.find((p) => p.id === pid)!;
  if ((player.gold ?? 0) > 0) return null;
  const wagon = wagonOf(state, pid);
  const target = wagonTarget(state, pid);
  if (!wagon || !target) return null;
  const withCoin: GameState = {
    ...state,
    players: state.players.map((p) => (p.id === pid ? { ...p, gold: 1 } : p)),
  };
  const d = distancesTo(withCoin, pid, target);
  const mp = wagonLevelInfo(wagon.level).mp;
  const without = bestStop(state, pid, wagon.vertex, mp, d).dist;
  const withGold = bestStop(withCoin, pid, wagon.vertex, mp, d).dist;
  if (withGold > without - 1.5) return null;
  let give: Resource | null = null;
  let bestScore = -Infinity;
  for (const r of RESOURCES) {
    const rate = getBankTradeRate(state, pid, r);
    if (player.resources[r] < rate) continue;
    const score = player.resources[r] - rate - RESOURCE_WEIGHT[r] * rate * 0.5;
    if (score > bestScore) {
      bestScore = score;
      give = r;
    }
  }
  return give ? { type: 'buyGold', playerId: pid, give } : null;
}

// Scenario dev cards for the main phase: a Knight / Road Building worth
// playing now.
export function chooseTbDevCardPlay(state: GameState, pid: PlayerId): Action | null {
  return chooseTbKnightPlay(state, pid) ?? chooseTbRoadBuilding(state, pid);
}

// Is the scenario's deck still buyable (the base `devCardDeck` is empty)?
export function tbDeckRemaining(state: GameState): number {
  return state.tradersBarbarians?.deck.length ?? 0;
}

// Dispatcher for the scenario's own phases.
export function chooseTradersBarbariansAction(state: GameState, pid: PlayerId): Action | null {
  if (state.phase === 'moveBarbarian') return chooseTbBarbarianMove(state, pid);
  if (state.phase === 'wagonMoves') return chooseWagonMove(state, pid);
  return null;
}

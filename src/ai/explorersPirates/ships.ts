import type { Action, EdgeId, EpCargo, EpShip, GameState, PlayerId, VertexId } from '@/game/types';
import { EP_BOOST_MP, EP_CAPACITY, EP_COSTS, EP_LAIR_CREWS, EP_LAIR_GOLD } from '@/game/modules/explorersPirates/constants';
import {
  canFoundAt,
  cargoUnits,
  epSupply,
  harborsOf,
  hasRoomFor,
  hiddenHexesAtEdge,
  settlersOnBoard,
  shipBaseMp,
  shipMpLeft,
  shipsOf,
} from '@/game/modules/explorersPirates/state';
import { goldOf, playerOf, shortfall, sumShort } from './common';
import {
  EP_WEIGHT,
  GOLD_UNITS,
  VP_UNITS,
  crewDemand,
  epVertexValue,
  exploreValue,
  farmAbilityValue,
  trackStepValue,
} from './value';
import { edgeExplores, edgesAtVertex, edgesNextToHex, shipEdgeSet, shipReach, type ReachNode } from './planner';

// What each ship of the Explorers & Pirates AI is working toward, scored
// by value discounted per step of sailing. A goal is a set of edges where
// it's achieved plus (for most) the free ship action to take there.

export type ShipGoalKind =
  | 'found'
  | 'lair'
  | 'farm'
  | 'loadSpice'
  | 'loadFish'
  | 'deliver'
  | 'pickup'
  | 'crewPickup'
  | 'explore'
  | 'home';

export interface ShipGoal {
  kind: ShipGoalKind;
  value: number;
  edges: EdgeId[];
  // The free action at the goal (none for exploring / heading home).
  act?: (ship: EpShip) => Action;
}

export interface ShipPlan {
  ship: EpShip;
  goal: ShipGoal;
  score: number;
  target: EdgeId;
  steps: number;
  // First edge to sail to (null: the goal is right here).
  first: EdgeId | null;
  // Needs the +2 MP boost (1 wool) to get there this turn.
  boost: boolean;
  // Reaches the goal this turn.
  now: boolean;
}

// Per-step discount on a goal's value, and an extra one per further turn.
const STEP_DISCOUNT = 0.9;
const TURN_DISCOUNT = 0.8;
const BOOST_COST = EP_WEIGHT.sheep;

function count(cargo: readonly EpCargo[], piece: EpCargo): number {
  return cargo.filter((c) => c === piece).length;
}

// Crews already on ships / harbors (not yet on a lair or farm).
export function crewsInTransit(state: GameState, pid: PlayerId): number {
  const ep = state.explorersPirates!;
  let n = 0;
  for (const s of shipsOf(state, pid)) n += count(s.cargo, 'crew');
  for (const h of harborsOf(state, pid)) n += count(ep.harbors[h] ?? [], 'crew');
  return n;
}

// Every intersection a settler could found a settlement on (coastal, open).
export function foundTargets(state: GameState, pid: PlayerId): Array<{ vertex: VertexId; value: number }> {
  if (epSupply(state, pid).settlements <= 0) return [];
  const out: Array<{ vertex: VertexId; value: number }> = [];
  const seen = new Set<VertexId>();
  for (const e of shipEdgeSet(state)) {
    for (const v of state.board.edges[e]!.vertices) {
      if (seen.has(v)) continue;
      seen.add(v);
      if (!canFoundAt(state, pid, v)) continue;
      out.push({ vertex: v, value: epVertexValue(state, v, pid) });
    }
  }
  return out;
}

// The goals open to `ship` now.
export function shipGoals(state: GameState, ship: EpShip): ShipGoal[] {
  const ep = state.explorersPirates!;
  const pid = ship.owner;
  const goals: ShipGoal[] = [];
  const crews = count(ship.cargo, 'crew');
  const units = cargoUnits(ship.cargo);

  const targets = foundTargets(state, pid);
  if (ship.cargo.includes('settler')) {
    for (const t of targets) {
      goals.push({
        kind: 'found',
        value: VP_UNITS + 0.8 * t.value,
        edges: edgesAtVertex(state, t.vertex),
        act: (s) => ({ type: 'epFoundSettlement', playerId: pid, ship: s.id, vertex: t.vertex }),
      });
    }
  }

  if (crews > 0) {
    for (const f of ep.farms) {
      if (f.crews.includes(pid)) continue;
      goals.push({
        kind: 'farm',
        value: farmAbilityValue(state, f.hex) + (f.sacks.includes(pid) ? 0.8 * trackStepValue(state, pid, 'spice') : 0) + 1,
        edges: edgesNextToHex(state, f.hex),
        act: (s) => ({ type: 'epCrewToFarm', playerId: pid, ship: s.id, hex: f.hex }),
      });
    }
    for (const l of ep.lairs) {
      if (l.captured) continue;
      const needed = EP_LAIR_CREWS - l.crews.length;
      const put = Math.min(crews, needed);
      // The third crew captures it: a track space for everyone involved, 2
      // gold each, and the gold field opens (production, building). A crew
      // that doesn't finish it waits for others to — part of that payoff.
      const space = trackStepValue(state, pid, 'pirateLairs', 1);
      const payoff = put >= needed ? 0.9 * space + EP_LAIR_GOLD * GOLD_UNITS + 2 : 0.4 * space;
      const value = 2.5 * put + payoff;
      goals.push({
        kind: 'lair',
        value,
        edges: edgesNextToHex(state, l.hex),
        act: (s) => ({ type: 'epCrewToLair', playerId: pid, ship: s.id, hex: l.hex }),
      });
    }
  }

  if (units < EP_CAPACITY) {
    for (const f of ep.farms) {
      if (!f.crews.includes(pid) || !f.sacks.includes(pid)) continue;
      goals.push({
        kind: 'loadSpice',
        value: 0.75 * trackStepValue(state, pid, 'spice'),
        edges: edgesNextToHex(state, f.hex),
        act: (s) => ({ type: 'epLoadSpice', playerId: pid, ship: s.id, hex: f.hex }),
      });
    }
  }

  if (units === 0) {
    for (const sh of ep.shoals) {
      if (!sh.haul) continue;
      goals.push({
        kind: 'loadFish',
        value: 0.75 * trackStepValue(state, pid, 'fish'),
        edges: edgesNextToHex(state, sh.hex),
        act: (s) => ({ type: 'epLoadFish', playerId: pid, ship: s.id, hex: sh.hex }),
      });
    }
  }

  const fish = count(ship.cargo, 'fish');
  const spice = count(ship.cargo, 'spice');
  if (fish + spice > 0) {
    const value =
      (fish > 0 ? trackStepValue(state, pid, 'fish', fish) : 0) +
      (spice > 0 ? trackStepValue(state, pid, 'spice', spice) : 0);
    // Fish fill the whole hold: delivering also frees the ship.
    goals.push({
      kind: 'deliver',
      value: Math.max(1, value) + (fish > 0 ? 2 : 0.5),
      edges: ep.councilAnchors.flatMap((a) => edgesAtVertex(state, a)),
      act: (s) => ({ type: 'epDeliver', playerId: pid, ship: s.id }),
    });
  }

  // Pieces waiting on our harbor settlements.
  const wantCrews = Math.max(0, crewDemand(state, pid) - crewsInTransit(state, pid) + countOnHarbors(state, pid, 'crew'));
  for (const h of harborsOf(state, pid)) {
    const stored = ep.harbors[h] ?? [];
    const load = pickupLoad(stored, ship.cargo, wantCrews, targets.length > 0);
    if (load.length === 0) continue;
    goals.push({
      kind: 'pickup',
      value: load.reduce((n, c) => n + (c === 'settler' ? 6 : 2.5), 0),
      edges: edgesAtVertex(state, h),
      act: (s) => ({ type: 'epTransfer', playerId: pid, ship: s.id, harbor: h, load, unload: [] }),
    });
  }

  // Crews left on a captured gold field can be used again.
  if (units < EP_CAPACITY && wantCrews > crews) {
    for (const l of ep.lairs) {
      if (!l.captured || ep.pendingLairs.includes(l.hex) || !l.crews.includes(pid)) continue;
      goals.push({
        kind: 'crewPickup',
        value: epSupply(state, pid).crews === 0 ? 3 : 1.5,
        edges: edgesNextToHex(state, l.hex),
        act: (s) => ({ type: 'epCrewFromLair', playerId: pid, ship: s.id, hex: l.hex }),
      });
    }
  }

  // Exploring: every edge whose ends touch face-down hexes.
  for (const e of shipEdgeSet(state)) {
    if (!edgeExplores(state, e)) continue;
    const hexes = hiddenHexesAtEdge(state, e);
    goals.push({ kind: 'explore', value: hexes.reduce((n, h) => n + exploreValue(state, h), 0), edges: [e] });
  }

  // An empty ship by a harbor settlement takes new settlers / crews built
  // straight onto it — worth waiting there only when we're about to build
  // one.
  if (units === 0) {
    const supply = epSupply(state, pid);
    const hand = playerOf(state, pid).resources;
    let value = 0.3;
    if (wantCrews > 0 && supply.crews > 0 && sumShort(shortfall(hand, EP_COSTS.crew)) === 0) value += 1.2;
    if (
      supply.settlers > 0 &&
      settlersOnBoard(state, pid) === 0 &&
      supply.settlements > 0 &&
      sumShort(shortfall(hand, EP_COSTS.settler)) <= 1 &&
      targets.length > 0
    ) {
      value += 2;
    }
    goals.push({ kind: 'home', value, edges: harborsOf(state, pid).flatMap((h) => edgesAtVertex(state, h)) });
  }
  return goals;
}

function countOnHarbors(state: GameState, pid: PlayerId, piece: EpCargo): number {
  const ep = state.explorersPirates!;
  return harborsOf(state, pid).reduce((n, h) => n + count(ep.harbors[h] ?? [], piece), 0);
}

// What to load from a harbor's store onto a ship: the settler if the ship is
// empty and there's somewhere to found, else crews we still have a use for.
function pickupLoad(stored: readonly EpCargo[], cargo: readonly EpCargo[], wantCrews: number, canFound: boolean): EpCargo[] {
  if (stored.includes('settler') && cargo.length === 0 && canFound) return ['settler'];
  const out: EpCargo[] = [];
  let crews = Math.min(count(stored, 'crew'), wantCrews);
  while (crews > 0 && hasRoomFor(cargo, [...out, 'crew'])) {
    out.push('crew');
    crews--;
  }
  return out;
}

// ----- Planning -----

function mpOf(state: GameState, ship: EpShip): number {
  if (state.phase === 'epMovement') return shipMpLeft(state, ship.id);
  return shipBaseMp(state, ship.owner);
}

function canBoost(state: GameState, ship: EpShip): boolean {
  const m = state.explorersPirates?.movement;
  if (!m || state.phase !== 'epMovement') return false;
  if (m.boosted.includes(ship.id)) return false;
  if (m.moved.includes(ship.id) && m.moving !== ship.id) return false;
  return playerOf(state, ship.owner).resources.sheep >= 1;
}

function bestNode(reach: Map<EdgeId, ReachNode>, edges: readonly EdgeId[]): ReachNode | null {
  let best: ReachNode | null = null;
  for (const e of edges) {
    const n = reach.get(e);
    if (!n) continue;
    if (n.steps > 0 && !n.canStop) continue;
    if (!best || n.cost < best.cost) best = n;
  }
  return best;
}

// The best plan for `ship`: this turn, with a boost, or over several turns.
// `goals` defaults to `shipGoals(state, ship)`.
export function planShip(state: GameState, ship: EpShip, goals = shipGoals(state, ship)): ShipPlan | null {
  const mp = mpOf(state, ship);
  const gold = goldOf(state, ship.owner);
  const paid = state.explorersPirates?.movement?.paidTribute.includes(ship.id) ?? false;
  const now = shipReach(state, ship, { mp, gold, tributePaid: paid });
  const boostable = canBoost(state, ship);
  const boosted = boostable ? shipReach(state, ship, { mp: mp + EP_BOOST_MP, gold, tributePaid: paid }) : null;
  // Over several turns gold comes in (production, exploring), so a tribute
  // blocking the way today doesn't close the route for good.
  const far = shipReach(state, ship, { mp: Infinity, gold: Math.max(gold, 1), tributePaid: paid });
  const perTurn = Math.max(1, shipBaseMp(state, ship.owner));

  let best: ShipPlan | null = null;
  const consider = (plan: ShipPlan) => {
    if (!best || plan.score > best.score) best = plan;
  };
  for (const goal of goals) {
    if (goal.edges.length === 0 || goal.value <= 0) continue;
    const n = bestNode(now, goal.edges);
    if (n) {
      consider({
        ship,
        goal,
        score: goal.value * STEP_DISCOUNT ** n.cost,
        target: n.edge,
        steps: n.steps,
        first: n.first,
        boost: false,
        now: true,
      });
      continue;
    }
    const b = boosted ? bestNode(boosted, goal.edges) : null;
    if (b) {
      consider({
        ship,
        goal,
        score: goal.value * STEP_DISCOUNT ** b.cost - BOOST_COST,
        target: b.edge,
        steps: b.steps,
        first: b.first,
        boost: true,
        now: true,
      });
    }
    const f = bestNode(far, goal.edges);
    if (f && f.first) {
      const turns = Math.ceil(Math.max(0, f.steps - mp) / perTurn) + 1;
      consider({
        ship,
        goal,
        score: goal.value * STEP_DISCOUNT ** f.cost * TURN_DISCOUNT ** (turns - 1),
        target: f.edge,
        steps: f.steps,
        first: f.first,
        boost: false,
        now: false,
      });
    }
  }
  return best;
}

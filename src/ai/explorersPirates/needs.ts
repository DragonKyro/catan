import type { GameState, PlayerId, Resource, ResourceBank, VertexId } from '@/game/types';
import { COSTS } from '@/game/types';
import { canPlaceSettlement } from '@/game/placement';
import { EP_COSTS } from '@/game/modules/explorersPirates/constants';
import {
  buildableShipEdges,
  canFoundAt,
  epSupply,
  harborUpgradeSpots,
  harborsOf,
  pieceSpots,
  settlersOnBoard,
  shipsOf,
} from '@/game/modules/explorersPirates/state';
import { playerOf, shortfall, sumShort } from './common';
import { crewDemand } from './value';
import { foundTargets } from './ships';

// The Explorers & Pirates AI's build goals, in priority order, and the
// "what am I short of" report the shared trade / discard / bank-trade code
// reads (src/ai/value.ts#reportNeeds routes here in this expansion).

export type EpGoal = 'harbor' | 'settlement' | 'ship' | 'settler' | 'crew' | 'road';

export interface EpGoalOption {
  goal: EpGoal;
  cost: Partial<ResourceBank>;
}

export const EP_GOAL_COST: Record<EpGoal, Partial<ResourceBank>> = {
  harbor: EP_COSTS.harbor,
  settlement: COSTS.settlement,
  ship: EP_COSTS.ship,
  settler: EP_COSTS.settler,
  crew: EP_COSTS.crew,
  road: COSTS.road,
};

// Intersections on our road network where a settlement could go now.
export function roadSettlementSpots(state: GameState, pid: PlayerId): VertexId[] {
  if (epSupply(state, pid).settlements <= 0) return [];
  const p = playerOf(state, pid);
  const seen = new Set<VertexId>();
  const out: VertexId[] = [];
  for (const e of p.roads) {
    for (const v of state.board.edges[e]!.vertices) {
      if (seen.has(v)) continue;
      seen.add(v);
      if (canPlaceSettlement(state, pid, v)) out.push(v);
    }
  }
  return out;
}

// One road out from our network that reaches an open intersection (or one
// more road beyond it): is there land worth roading toward?
export function hasRoadTarget(state: GameState, pid: PlayerId): boolean {
  const p = playerOf(state, pid);
  if (p.roads.length >= 15 || epSupply(state, pid).settlements <= 0) return false;
  const mine = new Set<VertexId>();
  for (const e of p.roads) for (const v of state.board.edges[e]!.vertices) mine.add(v);
  for (const v of p.settlements) mine.add(v);
  for (const v of mine) {
    for (const n of state.board.vertices[v]!.neighborVertices) {
      if (mine.has(n)) continue;
      if (canFoundAt(state, pid, n)) return true;
      for (const nn of state.board.vertices[n]!.neighborVertices) {
        if (nn !== v && !mine.has(nn) && canFoundAt(state, pid, nn)) return true;
      }
    }
  }
  return false;
}

// Goals that make sense right now, in priority order.
export function epGoalOptions(state: GameState, pid: PlayerId): EpGoalOption[] {
  const supply = epSupply(state, pid);
  const out: EpGoalOption[] = [];
  const add = (goal: EpGoal) => out.push({ goal, cost: EP_GOAL_COST[goal] });
  if (harborUpgradeSpots(state, pid).length > 0) add('harbor');
  if (roadSettlementSpots(state, pid).length > 0) add('settlement');
  const ships = shipsOf(state, pid).length;
  const canShip = supply.ships > 0 && buildableShipEdges(state, pid).length > 0;
  if (ships === 0 && canShip) add('ship');
  if (
    supply.settlers > 0 &&
    settlersOnBoard(state, pid) === 0 &&
    supply.settlements > 0 &&
    harborsOf(state, pid).length > 0 &&
    pieceSpots(state, pid, 'settler', true).length > 0 &&
    foundTargets(state, pid).some((t) => t.value >= 2)
  ) {
    add('settler');
  }
  if (supply.crews > 0 && crewDemand(state, pid) > 0 && pieceSpots(state, pid, 'crew', true).length > 0) add('crew');
  if (ships > 0 && ships < 2 && canShip) add('ship');
  if (hasRoadTarget(state, pid)) add('road');
  return out;
}

export interface EpNeeds {
  goal: EpGoal | 'none';
  byResource: Record<Resource, number>;
  cost: Partial<ResourceBank> | null;
}

// The goal we're working toward: the first (by priority) within 2 cards,
// else the closest one.
export function epNeeds(state: GameState, pid: PlayerId): EpNeeds {
  const hand = playerOf(state, pid).resources;
  const options = epGoalOptions(state, pid);
  let pick: { o: EpGoalOption; short: Record<Resource, number> } | null = null;
  let closest: { o: EpGoalOption; short: Record<Resource, number>; n: number } | null = null;
  for (const o of options) {
    const short = shortfall(hand, o.cost);
    const n = sumShort(short);
    if (n <= 2) {
      pick = { o, short };
      break;
    }
    if (!closest || n < closest.n) closest = { o, short, n };
  }
  const chosen = pick ?? closest;
  if (!chosen) return { goal: 'none', byResource: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, cost: null };
  return { goal: chosen.o.goal, byResource: chosen.short, cost: chosen.o.cost };
}

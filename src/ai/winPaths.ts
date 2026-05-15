import type { GameState, PlayerId, Resource } from '@/game/types';
import { pipsByResource } from './value';

// Catalog of viable "shapes" for reaching the VP target. Each plan is a
// concrete combination of buildings + bonuses that the AI can aim for;
// scoring lets us pick the plan that's cheapest given our current state
// and production. This replaces the implicit "always rank city > settlement
// > devCard > road" priority — late-game especially, the right next-step
// depends on what we're already close to.

export type WinPlanName =
  | 'cityArmy'
  | 'cityRoad'
  | 'cityBothBonuses'
  | 'sprawlRoad'
  | 'sprawlBoth'
  | 'maxBuild';

export interface WinPlan {
  name: WinPlanName;
  // visible (un-upgraded) settlements on the board
  visibleSettlements: number;
  cities: number;
  largestArmy: boolean;
  longestRoad: boolean;
  // Hidden VP from dev cards.
  vpCards: number;
}

// All plans target >=10 VP, which is enough for the default game. Lower or
// higher VP-to-win is honored by the gap math in `scorePlan`.
export const WIN_PLANS: WinPlan[] = [
  // City-rush variants — high ore/wheat economies.
  { name: 'cityArmy', visibleSettlements: 2, cities: 3, largestArmy: true, longestRoad: false, vpCards: 0 },
  { name: 'cityRoad', visibleSettlements: 2, cities: 3, largestArmy: false, longestRoad: true, vpCards: 0 },
  { name: 'cityBothBonuses', visibleSettlements: 1, cities: 3, largestArmy: true, longestRoad: true, vpCards: 0 },
  // Sprawl variants — wood/brick economies, more settlements than cities.
  { name: 'sprawlRoad', visibleSettlements: 4, cities: 2, largestArmy: false, longestRoad: true, vpCards: 0 },
  { name: 'sprawlBoth', visibleSettlements: 3, cities: 2, largestArmy: true, longestRoad: true, vpCards: 0 },
  // Pure building (no bonuses): only viable when bonuses are blocked or
  // contested — token limit caps us at 1 settlement + 4 cities = 9 VP, so
  // we still need at least 1 dev-card VP (or a partial bonus) to close.
  { name: 'maxBuild', visibleSettlements: 1, cities: 4, largestArmy: false, longestRoad: false, vpCards: 1 },
];

export function planVP(plan: WinPlan): number {
  return (
    plan.visibleSettlements +
    plan.cities * 2 +
    (plan.largestArmy ? 2 : 0) +
    (plan.longestRoad ? 2 : 0) +
    plan.vpCards
  );
}

export interface PlanGap {
  // Settlement-upgrades-to-cities and brand-new settlements both count
  // toward different things; we represent both deltas independently.
  newSettlementsNeeded: number;
  citiesNeeded: number;
  // True if the plan calls for bonus and we don't currently hold it.
  pursueLargestArmy: boolean;
  pursueLongestRoad: boolean;
  // Estimated raw resource "cost" of the remaining work — used to rank
  // plans (lower = easier).
  estResourceCost: number;
  // Production-fit penalty: bigger when the resources needed don't
  // match our current per-pip production.
  productionMismatch: number;
}

const COST_PER_SETTLEMENT = 4; // 1W+1B+1S+1Wh
const COST_PER_CITY = 5; // 2Wh+3O
const COST_PER_ROAD = 2; // 1W+1B
const COST_PER_DEV_CARD = 3; // 1S+1Wh+1O
const EST_ROADS_FOR_LR = 3; // ~3 more roads on top of starter
const EST_KNIGHTS_FOR_LA = 3;

export function gapForPlan(state: GameState, playerId: PlayerId, plan: WinPlan): PlanGap {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) {
    return {
      newSettlementsNeeded: plan.visibleSettlements,
      citiesNeeded: plan.cities,
      pursueLargestArmy: plan.largestArmy,
      pursueLongestRoad: plan.longestRoad,
      estResourceCost: Infinity,
      productionMismatch: 0,
    };
  }
  // Visible settlements = those on the board now.
  const haveSetts = me.settlements.length;
  const haveCities = me.cities.length;
  // The plan's `visibleSettlements` is the FINAL count we'd want. We may
  // need to BUILD more (if below target) — but if we're above, that's fine
  // (extra settlements are still 1 VP each). Cities replace settlements,
  // so building a city consumes one settlement slot.
  const newSettlementsNeeded = Math.max(0, plan.visibleSettlements + plan.cities - haveSetts - haveCities);
  const citiesNeeded = Math.max(0, plan.cities - haveCities);
  const pursueLA = plan.largestArmy && state.largestArmy?.holder !== playerId;
  const pursueLR = plan.longestRoad && state.longestRoad?.holder !== playerId;

  let estResourceCost = 0;
  estResourceCost += newSettlementsNeeded * COST_PER_SETTLEMENT;
  estResourceCost += citiesNeeded * COST_PER_CITY;
  if (pursueLA) estResourceCost += EST_KNIGHTS_FOR_LA * COST_PER_DEV_CARD;
  if (pursueLR) estResourceCost += EST_ROADS_FOR_LR * COST_PER_ROAD;
  if (plan.vpCards > 0) estResourceCost += plan.vpCards * COST_PER_DEV_CARD * 5; // hidden VP cards are rare (5 in deck of 25)

  // Production mismatch: do we actually generate the resources this plan
  // demands? Rough heuristic — for each resource, the per-roll pip total
  // (over 36 outcomes) is how many cards per "Catan turn" we generate.
  const pips = pipsByResource(state, playerId);
  let productionMismatch = 0;
  const neededByR: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  neededByR.wood += newSettlementsNeeded + (pursueLR ? EST_ROADS_FOR_LR : 0);
  neededByR.brick += newSettlementsNeeded + (pursueLR ? EST_ROADS_FOR_LR : 0);
  neededByR.sheep += newSettlementsNeeded + (pursueLA ? EST_KNIGHTS_FOR_LA : 0);
  neededByR.wheat += newSettlementsNeeded + citiesNeeded * 2 + (pursueLA ? EST_KNIGHTS_FOR_LA : 0);
  neededByR.ore += citiesNeeded * 3 + (pursueLA ? EST_KNIGHTS_FOR_LA : 0);
  for (const r of (Object.keys(neededByR) as Resource[])) {
    const need = neededByR[r];
    if (need <= 0) continue;
    // If we produce 0 pips of this resource we'd be entirely dependent on
    // trade — costly. Penalty proportional to gap.
    if (pips[r] === 0) productionMismatch += need * 1.5;
    else if (pips[r] < 2) productionMismatch += need * 0.5;
  }

  return {
    newSettlementsNeeded,
    citiesNeeded,
    pursueLargestArmy: pursueLA,
    pursueLongestRoad: pursueLR,
    estResourceCost,
    productionMismatch,
  };
}

export interface ChosenPlan {
  plan: WinPlan;
  gap: PlanGap;
  // Suggested next building action given the plan and current state.
  nextStep: 'city' | 'settlement' | 'road' | 'devCard' | 'none';
}

// Pick the easiest plan to complete given current state + production.
// Used by chooseMainPhaseAction to bias build priority toward whichever
// path is closest to closing the game out.
export function chooseWinPlan(state: GameState, playerId: PlayerId): ChosenPlan {
  let bestPlan = WIN_PLANS[0]!;
  let bestGap = gapForPlan(state, playerId, bestPlan);
  let bestScore = bestGap.estResourceCost + bestGap.productionMismatch;
  for (const p of WIN_PLANS.slice(1)) {
    const g = gapForPlan(state, playerId, p);
    const s = g.estResourceCost + g.productionMismatch;
    if (s < bestScore) {
      bestScore = s;
      bestPlan = p;
      bestGap = g;
    }
  }

  // Decide the immediate next step. Order reflects how directly each
  // action converts to VP toward the chosen plan.
  // - If cities are short and we can upgrade a settlement: prefer city.
  // - If settlements are short and we have a buildable spot: settlement.
  // - If LR pursuit applies: road.
  // - If LA pursuit applies: devCard.
  // - Else: 'none' (plan complete or no immediate move).
  const me = state.players.find((p) => p.id === playerId);
  let nextStep: ChosenPlan['nextStep'] = 'none';
  if (me) {
    if (bestGap.citiesNeeded > 0 && me.settlements.length > 0 && me.cities.length < 4) {
      nextStep = 'city';
    } else if (bestGap.newSettlementsNeeded > 0 && me.settlements.length < 5) {
      // Settlement OR the road that unlocks one — chooseMainPhaseAction
      // already handles the unlock-road branch; we just emit 'settlement'
      // here and let the main loop pick the cheapest route.
      nextStep = 'settlement';
    } else if (bestGap.pursueLongestRoad && me.roads.length < 15) {
      nextStep = 'road';
    } else if (bestGap.pursueLargestArmy && state.devCardDeck.length > 0) {
      nextStep = 'devCard';
    }
  }

  return { plan: bestPlan, gap: bestGap, nextStep };
}

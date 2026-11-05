import type { Action, EdgeId, EpShip, GameState, PlayerId } from '@/game/types';
import {
  battleReadyShips,
  legalShipSteps,
  moveCanEnd,
  shipById,
  shipsOf,
  shipsOnEdge,
} from '@/game/modules/explorersPirates/state';
import { EP_SHIPS_PER_EDGE } from '@/game/modules/explorersPirates/constants';
import { firstLegal } from './common';
import { planShip, type ShipPlan } from './ships';

// Movement phase for the Explorers & Pirates AI. One action per call,
// re-planned from the state each time:
//   1. the free fish roll;
//   2. chase an opponent's pirate with every battle-ready ship (free, and a
//      success places our pirate) before any ship starts moving;
//   3. any ship whose best goal is right where it is takes that free action
//      (deliver, found, crews to a lair / farm, load spice / fish, load
//      pieces at a harbor);
//   4. the ship under way keeps sailing toward its goal (boosting with 1
//      wool when that reaches it this turn) until it gets there or runs out
//      of MP — a move can't be resumed once another ship starts;
//   5. otherwise the unmoved ship with the best plan sets off;
//   6. nothing left: null (the driver ends the turn).

export function chooseMovementAction(state: GameState, pid: PlayerId): Action | null {
  const ep = state.explorersPirates;
  const m = ep?.movement;
  if (!ep || !m || state.phase !== 'epMovement') return null;

  if (!m.fishRolled) {
    const roll = firstLegal(state, [{ type: 'epFishRoll', playerId: pid }]);
    if (roll) return roll;
  }

  // Chase an opponent's pirate: free, and the ship can still move after.
  if (m.moving === null) {
    for (const s of battleReadyShips(state, pid)) {
      const chase = firstLegal(state, [{ type: 'epChasePirate', playerId: pid, ship: s.id }]);
      if (chase) return chase;
    }
  }

  const ships = shipsOf(state, pid);
  const moving = m.moving ? shipById(state, m.moving) ?? null : null;
  const order = moving ? [moving, ...ships.filter((s) => s.id !== moving.id)] : ships;
  const plans = new Map<string, ShipPlan | null>();
  for (const s of order) plans.set(s.id, planShip(state, s));

  // Free actions right here.
  for (const s of order) {
    const plan = plans.get(s.id);
    if (!plan || plan.steps !== 0 || !plan.goal.act) continue;
    const act = firstLegal(state, [plan.goal.act(s)]);
    if (act) return act;
  }

  // The ship under way.
  if (moving) {
    const plan = plans.get(moving.id) ?? null;
    const step = stepFor(state, moving, plan);
    if (step) return step;
    if (!moveCanEnd(state)) {
      const out = escapeStep(state, moving);
      if (out) return out;
    }
  }

  // Set off with the unmoved ship whose plan scores best.
  const candidates = ships
    .filter((s) => !m.moved.includes(s.id))
    .map((s) => plans.get(s.id))
    .filter((p): p is ShipPlan => !!p && p.steps > 0 && p.first !== null)
    .sort((a, b) => b.score - a.score);
  for (const plan of candidates) {
    const step = stepFor(state, plan.ship, plan);
    if (step) return step;
  }
  return null;
}

// The next action toward the plan: the boost first if the plan needs it,
// else one step along the path (checked against the engine's legal steps).
function stepFor(state: GameState, ship: EpShip, plan: ShipPlan | null): Action | null {
  if (!plan || plan.steps === 0 || !plan.first) return null;
  const pid = ship.owner;
  if (plan.boost) {
    const boost = firstLegal(state, [{ type: 'epBoostShip', playerId: pid, ship: ship.id }]);
    if (boost) return boost;
  }
  if (!legalShipSteps(state, ship.id).includes(plan.first)) return null;
  return firstLegal(state, [{ type: 'epMoveShip', playerId: pid, ship: ship.id, to: plan.first }]);
}

// The moving ship sits on an edge with 2 other ships and may not stop: take
// any legal step to an edge where it may.
function escapeStep(state: GameState, ship: EpShip): Action | null {
  const steps = legalShipSteps(state, ship.id);
  const free = (e: EdgeId) => shipsOnEdge(state, e).filter((s) => s.id !== ship.id).length < EP_SHIPS_PER_EDGE;
  const ordered = [...steps.filter(free), ...steps.filter((e) => !free(e))];
  return firstLegal(
    state,
    ordered.map((to) => ({ type: 'epMoveShip' as const, playerId: ship.owner, ship: ship.id, to })),
  );
}

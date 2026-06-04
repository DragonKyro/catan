import type { GameState, DisplaceKnightAction } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { knightAt } from '../knights/state';
import {
  displacedHasDestination,
  enemyKnightDisplacementTargets,
} from '../knights/graph';

// Displace an opposing knight: move a stronger active knight onto a weaker
// enemy knight along your continuous network. The attacker becomes inactive
// at the target vertex; the displaced victim's knight is removed and the
// owner must move it to an adjacent empty vertex along their own network.
//
// If the victim has no legal destination, the displaced knight goes back to
// the victim's supply (rulebook p.10).
export function handleDisplaceKnight(
  state: GameState,
  action: DisplaceKnightAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot displace knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const attacker = knightAt(state, action.from);
  if (!attacker) throw new Error('No knight at the source vertex');
  if (attacker.playerId !== action.playerId) throw new Error('Not your knight');
  if (!attacker.active) throw new Error('Knight is not active');
  if (state.activatedKnightsThisTurn?.includes(action.from)) {
    throw new Error("Knight was activated this turn — it can't act yet");
  }
  const victim = knightAt(state, action.to);
  if (!victim) throw new Error('No knight at the target vertex');
  if (victim.playerId === action.playerId) {
    throw new Error('Cannot displace your own knight');
  }
  if (victim.strength >= attacker.strength) {
    throw new Error('Attacker must be strictly stronger');
  }

  const targets = enemyKnightDisplacementTargets(
    state,
    action.playerId,
    action.from,
    attacker.strength,
  );
  if (!targets.has(action.to)) {
    throw new Error('Target knight is not reachable for displacement');
  }

  // The attacker takes the target vertex (inactive). Source is cleared.
  const next: GameState = {
    ...state,
    knights: {
      ...(state.knights ?? {}),
      [action.to]: { ...attacker, active: false },
    },
  };
  delete next.knights![action.from];

  if (!displacedHasDestination(next, victim.playerId, action.to)) {
    // No legal destination: knight returns to victim's supply.
    return {
      ...next,
      knightSupply: {
        ...(next.knightSupply ?? {}),
        [victim.playerId]: {
          ...(next.knightSupply?.[victim.playerId] ?? { 1: 0, 2: 0, 3: 0 }),
          [victim.strength]:
            (next.knightSupply?.[victim.playerId]?.[victim.strength] ?? 0) + 1,
        },
      },
    };
  }

  // Otherwise transition into the displaced-knight-move sub-phase. The
  // victim must dispatch a `displacedKnightMove` action next.
  return {
    ...next,
    phase: 'displacedKnightMove',
    pendingKnightMove: {
      playerId: victim.playerId,
      sourceVertex: action.to,
      knightStrength: victim.strength,
      knightActive: victim.active,
      returnTo: 'main',
    },
  };
}

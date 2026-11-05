import type { GameState, DisplaceKnightAction, KnightRecord, VertexId } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { knightAt } from '../knights/state';
import { displacedHasDestination } from '../knights/graph';
import { knightCanAct, legalDisplaceTargets } from '../knights/legal';
import { adjustSupply } from './recruitKnight';

// Displace a knight (p.10): an acting knight moves along your routes onto a
// strictly weaker opposing knight and is laid down there. The displaced
// knight's owner must then move it as in "Move a Knight" (its status
// unchanged); if it can't go anywhere it returns to their supply.
export function handleDisplaceKnight(state: GameState, action: DisplaceKnightAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot displace knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const attacker = knightAt(state, action.from);
  if (!attacker) throw new Error('No knight at the source vertex');
  if (attacker.playerId !== action.playerId) throw new Error('Not your knight');
  if (!attacker.active) throw new Error('Knight is not active');
  if (!knightCanAct(state, action.from)) {
    throw new Error("Knight was activated this turn — it can't act yet");
  }
  const victim = knightAt(state, action.to);
  if (!victim) throw new Error('No knight at the target vertex');
  if (victim.playerId === action.playerId) throw new Error('Cannot displace your own knight');
  if (victim.strength >= attacker.strength) throw new Error('Attacker must be strictly stronger');
  if (!legalDisplaceTargets(state, action.from).includes(action.to)) {
    throw new Error('Target knight is not reachable for displacement');
  }

  const knights = { ...(state.knights ?? {}) };
  delete knights[action.from];
  knights[action.to] = { ...attacker, active: false };
  return startDisplacedMove({ ...state, knights }, victim, action.to);
}

// The knight `victim` was knocked off `from` (which may now hold the
// attacker, or be empty after Intrigue). Its owner moves it, or it goes
// back to their supply when it has nowhere to go.
export function startDisplacedMove(
  state: GameState,
  victim: KnightRecord,
  from: VertexId,
): GameState {
  if (!displacedHasDestination(state, victim.playerId, from)) {
    return adjustSupply(state, victim.playerId, victim.strength, +1);
  }
  return {
    ...state,
    phase: 'displacedKnightMove',
    pendingKnightMove: {
      playerId: victim.playerId,
      sourceVertex: from,
      knightStrength: victim.strength,
      knightActive: victim.active,
      returnTo: 'main',
    },
  };
}

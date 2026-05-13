import type { Action, GameState, PlayerId } from '@/game/types';
import { chooseSetupSettlement, chooseSetupRoad } from './setup';
import { chooseRobberMove } from './robber';
import { chooseDiscard } from './discard';
import { chooseMainPhaseAction } from './main';
import { chooseDevCardPlay } from './devcard';

// Entry point: given a state where the acting player is AI, return one
// action to take next. Returns null only when "end turn" is correct.
// The caller (React driver) dispatches the action and re-invokes after
// the new state arrives.
export function chooseAction(state: GameState, playerId: PlayerId): Action | null {
  // Discard sub-phase
  if (state.phase === 'discard') {
    return {
      type: 'discard',
      playerId,
      resources: chooseDiscard(state, playerId),
    };
  }

  // Move robber sub-phase
  if (state.phase === 'moveRobber') {
    const { hex, stealFrom } = chooseRobberMove(state, playerId);
    return { type: 'moveRobber', playerId, hex, stealFrom };
  }

  // Setup
  if (state.phase === 'setupRound1' || state.phase === 'setupRound2') {
    if (state.setupState?.step === 'settlement') {
      const vid = chooseSetupSettlement(state, playerId);
      return { type: 'placeInitialSettlement', playerId, vertex: vid };
    }
    const placed = state.setupState!.lastPlacedSettlement!;
    const eid = chooseSetupRoad(state, playerId, placed);
    return { type: 'placeInitialRoad', playerId, edge: eid };
  }

  if (state.phase === 'rollOrPlayKnight') {
    // Optionally play knight first (e.g., to clear robber off our hex)
    const knight = chooseDevCardPlay(state, playerId);
    if (knight && knight.type === 'playKnight') return knight;
    // Roll
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    return { type: 'rollDice', playerId, dice: [d1, d2] };
  }

  if (state.phase === 'main') {
    return chooseMainPhaseAction(state, playerId);
  }

  return null;
}

export { shouldAcceptTrade } from './trade';

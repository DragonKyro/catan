import type { Action, GameState, PlayerId } from '@/game/types';
import { isPairedPlayer2 } from '@/game/helpers';
import { chooseSetupSettlement, chooseSetupRoad } from './setup';
import { chooseRobberMove } from './robber';
import { chooseDiscard } from './discard';
import { chooseMainPhaseAction } from './main';
import { chooseDevCardPlay } from './devcard';
import { chooseGoldResourcePicks } from './seafarers/gold';
import { choosePirateMove, preferPirate } from './seafarers/pirate';
import {
  trySubmitWagonVote,
  tryPlaceWagon,
} from './traders/merchantTrains';

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

  // Seafarers: robber-vs-pirate choice on 7s / knights.
  if (state.phase === 'chooseRobberOrPirate') {
    if (preferPirate(state, playerId)) {
      return { type: 'choosePirate', playerId };
    }
    return { type: 'chooseRobber', playerId };
  }

  // Seafarers: pirate move sub-phase.
  if (state.phase === 'movePirate') {
    const choice = choosePirateMove(state, playerId);
    if (!choice) {
      // No legal sea hex (extreme corner case). Fall back to first sea hex
      // that's not the pirate's current location.
      const fallback = state.board.hexIds.find(
        (h) =>
          state.board.hexes[h]!.terrain === 'sea' && h !== state.board.pirateHex,
      );
      if (!fallback) return null;
      return { type: 'movePirate', playerId, hex: fallback, stealFrom: null };
    }
    return { type: 'movePirate', playerId, hex: choice.hex, stealFrom: choice.stealFrom };
  }

  // Seafarers: gold-hex resource choice. Only fires when this AI has a
  // pending pick; the phase loops through all owed players.
  if (state.phase === 'chooseGoldResource') {
    const pending = state.goldChoiceState?.pending[playerId];
    if (pending && pending > 0) {
      return {
        type: 'chooseGoldResource',
        playerId,
        resources: chooseGoldResourcePicks(state, playerId, pending),
      };
    }
    return null;
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
    // 5+ player paired-player rule: Player 2 may only trade with the supply
    // (no player trades), but is otherwise allowed to build, buy + play dev
    // cards, and bank trade.
    if (isPairedPlayer2(state)) {
      return chooseMainPhaseAction(state, playerId, { allowPlayerTrade: false });
    }
    return chooseMainPhaseAction(state, playerId);
  }

  // T&B Merchant Trains end-of-turn phases.
  if (state.phase === 'wagonVoting') {
    return trySubmitWagonVote(state, playerId);
  }
  if (state.phase === 'placeWagon') {
    return tryPlaceWagon(state, playerId);
  }

  return null;
}

export { shouldAcceptTrade } from './trade';

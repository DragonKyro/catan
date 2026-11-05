import type { Action, GameState, PlayerId } from '@/game/types';
import { isPairedPlayer2 } from '@/game/helpers';
import { chooseSetupSettlement, chooseSetupRoad } from './setup';
import { isSetupPhase } from '@/game/actions/setup';
import { requiredGoldPicks } from '@/game/modules/seafarers/actions/chooseGoldResource';
import {
  chooseTribePortEdge,
  chooseStealResourceTarget,
} from './seafarers/scenarios';
import { chooseRobberMove } from './robber';
import { chooseDiscard } from './discard';
import { chooseMainPhaseAction } from './main';
import { chooseDevCardPlay } from './devcard';
import { chooseGoldResourcePicks } from './seafarers/gold';
import { choosePirateMove, preferPirate } from './seafarers/pirate';
import { chooseMerchantTrainsAction } from './traders/merchantTrains';
import { chooseEventAnswer } from './traders/eventCards';
import {
  chooseBarbarianCardAction,
  chooseBarbarianKnightMove,
} from './traders/barbarianAttack';
import { chooseFishSwap } from './traders/fish';
import { chooseCitiesAndKnightsAction, isCitiesAndKnights } from './citiesAndKnights';
import { chooseTradersBarbariansAction } from './traders/tradersBarbarians';

function randomDice(): [number, number] {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

// Entry point: given a state where the acting player is AI, return one
// action to take next. Returns null only when "end turn" is correct.
// The caller (React driver) dispatches the action and re-invokes after
// the new state arrives.
export function chooseAction(state: GameState, playerId: PlayerId): Action | null {
  // Cities & Knights plays its own rules (knights, improvements, progress
  // cards, commodities); setup falls through to the shared code below.
  if (isCitiesAndKnights(state)) {
    const ck = chooseCitiesAndKnightsAction(state, playerId, randomDice);
    if (ck !== undefined) return ck;
  }

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
    if (!choice) return null;
    return {
      type: 'movePirate',
      playerId,
      hex: choice.hex,
      stealFrom: choice.stealFrom,
      ...(choice.stealCloth ? { stealCloth: true } : {}),
    };
  }

  // Seafarers / Forgotten Tribe: place a port picked up from the tribe.
  if (state.phase === 'placeTribePort') {
    if (state.pendingTribePort?.playerId !== playerId) return null;
    const edge = chooseTribePortEdge(state, playerId);
    return edge ? { type: 'placeTribePort', playerId, edge } : null;
  }

  // Seafarers / Pirate Islands: no robber; steal from anyone on a 7.
  if (state.phase === 'stealResource') {
    return { type: 'stealResource', playerId, stealFrom: chooseStealResourceTarget(state, playerId) };
  }

  // Seafarers: gold-hex resource choice. Only fires when this AI has a
  // pending pick; the phase loops through all owed players.
  if (state.phase === 'chooseGoldResource') {
    const pending = state.goldChoiceState?.pending[playerId];
    if (pending && pending > 0) {
      return {
        type: 'chooseGoldResource',
        playerId,
        resources: chooseGoldResourcePicks(state, playerId, requiredGoldPicks(state, playerId)),
      };
    }
    return null;
  }

  // Setup
  if (isSetupPhase(state.phase)) {
    if (state.setupState?.step === 'settlement') {
      const vid = chooseSetupSettlement(state, playerId);
      return { type: 'placeInitialSettlement', playerId, vertex: vid };
    }
    const placed = state.setupState!.lastPlacedSettlement!;
    const pick = chooseSetupRoad(state, playerId, placed);
    return pick.ship
      ? { type: 'placeInitialShip', playerId, edge: pick.edge }
      : { type: 'placeInitialRoad', playerId, edge: pick.edge };
  }

  if (state.phase === 'rollOrPlayKnight') {
    // Optionally play knight first (e.g., to clear robber off our hex)
    // (T&B scenario: Knights move barbarians — played in the Action / End of
    // Turn phases by its own logic, not on the robber rule here.)
    const knight = state.tradersBarbarians ? null : chooseDevCardPlay(state, playerId);
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

  // T&B Catan Event Cards: answer the flipped event (pick / give / steal /
  // damage a road).
  if (state.phase === 'eventResolution') {
    return chooseEventAnswer(state, playerId);
  }

  // T&B Fishing on Catan: swap a token after a capped catch.
  if (state.phase === 'fishSwap') {
    return state.fishSwap?.queue[0] === playerId ? chooseFishSwap(state, playerId) : null;
  }

  // T&B Merchant Trains end-of-turn voting round and wagon placement.
  if (state.phase === 'wagonVoting' || state.phase === 'placeWagon') {
    return chooseMerchantTrainsAction(state, playerId);
  }

  // T&B Barbarian Attack: the choice for a card just bought, then the
  // end-of-turn knight moves (null = done, the driver ends the turn).
  if (state.phase === 'barbarianCard') {
    return chooseBarbarianCardAction(state, playerId);
  }
  if (state.phase === 'barbarianKnightMoves') {
    return chooseBarbarianKnightMove(state, playerId);
  }

  // T&B "Traders & Barbarians" scenario: placing a barbarian, then the End
  // of Turn wagon movement (null = done, the driver ends the turn).
  if (state.phase === 'moveBarbarian' || state.phase === 'wagonMoves') {
    return chooseTradersBarbariansAction(state, playerId);
  }

  return null;
}

export { shouldAcceptTrade } from './trade';

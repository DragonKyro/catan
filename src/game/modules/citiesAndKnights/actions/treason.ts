import type {
  GameState,
  KnightStrength,
  TreasonPlaceKnightAction,
  TreasonRemoveKnightAction,
} from '../../../types';
import { knightAt, supplyAvailable } from '../knights/state';
import { vertexConnectedToOwnNetwork, vertexIsOccupied } from '../knights/state';

// Treason sub-phase 1: the targeted player picks which of their knights to
// remove. The removed knight goes back to the target's supply.
export function handleTreasonRemoveKnight(
  state: GameState,
  action: TreasonRemoveKnightAction,
): GameState {
  if (state.phase !== 'treasonRemoveKnight') {
    throw new Error(`Cannot remove (treason) in phase ${state.phase}`);
  }
  if (!state.pendingTreason) throw new Error('No pending treason');
  if (action.playerId !== state.pendingTreason.targetId) {
    throw new Error('Not the treason target');
  }
  const k = knightAt(state, action.vertex);
  if (!k) throw new Error('No knight at that vertex');
  if (k.playerId !== action.playerId) throw new Error('Not your knight');

  const nextKnights = { ...(state.knights ?? {}) };
  delete nextKnights[action.vertex];

  return {
    ...state,
    knights: nextKnights,
    knightSupply: {
      ...(state.knightSupply ?? {}),
      [action.playerId]: {
        ...(state.knightSupply?.[action.playerId] ?? { 1: 0, 2: 0, 3: 0 }),
        [k.strength]:
          (state.knightSupply?.[action.playerId]?.[k.strength] ?? 0) + 1,
      },
    },
    phase: 'treasonPlaceKnight',
    pendingTreason: {
      ...state.pendingTreason,
      removedStrength: k.strength,
    },
  };
}

// Treason sub-phase 2: attacker places a knight of strength <= removed.
// Rulebook: if the removed knight was mighty, the attacker may place a
// mighty knight even without politics 3.
export function handleTreasonPlaceKnight(
  state: GameState,
  action: TreasonPlaceKnightAction,
): GameState {
  if (state.phase !== 'treasonPlaceKnight') {
    throw new Error(`Cannot place (treason) in phase ${state.phase}`);
  }
  if (!state.pendingTreason || !state.pendingTreason.removedStrength) {
    throw new Error('No pending treason placement');
  }
  if (action.playerId !== state.pendingTreason.attackerId) {
    throw new Error('Not the treason attacker');
  }
  const maxStrength: KnightStrength = state.pendingTreason.removedStrength;
  if (action.strength > maxStrength) {
    throw new Error('Strength must be <= the removed knight');
  }
  if (supplyAvailable(state, action.playerId, action.strength) <= 0) {
    throw new Error('No knight of that strength in your supply');
  }
  if (vertexIsOccupied(state, action.vertex)) {
    throw new Error('Vertex is occupied');
  }
  if (!vertexConnectedToOwnNetwork(state, action.playerId, action.vertex)) {
    throw new Error('Knight must connect to one of your roads');
  }

  return {
    ...state,
    knights: {
      ...(state.knights ?? {}),
      [action.vertex]: {
        playerId: action.playerId,
        strength: action.strength,
        active: false,
      },
    },
    knightSupply: {
      ...(state.knightSupply ?? {}),
      [action.playerId]: {
        ...(state.knightSupply?.[action.playerId] ?? { 1: 0, 2: 0, 3: 0 }),
        [action.strength]:
          (state.knightSupply?.[action.playerId]?.[action.strength] ?? 0) - 1,
      },
    },
    phase: 'main',
    pendingTreason: undefined,
  };
}

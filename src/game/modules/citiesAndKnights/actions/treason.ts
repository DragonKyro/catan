import type {
  GameState,
  TreasonPlaceKnightAction,
  TreasonRemoveKnightAction,
} from '../../../types';
import { knightAt } from '../knights/state';
import { canRecruitKnightAt, treasonPlaceableStrengths, treasonPlacementSpots } from '../knights/legal';
import { adjustSupply } from './recruitKnight';
import { resumeFlow } from '../flow';

// Treason (p.16), step 1: the chosen player picks one of their knights and
// removes it (back to their supply). They must, even if the attacker then
// can't place a knight.
export function handleTreasonRemoveKnight(
  state: GameState,
  action: TreasonRemoveKnightAction,
): GameState {
  if (state.phase !== 'treasonRemoveKnight') {
    throw new Error(`Cannot remove (treason) in phase ${state.phase}`);
  }
  if (!state.pendingTreason) throw new Error('No pending treason');
  if (action.playerId !== state.pendingTreason.targetId) throw new Error('Not the treason target');
  const k = knightAt(state, action.vertex);
  if (!k) throw new Error('No knight at that vertex');
  if (k.playerId !== action.playerId) throw new Error('Not your knight');

  const knights = { ...(state.knights ?? {}) };
  delete knights[action.vertex];
  let next = adjustSupply({ ...state, knights }, action.playerId, k.strength, +1);
  next = {
    ...next,
    phase: 'treasonPlaceKnight',
    pendingTreason: { ...state.pendingTreason, removedStrength: k.strength, removedActive: k.active },
  };
  // Nothing the attacker could place (no knight that strong or weaker in
  // their supply, or no free spot on their roads): the card ends here.
  if (
    treasonPlaceableStrengths(next).length === 0 ||
    treasonPlacementSpots(next, state.pendingTreason.attackerId).length === 0
  ) {
    return resumeFlow({ ...next, pendingTreason: undefined });
  }
  return next;
}

// Treason, step 2: the attacker MAY place one of their knights of the same
// strength or lower, following the normal placement rules; it takes the
// removed knight's status. A removed mighty knight lets them place a mighty
// one even without politics level 3. Omit vertex + strength to decline.
export function handleTreasonPlaceKnight(
  state: GameState,
  action: TreasonPlaceKnightAction,
): GameState {
  if (state.phase !== 'treasonPlaceKnight') {
    throw new Error(`Cannot place (treason) in phase ${state.phase}`);
  }
  const t = state.pendingTreason;
  if (!t || !t.removedStrength) throw new Error('No pending treason placement');
  if (action.playerId !== t.attackerId) throw new Error('Not the treason attacker');

  if (action.vertex === undefined && action.strength === undefined) {
    return resumeFlow({ ...state, pendingTreason: undefined });
  }
  if (action.vertex === undefined || action.strength === undefined) {
    throw new Error('Give both a vertex and a strength, or neither to skip');
  }
  if (!treasonPlaceableStrengths(state).includes(action.strength)) {
    throw new Error('Place a knight no stronger than the removed one, from your supply');
  }
  if (!canRecruitKnightAt(state, action.playerId, action.vertex)) {
    throw new Error('Knights go on an empty intersection next to one of your roads');
  }
  const active = !!t.removedActive;
  let next: GameState = {
    ...state,
    knights: {
      ...(state.knights ?? {}),
      [action.vertex]: {
        playerId: action.playerId,
        strength: action.strength,
        active,
        // Placed this turn: it wasn't active at the start of the Action
        // phase, so it can't take a knight action yet.
        ...(active ? { activatedThisTurn: true as const } : {}),
      },
    },
    pendingTreason: undefined,
  };
  next = adjustSupply(next, action.playerId, action.strength, -1);
  return resumeFlow(next);
}

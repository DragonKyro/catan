import type { GameState, PassOldBootAction } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { calculateVictoryPoints } from '../../../scoring/points';

// "During your turn, you may give the old boot to any player who has the
// same or more VPs as you. Hidden Victory Point cards do not count in this
// calculation." — T&B rulebook.
//
// Public VP comparison (includeHidden=false) is the right invariant here:
// hidden dev cards must not leak via the boot rule.
export function handlePassOldBoot(
  state: GameState,
  action: PassOldBootAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot pass the old boot in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) {
    throw new Error('Not your turn');
  }
  if (state.oldBootHolder !== action.playerId) {
    throw new Error('You do not have the old boot');
  }
  if (action.to === action.playerId) {
    throw new Error('Cannot pass the boot to yourself');
  }
  const target = state.players.find((p) => p.id === action.to);
  if (!target) throw new Error('Unknown boot recipient');
  const myVp = calculateVictoryPoints(state, action.playerId, false);
  const theirVp = calculateVictoryPoints(state, action.to, false);
  if (theirVp < myVp) {
    throw new Error(
      'Boot may only go to a player with at least as many visible VPs as you',
    );
  }
  return { ...state, oldBootHolder: action.to };
}

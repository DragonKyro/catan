import type { GameState, GamePhase } from '../../types';
import { SEAFARERS_EXPANSION_ID } from './constants';

// Returns the phase to enter when the engine is about to set `moveRobber`.
// With Seafarers active, route through `chooseRobberOrPirate` so the player
// can elect to move the pirate instead. Without Seafarers, the engine stays
// on the classic `moveRobber` flow.
export function robberOrPirateChoicePhase(state: GameState): GamePhase {
  return state.settings.expansions.includes(SEAFARERS_EXPANSION_ID)
    ? 'chooseRobberOrPirate'
    : 'moveRobber';
}

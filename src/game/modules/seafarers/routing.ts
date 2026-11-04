import type { GameState, GamePhase } from '../../types';
import { currentPlayerId } from '../../helpers';
import { SEAFARERS_EXPANSION_ID } from './constants';
import { hasClothTradeRoute } from './cloth';

// Returns the phase to enter when the engine is about to set `moveRobber`
// (a 7 after discards, or a Knight). Seafarers lets the player move the
// pirate instead, so route through `chooseRobberOrPirate` — unless there's
// no pirate in this scenario (Wonders of Catan), or the player may not move
// it yet (Cloth for Catan: not before their first village trade route).
// Pirate Islands has no robber at all: a 7 lets the roller steal a card.
export function robberOrPirateChoicePhase(state: GameState): GamePhase {
  if (!state.settings.expansions.includes(SEAFARERS_EXPANSION_ID)) return 'moveRobber';
  if (state.pirateIslands) return 'stealResource';
  if (!canChoosePirate(state)) return 'moveRobber';
  return 'chooseRobberOrPirate';
}

export function canChoosePirate(state: GameState): boolean {
  if (!state.board.pirateHex) return false;
  if (state.pirateIslands) return false;
  if (state.clothVillages && !hasClothTradeRoute(state, currentPlayerId(state))) {
    return false;
  }
  return true;
}

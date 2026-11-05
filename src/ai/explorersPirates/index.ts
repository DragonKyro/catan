import type { Action, GameState, PlayerId } from '@/game/types';
import { isSetupPhase } from '@/game/actions/setup';
import { chooseDiscard } from '../discard';
import { chooseEpSetupAction } from './setup';
import { chooseEpMainAction } from './main';
import { chooseMovementAction } from './movement';
import { choosePiratePlacement } from './pirate';

// Heuristic AI for Explorers & Pirates (2025 rulebook). Pure and stateless:
// every call re-plans from the state. Returns
//   - an Action to dispatch,
//   - null = end the phase (Action phase → Movement phase → next turn),
//   - undefined = not an Explorers & Pirates decision (the shared code
//     handles it).
// No peeking: nothing here reads `explorersPirates.hidden`, the disc stacks,
// the lair tokens or an uncaptured lair's number.
export function chooseExplorersPiratesAction(
  state: GameState,
  playerId: PlayerId,
  rollDice: () => [number, number],
): Action | null | undefined {
  if (!state.explorersPirates) return undefined;
  if (isSetupPhase(state.phase)) return chooseEpSetupAction(state, playerId);
  switch (state.phase) {
    case 'rollOrPlayKnight':
      return { type: 'rollDice', playerId, dice: rollDice() };
    case 'discard': {
      if (!state.discardState?.required[playerId]) return null;
      return { type: 'discard', playerId, resources: chooseDiscard(state, playerId) };
    }
    case 'epPlacePirate':
      return choosePiratePlacement(state, playerId);
    case 'main':
      return chooseEpMainAction(state, playerId);
    case 'epMovement':
      return chooseMovementAction(state, playerId);
    default:
      return undefined;
  }
}

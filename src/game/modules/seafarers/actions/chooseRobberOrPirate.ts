import type {
  GameState,
  ChooseRobberAction,
  ChoosePirateAction,
} from '../../../types';
import { currentPlayerId } from '../../../helpers';

// chooseRobber: commit to moving the robber. Phase becomes 'moveRobber',
// using the existing pendingRobberMove context.
export function handleChooseRobber(
  state: GameState,
  action: ChooseRobberAction,
): GameState {
  if (state.phase !== 'chooseRobberOrPirate') {
    throw new Error(`Cannot choose robber in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  return { ...state, phase: 'moveRobber' };
}

// choosePirate: commit to moving the pirate. Phase becomes 'movePirate'.
// The pendingRobberMove context is reused as pendingPirateMove (same shape).
export function handleChoosePirate(
  state: GameState,
  action: ChoosePirateAction,
): GameState {
  if (state.phase !== 'chooseRobberOrPirate') {
    throw new Error(`Cannot choose pirate in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.pendingRobberMove) throw new Error('No pending robber move context');
  return {
    ...state,
    phase: 'movePirate',
    pendingPirateMove: state.pendingRobberMove,
    pendingRobberMove: undefined,
  };
}

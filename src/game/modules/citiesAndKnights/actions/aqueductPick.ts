import type { AqueductPickAction, GameState } from '../../../types';
import { RESOURCES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { addResources, subtractResources } from '../../../resources';

// Science L3 (Aqueduct) free-resource pick. Iterates the queue of pending
// players; each dispatches once, then we return to main when the queue empties.
export function handleAqueductPick(
  state: GameState,
  action: AqueductPickAction,
): GameState {
  if (state.phase !== 'aqueductPick') {
    throw new Error(`Cannot pick aqueduct resource in phase ${state.phase}`);
  }
  if (!state.pendingAqueduct || state.pendingAqueduct.length === 0) {
    throw new Error('No pending aqueduct picks');
  }
  // Strict ordering: first in queue is the acting player.
  const expected = state.pendingAqueduct[0]!;
  if (action.playerId !== expected) {
    throw new Error(`It's ${expected}'s aqueduct pick`);
  }
  if (!RESOURCES.includes(action.resource)) {
    throw new Error('Unknown resource');
  }
  if (state.bank[action.resource] <= 0) {
    throw new Error(`Bank is out of ${action.resource}`);
  }
  const give = { [action.resource]: 1 };
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: addResources(p.resources, give),
  }));
  next = {
    ...next,
    bank: subtractResources(next.bank, give),
  };
  const remaining = state.pendingAqueduct.slice(1);
  if (remaining.length === 0) {
    return {
      ...next,
      pendingAqueduct: undefined,
      // Aqueduct fires during the production step; main is where we always
      // return to.
      phase: 'main',
    };
  }
  return {
    ...next,
    pendingAqueduct: remaining,
  };
}

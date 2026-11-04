import type {
  GameState,
  ChooseGoldResourceAction,
  PlayerId,
  Resource,
  ResourceBank,
} from '../../../types';
import { RESOURCES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { addResources, subtractResources, totalResources } from '../../../resources';
import { startSevenResolution } from '../../../actions/dice';

// How many picks `playerId` must make right now: their pending count, capped
// by what the bank still holds (an empty bank can't pay out, and requiring
// the full count would deadlock the phase).
export function requiredGoldPicks(state: GameState, playerId: PlayerId): number {
  const pending = state.goldChoiceState?.pending[playerId] ?? 0;
  return Math.min(pending, totalResources(state.bank));
}

export function handleChooseGoldResource(
  state: GameState,
  action: ChooseGoldResourceAction,
): GameState {
  if (state.phase !== 'chooseGoldResource') {
    throw new Error(`Cannot choose gold resource in phase ${state.phase}`);
  }
  const pending = state.goldChoiceState?.pending[action.playerId];
  if (!pending) throw new Error('No pending gold pick for this player');
  const required = requiredGoldPicks(state, action.playerId);
  if (action.resources.length !== required) {
    throw new Error(`Expected ${required} resources, got ${action.resources.length}`);
  }

  // Validate each pick is a real resource and the bank can supply it.
  const tally: Partial<ResourceBank> = {};
  for (const r of action.resources) {
    if (!RESOURCES.includes(r)) throw new Error(`Invalid resource: ${r}`);
    tally[r] = (tally[r] ?? 0) + 1;
  }
  for (const r of RESOURCES) {
    if ((tally[r] ?? 0) > state.bank[r]) {
      throw new Error(`Bank does not have enough ${r}`);
    }
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: addResources(p.resources, tally),
  }));
  next = { ...next, bank: subtractResources(next.bank, tally) };

  // Remove this player's pending count. If everyone has picked, resume the
  // phase recorded in returnTo (defaults to 'main' for the gold-roll case).
  const { returnTo = 'main', afterPicks } = next.goldChoiceState!;
  const newPending = { ...next.goldChoiceState!.pending };
  delete newPending[action.playerId];
  if (Object.keys(newPending).length > 0) {
    return { ...next, goldChoiceState: { pending: newPending, returnTo, afterPicks } };
  }
  next = { ...next, goldChoiceState: undefined };
  if (afterPicks === 'resolveSeven') return startSevenResolution(next);
  return { ...next, phase: returnTo };
}

// Re-export Resource for ergonomic imports from the module index.
export type { Resource };

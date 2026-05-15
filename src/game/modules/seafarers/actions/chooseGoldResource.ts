import type {
  GameState,
  ChooseGoldResourceAction,
  Resource,
  ResourceBank,
} from '../../../types';
import { RESOURCES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { addResources, subtractResources } from '../../../resources';

export function handleChooseGoldResource(
  state: GameState,
  action: ChooseGoldResourceAction,
): GameState {
  if (state.phase !== 'chooseGoldResource') {
    throw new Error(`Cannot choose gold resource in phase ${state.phase}`);
  }
  const pending = state.goldChoiceState?.pending[action.playerId];
  if (!pending) throw new Error('No pending gold pick for this player');
  if (action.resources.length !== pending) {
    throw new Error(`Expected ${pending} resources, got ${action.resources.length}`);
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

  // Remove this player's pending count. If everyone has picked, advance to main.
  const newPending = { ...next.goldChoiceState!.pending };
  delete newPending[action.playerId];
  if (Object.keys(newPending).length === 0) {
    next = { ...next, phase: 'main', goldChoiceState: undefined };
  } else {
    next = { ...next, goldChoiceState: { pending: newPending } };
  }
  return next;
}

// Re-export Resource for ergonomic imports from the module index.
export type { Resource };

import type { AqueductPickAction, GameState } from '../../../types';
import { RESOURCES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { addResources, subtractResources } from '../../../resources';
import { resumeFlow } from '../flow';

// Aqueduct (science level 3, p.8): a player who received no cards in the
// Production phase takes 1 resource of their choice from the supply. Queued
// in turn order from the active player.
export function handleAqueductPick(state: GameState, action: AqueductPickAction): GameState {
  if (state.phase !== 'aqueductPick') {
    throw new Error(`Cannot pick aqueduct resource in phase ${state.phase}`);
  }
  const queue = state.pendingAqueduct ?? [];
  if (queue.length === 0) throw new Error('No pending aqueduct picks');
  if (action.playerId !== queue[0]) throw new Error(`It's ${queue[0]}'s aqueduct pick`);
  if (!RESOURCES.includes(action.resource)) throw new Error('Unknown resource');
  if (state.bank[action.resource] <= 0) {
    throw new Error(`The supply is out of ${action.resource}`);
  }
  const give = { [action.resource]: 1 };
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: addResources(p.resources, give),
  }));
  next = { ...next, bank: subtractResources(next.bank, give) };
  const rest = queue.slice(1);
  return resumeFlow({ ...next, pendingAqueduct: rest.length > 0 ? rest : undefined });
}

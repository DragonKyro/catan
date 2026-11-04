import type { GameState, KnightStrength, PromoteKnightAction, VertexId, PlayerId } from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { knightAt, mightyAllowed, supplyAvailable } from '../knights/state';
import { adjustSupply } from './recruitKnight';

// Promote a knight one strength (p.9). Cost: 1 wool + 1 ore. The stronger
// piece replaces the weaker one, keeping its active/inactive status. Each
// knight may be promoted once per turn; strong → mighty needs politics
// level 3 (Fortress); the next strength must be in your supply.
export function handlePromoteKnight(state: GameState, action: PromoteKnightAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot promote knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (!canAfford(player.resources, COSTS.promoteKnight)) {
    throw new Error('Cannot afford to promote a knight (1 wool + 1 ore)');
  }
  let next = promoteKnightFree(state, action.playerId, action.vertex);
  next = updatePlayer(next, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, COSTS.promoteKnight),
  }));
  return { ...next, bank: addResources(next.bank, COSTS.promoteKnight) };
}

// The promotion itself, without paying (shared with Smithing). Throws with
// the reason when the knight can't be promoted.
export function promoteKnightFree(state: GameState, playerId: PlayerId, vertex: VertexId): GameState {
  const k = knightAt(state, vertex);
  if (!k) throw new Error('No knight at that vertex');
  if (k.playerId !== playerId) throw new Error('Not your knight');
  if (k.strength >= 3) throw new Error('Knight is already mighty');
  if (k.promotedThisTurn) throw new Error('That knight was already promoted this turn');
  const nextStrength = (k.strength + 1) as KnightStrength;
  if (nextStrength === 3 && !mightyAllowed(state, playerId)) {
    throw new Error('Politics level 3 (Fortress) is required to promote to a mighty knight');
  }
  if (supplyAvailable(state, playerId, nextStrength) <= 0) {
    throw new Error('No knights of the next strength left in your supply');
  }
  let next: GameState = {
    ...state,
    knights: {
      ...(state.knights ?? {}),
      [vertex]: { ...k, strength: nextStrength, promotedThisTurn: true },
    },
  };
  next = adjustSupply(next, playerId, k.strength, +1);
  return adjustSupply(next, playerId, nextStrength, -1);
}

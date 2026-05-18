import type {
  GameState,
  KnightStrength,
  PromoteKnightAction,
} from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { knightAt, mightyAllowed, supplyAvailable } from '../knights/state';

// Promote a knight one level. Cost: 1 sheep + 1 ore. Once per turn
// (state.promotedKnightThisTurn). Strong → Mighty requires politics
// improvement >= 3. If the next-strength supply is empty, refuse.
// Active/inactive status is preserved.
export function handlePromoteKnight(
  state: GameState,
  action: PromoteKnightAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot promote knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (state.promotedKnightThisTurn) {
    throw new Error('Already promoted a knight this turn');
  }
  const player = getPlayer(state, action.playerId);
  const k = knightAt(state, action.vertex);
  if (!k) throw new Error('No knight at that vertex');
  if (k.playerId !== action.playerId) throw new Error('Not your knight');
  if (k.strength >= 3) throw new Error('Knight is already mighty');
  const nextStrength = (k.strength + 1) as KnightStrength;
  if (nextStrength === 3 && !mightyAllowed(state, action.playerId)) {
    throw new Error('Politics level 3 is required to promote to a mighty knight');
  }
  if (supplyAvailable(state, action.playerId, nextStrength) <= 0) {
    throw new Error('No knights of the next strength left in supply');
  }
  if (!canAfford(player.resources, COSTS.promoteKnight)) {
    throw new Error('Cannot afford to promote a knight');
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, COSTS.promoteKnight),
  }));
  // Supply: -1 of next strength (now on the board), +1 of previous strength
  // (returned to supply).
  next = {
    ...next,
    bank: addResources(next.bank, COSTS.promoteKnight),
    knights: {
      ...(next.knights ?? {}),
      [action.vertex]: { ...k, strength: nextStrength },
    },
    knightSupply: {
      ...(next.knightSupply ?? {}),
      [action.playerId]: {
        ...(next.knightSupply?.[action.playerId] ?? { 1: 0, 2: 0, 3: 0 }),
        [k.strength]:
          (next.knightSupply?.[action.playerId]?.[k.strength] ?? 0) + 1,
        [nextStrength]:
          (next.knightSupply?.[action.playerId]?.[nextStrength] ?? 0) - 1,
      },
    },
    promotedKnightThisTurn: true,
  };
  return next;
}

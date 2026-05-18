import type { GameState, RecruitKnightAction } from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import {
  supplyAvailable,
  vertexConnectedToOwnNetwork,
  vertexIsOccupied,
} from '../knights/state';

// Recruit a basic (strength-1) knight. Cost: 1 sheep + 1 ore. The knight
// is placed face-down (inactive) on an empty vertex connected to one of
// the player's roads. Distance rule is NOT enforced on knights (rulebook
// p.9 — they may sit adjacent to settlements).
//
// If the player has no level-1 in supply, they must promote one of their
// existing level-1 knights first (rulebook p.9). This handler just refuses
// — the UI surfaces the constraint as a disabled button.
export function handleRecruitKnight(
  state: GameState,
  action: RecruitKnightAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot recruit knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (!canAfford(player.resources, COSTS.knight)) {
    throw new Error('Cannot afford to recruit a knight');
  }
  if (supplyAvailable(state, action.playerId, 1) <= 0) {
    throw new Error('No basic knights left in supply — promote one instead');
  }
  if (vertexIsOccupied(state, action.vertex)) {
    throw new Error('Vertex is occupied');
  }
  if (!vertexConnectedToOwnNetwork(state, action.playerId, action.vertex)) {
    throw new Error('Knight must be placed adjacent to one of your roads');
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, COSTS.knight),
  }));
  next = {
    ...next,
    bank: addResources(next.bank, COSTS.knight),
    knights: {
      ...(next.knights ?? {}),
      [action.vertex]: {
        playerId: action.playerId,
        strength: 1,
        active: false,
      },
    },
    knightSupply: {
      ...(next.knightSupply ?? {}),
      [action.playerId]: {
        ...(next.knightSupply?.[action.playerId] ?? { 1: 0, 2: 0, 3: 0 }),
        1: (next.knightSupply?.[action.playerId]?.[1] ?? 0) - 1,
      },
    },
  };
  return next;
}

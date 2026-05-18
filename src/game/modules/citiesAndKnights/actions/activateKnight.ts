import type { GameState, ActivateKnightAction } from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { knightAt } from '../knights/state';

// Stand up an inactive knight. Cost: 1 wheat. The activated knight cannot
// take a knight action this same turn (rulebook p.9 — "you may not activate
// a knight and then take an action with it on the same turn"). We record
// the vertex on `state.activatedKnightsThisTurn` so the action handlers can
// gate on it; the list resets on endTurn.
export function handleActivateKnight(
  state: GameState,
  action: ActivateKnightAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot activate knight in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  const k = knightAt(state, action.vertex);
  if (!k) throw new Error('No knight at that vertex');
  if (k.playerId !== action.playerId) throw new Error('Not your knight');
  if (k.active) throw new Error('Knight is already active');
  if (!canAfford(player.resources, COSTS.activateKnight)) {
    throw new Error('Cannot afford to activate a knight (1 wheat)');
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, COSTS.activateKnight),
  }));
  next = {
    ...next,
    bank: addResources(next.bank, COSTS.activateKnight),
    knights: {
      ...(next.knights ?? {}),
      [action.vertex]: { ...k, active: true },
    },
    activatedKnightsThisTurn: [
      ...(next.activatedKnightsThisTurn ?? []),
      action.vertex,
    ],
  };
  return next;
}

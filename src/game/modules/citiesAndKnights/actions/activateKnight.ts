import type { GameState, ActivateKnightAction } from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { knightAt } from '../knights/state';

// Stand up an inactive knight (p.9). Cost: 1 wheat. You may recruit and then
// activate, or act with a knight (which lays it down) and then activate it,
// but a knight activated this turn can't act this turn: it's flagged
// `activatedThisTurn` (cleared at endTurn) and listed in
// `activatedKnightsThisTurn` for older readers.
export function handleActivateKnight(state: GameState, action: ActivateKnightAction): GameState {
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
      [action.vertex]: { ...k, active: true, activatedThisTurn: true },
    },
    activatedKnightsThisTurn: [...(next.activatedKnightsThisTurn ?? []), action.vertex],
  };
  return next;
}

import type { GameState, RemoveRoadAction } from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';
import { isOpenRoad, roadOwner } from '../progress/diplomacy';
import { resumeFlow } from '../flow';

// Diplomacy follow-up (p.15): remove an open road. Another player's road
// goes back to their supply; removing your own lets you build 1 road at no
// cost (the next buildRoad this turn is free).
export function handleRemoveRoad(state: GameState, action: RemoveRoadAction): GameState {
  if (state.phase !== 'removeRoad') {
    throw new Error(`Cannot remove road in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const owner = roadOwner(state, action.edge);
  if (!owner) throw new Error('No road on that edge');
  if (!isOpenRoad(state, action.edge)) throw new Error('That road is not open');
  const next = updatePlayer(state, owner, (p) => ({
    ...p,
    roads: p.roads.filter((e) => e !== action.edge),
  }));
  return resumeFlow({ ...next, diplomacyFreeRoad: owner === action.playerId });
}

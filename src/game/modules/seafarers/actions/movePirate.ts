import type {
  GameState,
  MovePirateAction,
  PlayerId,
  Resource,
} from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';
import { totalResources, flattenBank } from '../../../resources';
import { pickOne } from '../../../rng';

// Move the pirate to a sea hex, then optionally steal from a player who has
// a SHIP on one of the hex's adjacent edges. Mirrors handleMoveRobber but:
//   - target hex must be a sea hex
//   - steal-candidate set is players with ships adjacent (not settlements)
export function handleMovePirate(
  state: GameState,
  action: MovePirateAction,
): GameState {
  if (state.phase !== 'movePirate') {
    throw new Error(`Cannot move pirate in phase ${state.phase}`);
  }
  if (!state.pendingPirateMove) throw new Error('No pending pirate move');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const targetHex = state.board.hexes[action.hex];
  if (!targetHex) throw new Error('Unknown hex');
  if (targetHex.terrain !== 'sea') throw new Error('Pirate must move to a sea hex');
  if (action.hex === state.board.pirateHex) {
    throw new Error('Pirate must move to a different hex');
  }

  // Edges around this hex: hex.hexes membership in edge.hexes.
  const adjacentEdgeIds: string[] = [];
  for (const eid of state.board.edgeIds) {
    if (state.board.edges[eid]!.hexes.includes(action.hex)) adjacentEdgeIds.push(eid);
  }
  const stealCandidates = new Set<PlayerId>();
  for (const eid of adjacentEdgeIds) {
    for (const p of state.players) {
      if (p.id === action.playerId) continue;
      if (p.ships.includes(eid) && totalResources(p.resources) > 0) {
        stealCandidates.add(p.id);
      }
    }
  }

  let next: GameState = {
    ...state,
    board: { ...state.board, pirateHex: action.hex },
  };

  if (action.stealFrom !== null) {
    if (!stealCandidates.has(action.stealFrom)) {
      throw new Error('Cannot steal from that player');
    }
    const target = state.players.find((p) => p.id === action.stealFrom)!;
    const pool = flattenBank(target.resources);
    let [stolen, newRng]: [Resource, number] = pickOne(next.rngState, pool);
    next = { ...next, rngState: newRng };
    next = updatePlayer(next, action.stealFrom, (p) => ({
      ...p,
      resources: { ...p.resources, [stolen]: p.resources[stolen] - 1 },
    }));
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      resources: { ...p.resources, [stolen]: p.resources[stolen] + 1 },
    }));
  } else if (stealCandidates.size > 0) {
    throw new Error('Must select a player to steal from');
  }

  const returnTo = state.pendingPirateMove.returnTo;
  return { ...next, phase: returnTo, pendingPirateMove: undefined };
}

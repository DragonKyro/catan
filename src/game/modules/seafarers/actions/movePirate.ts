import type {
  GameState,
  MovePirateAction,
  PlayerId,
  Resource,
} from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';
import { totalResources, flattenBank } from '../../../resources';
import { pickOne } from '../../../rng';

// Players `actorId` could rob by moving the pirate to `hexId`: opponents with
// a ship on one of its edges who hold a resource card (or, in Cloth for
// Catan, a cloth token).
export function pirateStealCandidates(
  state: GameState,
  actorId: PlayerId,
  hexId: string,
): PlayerId[] {
  const out: PlayerId[] = [];
  for (const p of state.players) {
    if (p.id === actorId) continue;
    const hasShip = p.ships.some((eid) => state.board.edges[eid]?.hexes.includes(hexId));
    if (!hasShip) continue;
    if (totalResources(p.resources) > 0 || (p.cloth ?? 0) > 0) out.push(p.id);
  }
  return out;
}

// Hexes the pirate may move to: any other sea hex that's on the table.
export function canMovePirateTo(state: GameState, hexId: string): boolean {
  const hex = state.board.hexes[hexId];
  if (!hex || hex.terrain !== 'sea') return false;
  if (hexId === state.board.pirateHex) return false;
  if (state.unrevealedFogHexes?.includes(hexId)) return false;
  return true;
}

// Move the pirate to a sea hex, then steal from a player who has a ship on
// one of its edges. Cloth for Catan: the thief may take a cloth token
// instead of a resource card.
export function handleMovePirate(
  state: GameState,
  action: MovePirateAction,
): GameState {
  if (state.phase !== 'movePirate') {
    throw new Error(`Cannot move pirate in phase ${state.phase}`);
  }
  if (!state.pendingPirateMove) throw new Error('No pending pirate move');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.board.hexes[action.hex]) throw new Error('Unknown hex');
  if (state.board.hexes[action.hex]!.terrain !== 'sea') {
    throw new Error('Pirate must move to a sea hex');
  }
  if (!canMovePirateTo(state, action.hex)) {
    throw new Error('Pirate must move to a different, explored sea hex');
  }

  const candidates = pirateStealCandidates(state, action.playerId, action.hex);
  let next: GameState = {
    ...state,
    board: { ...state.board, pirateHex: action.hex },
  };

  if (action.stealFrom !== null) {
    if (!candidates.includes(action.stealFrom)) {
      throw new Error('Cannot steal from that player');
    }
    const target = state.players.find((p) => p.id === action.stealFrom)!;
    const wantsCloth = action.stealCloth === true && state.clothVillages !== undefined;
    if (wantsCloth || totalResources(target.resources) === 0) {
      if ((target.cloth ?? 0) <= 0) throw new Error('That player has nothing to steal');
      next = updatePlayer(next, target.id, (p) => ({ ...p, cloth: (p.cloth ?? 0) - 1 }));
      next = updatePlayer(next, action.playerId, (p) => ({ ...p, cloth: (p.cloth ?? 0) + 1 }));
    } else {
      const pool = flattenBank(target.resources);
      const [stolen, newRng]: [Resource, number] = pickOne(next.rngState, pool);
      next = { ...next, rngState: newRng };
      next = updatePlayer(next, target.id, (p) => ({
        ...p,
        resources: { ...p.resources, [stolen]: p.resources[stolen] - 1 },
      }));
      next = updatePlayer(next, action.playerId, (p) => ({
        ...p,
        resources: { ...p.resources, [stolen]: p.resources[stolen] + 1 },
      }));
    }
  } else if (candidates.length > 0) {
    throw new Error('Must select a player to steal from');
  }

  const returnTo = state.pendingPirateMove.returnTo;
  return { ...next, phase: returnTo, pendingPirateMove: undefined };
}

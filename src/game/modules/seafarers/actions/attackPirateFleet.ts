import type {
  GameState,
  AttackPirateFleetAction,
  EdgeId,
  PlayerId,
} from '../../../types';
import { currentPlayerId } from '../../../helpers';

// True iff `playerId` has at least one ship on an edge adjacent to the
// pirate fleet's hex.
export function hasShipAdjacentToFleet(
  state: GameState,
  playerId: PlayerId,
): boolean {
  if (!state.pirateFleet) return false;
  const fleetHex = state.pirateFleet.hexId;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  return player.ships.some((eid) => edgeTouchesHex(state, eid, fleetHex));
}

function edgeTouchesHex(state: GameState, edgeId: EdgeId, hexId: string): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  return edge.hexes.includes(hexId);
}

// Attack the Pirate Islands fleet. Validates phase, current player, that
// the fleet exists and isn't already defeated, that the player has a ship
// adjacent to the fleet hex, and that they haven't already attacked this
// turn. Each attack drops the fleet's strength by 1; on hitting 0 the
// player is recorded as the killing blow and gets +2 VP (see scoring).
export function handleAttackPirateFleet(
  state: GameState,
  action: AttackPirateFleetAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot attack pirate fleet in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.pirateFleet) throw new Error('No pirate fleet in this game');
  if (state.pirateFleet.defeatedBy !== null) {
    throw new Error('The pirate fleet is already defeated');
  }
  if (state.attackedPirateThisTurn) {
    throw new Error('You can only attack the pirate fleet once per turn');
  }
  if (!hasShipAdjacentToFleet(state, action.playerId)) {
    throw new Error('You need a ship adjacent to the pirate fleet');
  }

  const newStrength = Math.max(0, state.pirateFleet.strength - 1);
  return {
    ...state,
    pirateFleet: {
      ...state.pirateFleet,
      strength: newStrength,
      defeatedBy: newStrength === 0 ? action.playerId : state.pirateFleet.defeatedBy,
    },
    attackedPirateThisTurn: true,
  };
}

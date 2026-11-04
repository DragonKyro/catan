import type { GameState, MoveShipAction } from '../../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../../helpers';
import {
  canBuildShip,
  isPirateAdjacent,
  isShipMovable,
  liftShip,
} from '../validation/shipPlacement';
import { afterShipPlaced } from '../hooks';
import { pirateIslandsShipViolation } from '../pirateIslands';

export { isShipMovable } from '../validation/shipPlacement';

// Move one ship per turn (rulebook p.2): lift a movable ship (see
// isShipMovable) and place it anywhere a new ship could go (never on an
// edge of the pirate's hex), without the lifted ship supporting itself.
export function handleMoveShip(state: GameState, action: MoveShipAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot move ship in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.movedShipThisTurn) throw new Error('Already moved a ship this turn');
  if (action.from === action.to) throw new Error('Source and destination must differ');
  if (player.builtShipsThisTurn?.includes(action.from)) {
    throw new Error('A ship built this turn may not move');
  }
  if (!isShipMovable(state, action.playerId, action.from)) {
    throw new Error('That ship is not movable (it needs an open end and must not touch the pirate)');
  }
  if (isPirateAdjacent(state, action.to)) {
    throw new Error("Ships can't be moved onto an edge of the pirate's hex");
  }
  const lifted = liftShip(state, action.playerId, action.from);
  if (!canBuildShip(lifted, action.playerId, action.to)) {
    throw new Error('Invalid ship move destination');
  }
  const violation = pirateIslandsShipViolation(lifted, action.playerId, action.to);
  if (violation) throw new Error(violation);

  const next = updatePlayer(lifted, action.playerId, (p) => ({
    ...p,
    ships: [...p.ships, action.to],
    movedShipThisTurn: true,
    warships: p.warships?.includes(action.from)
      ? [...p.warships.filter((e) => e !== action.from), action.to]
      : p.warships,
  }));
  return afterShipPlaced(next, action.playerId, action.to, { built: false });
}

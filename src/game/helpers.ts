import type { GameState, Player, PlayerId } from './types';

export function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  fn: (p: Player) => Player,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? fn(p) : p)),
  };
}

export function currentPlayerId(state: GameState): PlayerId {
  const id = state.playerOrder[state.currentPlayerIndex];
  if (!id) throw new Error('No current player');
  return id;
}

export function getPlayer(state: GameState, playerId: PlayerId): Player {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) throw new Error(`Unknown player: ${playerId}`);
  return p;
}

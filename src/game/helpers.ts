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

// Determines the player currently acting at this micro-step. In most phases
// that's the player at currentPlayerIndex; during discard it's the first
// player in the required map (per turn order).
export function getActingPlayerId(state: GameState): PlayerId {
  if (state.phase === 'discard' && state.discardState) {
    const required = state.discardState.required;
    for (const id of state.playerOrder) {
      if (required[id] !== undefined) return id;
    }
  }
  return state.playerOrder[state.currentPlayerIndex]!;
}

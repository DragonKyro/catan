import type { GameState, EndTurnAction } from '../types';
import { currentPlayerId, updatePlayer } from '../helpers';

export function handleEndTurn(state: GameState, action: EndTurnAction): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot end turn in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.hasRolledThisTurn) throw new Error('Must roll dice before ending turn');

  // Cycle the active player's bought-this-turn dev cards to playable.
  let next: GameState = state;
  const me = state.playerOrder[state.currentPlayerIndex]!;
  next = updatePlayer(next, me, (p) => {
    if (p.devCards.boughtThisTurn.length === 0) return p;
    return {
      ...p,
      devCards: {
        ...p.devCards,
        unplayed: [...p.devCards.unplayed, ...p.devCards.boughtThisTurn],
        boughtThisTurn: [],
      },
    };
  });

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return {
    ...next,
    currentPlayerIndex: nextIndex,
    phase: 'rollOrPlayKnight',
    hasRolledThisTurn: false,
    hasPlayedDevCardThisTurn: false,
    tradesProposedThisTurn: 0,
    lastRoll: null,
    pendingTrade: undefined,
  };
}

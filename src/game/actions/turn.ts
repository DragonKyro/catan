import type { GameState, EndTurnAction } from '../types';
import { currentPlayerId, updatePlayer, usesPairedRules, isPairedPlayer2, pairedPlayer2Index } from '../helpers';

// 5+ player paired-player rule (2022 revision of the CATAN 5-6 Player
// Extension): each "paired turn" has two acting seats — Player 1 (the
// dice-roller, full trade rights) and Player 2 (third seat to Player 1's
// left, bank trades only, may build and play 1 dev card). Both markers
// shift one seat to the left at the end of the paired turn.
//
// 3-4 player games do not use paired rules; endTurn simply advances to
// the next seat. The branch lives in `handleEndTurn` below.

export function handleEndTurn(state: GameState, action: EndTurnAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot end turn in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');

  // The dice must have been rolled this paired turn (rolled by Player 1).
  // For 3-4p this is checked against the active player; for 5+p the same
  // flag is set when P1 rolled, so it still gates correctly when P2 ends
  // their portion of the same paired turn.
  if (!state.hasRolledThisTurn) throw new Error('Must roll dice before ending turn');

  // Cycle the active player's bought-this-turn dev cards to playable.
  let next: GameState = state;
  const acting = state.playerOrder[state.currentPlayerIndex]!;
  next = updatePlayer(next, acting, (p) => {
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

  // 5+ player paired-player flow.
  if (usesPairedRules(state)) {
    if (!isPairedPlayer2(state)) {
      // Player 1's part just ended → hand the paired turn to Player 2.
      const p2Idx = pairedPlayer2Index(state)!;
      return {
        ...next,
        currentPlayerIndex: p2Idx,
        // hasRolledThisTurn stays true — P2 doesn't roll, they inherit P1's roll.
        // pendingTrade clears so any stale P1 offer doesn't bleed into P2's turn
        // (P2 can't propose/accept player trades anyway).
        pendingTrade: undefined,
        // hasPlayedDevCardThisTurn resets — the limit is "1 dev card per player
        // per paired turn", and P2's allowance is independent of P1's.
        hasPlayedDevCardThisTurn: false,
        // tradesProposedThisTurn doesn't apply to P2 (they can't propose);
        // leaving it at P1's count is fine.
      };
    }
    // Player 2's part just ended → advance both markers and start a new paired turn.
    return advanceToNextPairedTurn(next);
  }

  // 3-4 player flow: advance directly to the next seat.
  return advanceToNextRealTurn(next);
}

function advanceToNextPairedTurn(state: GameState): GameState {
  const currentP1 = state.turnHolderIndex ?? state.currentPlayerIndex;
  const nextP1 = (currentP1 + 1) % state.players.length;
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, movedShipThisTurn: false })),
    currentPlayerIndex: nextP1,
    turnHolderIndex: nextP1,
    phase: 'rollOrPlayKnight',
    hasRolledThisTurn: false,
    hasPlayedDevCardThisTurn: false,
    tradesProposedThisTurn: 0,
    lastRoll: null,
    pendingTrade: undefined,
    tradeResourcesThisTurn: undefined,
    proposedTradesThisTurn: undefined,
    attackedPirateThisTurn: undefined,
    // Cities & Knights per-turn flags.
    promotedKnightThisTurn: false,
    activatedKnightsThisTurn: [],
    hasPlayedProgressCardThisTurn: false,
    merchantFleetActive: undefined,
    craneActive: false,
    engineeringActive: false,
    medicineActive: false,
    diplomacyFreeRoad: false,
    pendingAlchemy: undefined,
  };
}

function advanceToNextRealTurn(state: GameState): GameState {
  const currentTurnHolder = state.turnHolderIndex ?? state.currentPlayerIndex;
  const nextIdx = (currentTurnHolder + 1) % state.players.length;
  return {
    ...state,
    // Seafarers: clear per-turn movedShipThisTurn flag on all players.
    players: state.players.map((p) => ({ ...p, movedShipThisTurn: false })),
    currentPlayerIndex: nextIdx,
    turnHolderIndex: nextIdx,
    phase: 'rollOrPlayKnight',
    hasRolledThisTurn: false,
    hasPlayedDevCardThisTurn: false,
    tradesProposedThisTurn: 0,
    lastRoll: null,
    pendingTrade: undefined,
    tradeResourcesThisTurn: undefined,
    proposedTradesThisTurn: undefined,
    attackedPirateThisTurn: undefined,
    // Cities & Knights per-turn flags.
    promotedKnightThisTurn: false,
    activatedKnightsThisTurn: [],
    hasPlayedProgressCardThisTurn: false,
    merchantFleetActive: undefined,
    craneActive: false,
    engineeringActive: false,
    medicineActive: false,
    diplomacyFreeRoad: false,
    pendingAlchemy: undefined,
  };
}

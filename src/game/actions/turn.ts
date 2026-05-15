import type { GameState, EndTurnAction, PlayerId } from '../types';
import { currentPlayerId, updatePlayer } from '../helpers';

// 5-6p Special Build Phase: each non-turn-holder gets a chance to build
// (road / settlement / city / dev card / bank trade) between turns.
// Player trades and dev-card plays are not allowed (per official rules).
const SBP_MIN_PLAYERS = 5;

export function handleEndTurn(state: GameState, action: EndTurnAction): GameState {
  if (state.phase !== 'main' && state.phase !== 'specialBuildPhase') {
    throw new Error(`Cannot end turn in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');

  // === SBP mini-turn end: pop the next SBP player, or hand off to the real
  //     next turn if the queue is now empty. ===
  if (state.phase === 'specialBuildPhase') {
    const queue = state.sbpQueue ?? [];
    const remaining = queue.slice(1);
    if (remaining.length > 0) {
      const nextSbp = remaining[0]!;
      const nextIdx = state.playerOrder.indexOf(nextSbp);
      return {
        ...state,
        currentPlayerIndex: nextIdx,
        sbpQueue: remaining,
      };
    }
    // Queue empty — advance to the next real turn.
    return advanceToNextRealTurn(state);
  }

  // === Main turn end. ===
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

  // 5-6p: drop into Special Build Phase before advancing to next real turn.
  if (state.players.length >= SBP_MIN_PLAYERS) {
    const turnHolder = state.turnHolderIndex ?? state.currentPlayerIndex;
    const queue = buildSbpQueue(state.playerOrder, turnHolder);
    if (queue.length > 0) {
      const firstSbp = queue[0]!;
      const firstIdx = state.playerOrder.indexOf(firstSbp);
      return {
        ...next,
        phase: 'specialBuildPhase',
        sbpQueue: queue,
        turnHolderIndex: turnHolder,
        currentPlayerIndex: firstIdx,
        // Clear pendingTrade so a stale offer doesn't bleed into SBP.
        pendingTrade: undefined,
        // Per-turn flags stay frozen for the real turn holder; they'll be
        // reset when we eventually advance to the next real turn.
      };
    }
  }

  return advanceToNextRealTurn(next);
}

function advanceToNextRealTurn(state: GameState): GameState {
  const currentTurnHolder = state.turnHolderIndex ?? state.currentPlayerIndex;
  const nextIdx = (currentTurnHolder + 1) % state.players.length;
  return {
    ...state,
    // Seafarers: clear per-turn movedShipThisTurn flag on all players. Doing
    // it on all players (not just the outgoing one) is defensive — the flag
    // should already be false for everyone else.
    players: state.players.map((p) => ({ ...p, movedShipThisTurn: false })),
    currentPlayerIndex: nextIdx,
    turnHolderIndex: nextIdx,
    phase: 'rollOrPlayKnight',
    hasRolledThisTurn: false,
    hasPlayedDevCardThisTurn: false,
    tradesProposedThisTurn: 0,
    lastRoll: null,
    pendingTrade: undefined,
    sbpQueue: undefined,
    // Fresh turn → fresh trade history. The AI uses this to detect
    // reverse trades within a turn; resetting at the turn boundary is
    // the right semantics.
    tradeResourcesThisTurn: undefined,
  };
}

function buildSbpQueue(playerOrder: PlayerId[], turnHolderIdx: number): PlayerId[] {
  const n = playerOrder.length;
  const out: PlayerId[] = [];
  for (let i = 1; i < n; i++) {
    out.push(playerOrder[(turnHolderIdx + i) % n]!);
  }
  return out;
}

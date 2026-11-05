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

// 5+ player rule (2022 paired-player edition): a paired turn has two actors.
// Player 1 is the seat at `turnHolderIndex` (rolls dice, full trade rights).
// Player 2 is `(turnHolderIndex + 3) % n` — the third seat to Player 1's left.
// The two roles take turns within the same paired turn: P1's main → P2's main
// → new paired turn (both markers shift one seat left).
//
// 3-4 player games don't use paired rules; turnHolderIndex always equals
// currentPlayerIndex outside of micro-steps like discard.
export function usesPairedRules(state: GameState): boolean {
  return state.players.length >= 5;
}

export function pairedPlayer2Index(state: GameState): number | undefined {
  if (!usesPairedRules(state)) return undefined;
  const p1 = state.turnHolderIndex ?? state.currentPlayerIndex;
  return (p1 + 3) % state.players.length;
}

// True when the currently acting seat is the paired-turn's Player 2.
// Used to gate player-to-player trades (P2 may only trade with the supply)
// without needing a separate phase value.
export function isPairedPlayer2(state: GameState): boolean {
  if (!usesPairedRules(state)) return false;
  const p1 = state.turnHolderIndex ?? state.currentPlayerIndex;
  return state.currentPlayerIndex !== p1;
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
  // Seafarers gold-pick phase: same pattern as discard — iterate turn order,
  // first player with a pending pick is the acting one.
  if (state.phase === 'chooseGoldResource' && state.goldChoiceState) {
    const pending = state.goldChoiceState.pending;
    for (const id of state.playerOrder) {
      if (pending[id] !== undefined) return id;
    }
  }
  // T&B Merchant Trains voting round: whoever's turn it is to bid (or, with
  // no majority, to assign their votes), then the player placing the wagon.
  if (state.phase === 'wagonVoting' && state.wagonVote) {
    const v = state.wagonVote;
    const list =
      v.stage === 'bid'
        ? v.order
        : v.order.filter((id) => {
            const b = v.bids[id];
            return !!b && b.sheep + b.wheat > 0;
          });
    const id = list[v.turn];
    if (id) return id;
  }
  if (state.phase === 'placeWagon' && state.pendingWagonPlacement) {
    return state.pendingWagonPlacement.placerId;
  }
  // T&B Catan Event Cards: the player whose answer the event waits on.
  if (state.phase === 'eventResolution') {
    const choice = state.eventCards?.pending?.choices[0];
    if (choice) return choice.playerId;
  }
  // Explorers & Pirates: the player placing their pirate ship.
  if (state.phase === 'epPlacePirate' && state.explorersPirates?.pendingPirate) {
    return state.explorersPirates.pendingPirate.playerId;
  }
  // T&B Fishing on Catan 'fishSwap' phase: the head of the swap queue.
  if (state.phase === 'fishSwap' && state.fishSwap?.queue.length) {
    return state.fishSwap.queue[0]!;
  }
  // Cities & Knights sub-phases answered by someone other than the active
  // player (or by a queue of players). Phase-keyed: these phases only exist
  // under C&K, so no expansion check is needed.
  const ck = citiesKnightsDecider(state);
  if (ck) return ck;
  return state.playerOrder[state.currentPlayerIndex]!;
}

// Who answers the current Cities & Knights sub-phase, or null when it's the
// active player (or the phase isn't a C&K one).
function citiesKnightsDecider(state: GameState): PlayerId | null {
  switch (state.phase) {
    case 'displacedKnightMove':
      return state.pendingKnightMove?.playerId ?? null;
    case 'progressCardDiscard': {
      const required = state.progressCardDiscardRequired ?? {};
      const n = state.playerOrder.length;
      for (let i = 0; i < n; i++) {
        const id = state.playerOrder[(state.currentPlayerIndex + i) % n]!;
        if ((required[id] ?? 0) > 0) return id;
      }
      return null;
    }
    case 'treasonRemoveKnight':
      return state.pendingTreason?.targetId ?? null;
    case 'treasonPlaceKnight':
      return state.pendingTreason?.attackerId ?? null;
    case 'commercialHarborOffer':
      return state.pendingCommercialHarbor?.targetId ?? null;
    case 'weddingGive':
      return state.pendingWedding?.remaining[0] ?? null;
    case 'aqueductPick':
      return state.pendingAqueduct?.[0] ?? null;
    case 'defenderTieDraw':
      return state.pendingDefenderTieDraw?.[0] ?? null;
    case 'choosePillage':
      return state.pendingPillage?.[0] ?? null;
    default:
      return null;
  }
}

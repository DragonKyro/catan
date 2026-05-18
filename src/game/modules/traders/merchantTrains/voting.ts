import type {
  GameState,
  PlayerId,
  EdgeId,
  SubmitWagonVoteAction,
  PlaceWagonAction,
  TradeWagon,
  WagonVoteBid,
  ResourceBank,
} from '../../../types';
import { RESOURCES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import {
  addResources,
  subtractResources,
  totalResources,
} from '../../../resources';
import { canPlaceWagon } from './placement';
import { handleEndTurn } from '../../../actions/turn';

// --- Submit a vote (each player exactly once per round) -------------------

export function handleSubmitWagonVote(
  state: GameState,
  action: SubmitWagonVoteAction,
): GameState {
  if (state.phase !== 'wagonVoting' || !state.wagonVote) {
    throw new Error(`Cannot submit a wagon vote in phase ${state.phase}`);
  }
  if (state.wagonVote.bids[action.playerId]) {
    throw new Error('You have already submitted a vote this round');
  }
  // Bid resources must be a subset of {sheep, wheat}, and the player must
  // actually have them. Abstain = no cards + null target.
  const cardsTotal = sumResources(action.cards);
  if (cardsTotal > 0) {
    for (const r of RESOURCES) {
      const n = action.cards[r] ?? 0;
      if (n > 0 && r !== 'sheep' && r !== 'wheat') {
        throw new Error('Wagon votes may only spend wool or wheat');
      }
    }
    const player = state.players.find((p) => p.id === action.playerId);
    if (!player) throw new Error('Unknown player');
    for (const r of RESOURCES) {
      const need = action.cards[r] ?? 0;
      if (need > 0 && player.resources[r] < need) {
        throw new Error(`Not enough ${r} to bid ${need}`);
      }
    }
    if (action.target === null) {
      throw new Error('Bids of ≥1 card must name a target edge');
    }
    if (!canPlaceWagon(state, action.target)) {
      throw new Error('Target edge is not a legal merchant-train extension');
    }
  }

  // Hold the bid in escrow — cards leave the player's hand to a temporary
  // "escrow" tracked on the bid itself. We refund / consume at resolution.
  let next = state;
  if (cardsTotal > 0) {
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      resources: subtractResources(p.resources, action.cards),
    }));
  }
  const bid: WagonVoteBid = {
    cards: { ...action.cards },
    target: action.target,
  };
  next = {
    ...next,
    wagonVote: {
      ...state.wagonVote,
      bids: { ...state.wagonVote.bids, [action.playerId]: bid },
    },
  };

  // All players have spoken? Resolve.
  if (Object.keys(next.wagonVote!.bids).length === state.players.length) {
    return resolveWagonVote(next);
  }
  return next;
}

// --- Resolve once everyone has bid -----------------------------------------

function resolveWagonVote(state: GameState): GameState {
  const vote = state.wagonVote;
  if (!vote) return state;

  // Refund all bids to the bank — bids are NOT kept by the supply per the
  // rulebook ("Return all bids to the supply"). Each card is gone from
  // the player's hand and from the game.
  const bankReturn: Partial<ResourceBank> = {};
  for (const bid of Object.values(vote.bids)) {
    for (const r of RESOURCES) {
      const n = bid.cards[r] ?? 0;
      if (n > 0) bankReturn[r] = (bankReturn[r] ?? 0) + n;
    }
  }
  let next: GameState = {
    ...state,
    bank: addResources(state.bank, bankReturn),
  };

  // Tally votes per location and per player.
  const locationVotes = new Map<EdgeId, number>();
  const playerVotes = new Map<PlayerId, number>();
  for (const [pid, bid] of Object.entries(vote.bids)) {
    const n = sumResources(bid.cards);
    if (n === 0 || !bid.target) continue;
    locationVotes.set(bid.target, (locationVotes.get(bid.target) ?? 0) + n);
    playerVotes.set(pid, (playerVotes.get(pid) ?? 0) + n);
  }

  // (1) Unique location winner → place there immediately.
  const topLocation = uniqueMax(locationVotes);
  if (topLocation) {
    next = placeWagonAndAdvance(next, topLocation);
    return next;
  }

  // (2) Unique player winner → that player chooses an edge.
  const topPlayer = uniqueMax(playerVotes);
  if (topPlayer) {
    return {
      ...next,
      phase: 'placeWagon',
      pendingWagonPlacement: { placerId: topPlayer },
      wagonVote: undefined,
    };
  }

  // (3) Fallback: acquirer (active builder) picks. They may have bid 0.
  return {
    ...next,
    phase: 'placeWagon',
    pendingWagonPlacement: { placerId: vote.acquirerId },
    wagonVote: undefined,
  };
}

// Return the key with strictly the highest value (no ties). Empty maps and
// ties both return null.
function uniqueMax<K>(m: Map<K, number>): K | null {
  let bestKey: K | null = null;
  let bestVal = -Infinity;
  let tied = false;
  for (const [k, v] of m) {
    if (v > bestVal) {
      bestKey = k;
      bestVal = v;
      tied = false;
    } else if (v === bestVal) {
      tied = true;
    }
  }
  if (tied) return null;
  return bestKey;
}

// --- placeWagon — both the auto-place path and the player-pick path --------

export function handlePlaceWagon(
  state: GameState,
  action: PlaceWagonAction,
): GameState {
  if (state.phase !== 'placeWagon' || !state.pendingWagonPlacement) {
    throw new Error(`Cannot place a wagon in phase ${state.phase}`);
  }
  if (action.playerId !== state.pendingWagonPlacement.placerId) {
    throw new Error('You are not the wagon placer');
  }
  if (!canPlaceWagon(state, action.edge)) {
    throw new Error('Invalid wagon placement');
  }
  return placeWagonAndAdvance(state, action.edge);
}

// Place the wagon on the named edge, decrement supply, clear the voting
// state, then advance to the next turn by invoking the base `handleEndTurn`.
// Shared between the auto-placement (clear vote winner) and the manual
// placement (placer picks) paths.
function placeWagonAndAdvance(state: GameState, edge: EdgeId): GameState {
  const wagons: TradeWagon[] = [...(state.wagons ?? []), { edge }];
  // Temporarily flip back to 'main' so the base endTurn handler's phase
  // guard passes. The voting/placement state is cleared in the same shape.
  const interim: GameState = {
    ...state,
    wagons,
    wagonSupply: Math.max(0, (state.wagonSupply ?? 0) - 1),
    phase: 'main',
    pendingWagonPlacement: undefined,
    wagonVote: undefined,
    builtThisTurn: false,
  };
  // The acquirer (acting player who built + ended) is still the current
  // player by index — they sat through voting/placement without the turn
  // advancing. handleEndTurn validates against playerOrder[currentPlayerIndex].
  const acquirerId = state.playerOrder[state.currentPlayerIndex]!;
  return handleEndTurn(interim, { type: 'endTurn', playerId: acquirerId });
}

// --- Shared helper ---------------------------------------------------------

function sumResources(cards: Partial<ResourceBank>): number {
  let n = 0;
  for (const r of RESOURCES) n += cards[r] ?? 0;
  return n;
}

// Force-resolve the vote even if not all players have bid yet. Used by the
// endTurn wrapper when the active player chooses to skip voting entirely
// (no human/AI submitted), and by force-finish in tests. Treats missing
// players as 0-card abstains.
export function forceResolveVoting(state: GameState): GameState {
  if (state.phase !== 'wagonVoting' || !state.wagonVote) return state;
  let next = state;
  for (const p of state.players) {
    if (!next.wagonVote!.bids[p.id]) {
      next = {
        ...next,
        wagonVote: {
          ...next.wagonVote!,
          bids: {
            ...next.wagonVote!.bids,
            [p.id]: { cards: {}, target: null },
          },
        },
      };
    }
  }
  return resolveWagonVote(next);
}

// Whether the vote-tally has settled to a unique location. Useful for UI
// to enable a "finish voting now" affordance even before every seat has
// dispatched.
export function votingHasUniqueLocationWinner(state: GameState): boolean {
  if (state.phase !== 'wagonVoting' || !state.wagonVote) return false;
  if (totalResources(state.bank) === 0) {
    /* unrelated — placeholder for future bank-empty guard */
  }
  const tally = new Map<EdgeId, number>();
  for (const bid of Object.values(state.wagonVote.bids)) {
    if (!bid.target) continue;
    const n = sumResources(bid.cards);
    if (n === 0) continue;
    tally.set(bid.target, (tally.get(bid.target) ?? 0) + n);
  }
  return uniqueMax(tally) !== null;
}

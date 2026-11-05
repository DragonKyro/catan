import type {
  GameState,
  PlayerId,
  SubmitWagonVoteAction,
  AssignWagonVotesAction,
  PlaceWagonAction,
  WagonPlacement,
  WagonVoteBid,
  WagonVoteState,
  WagonVoteResult,
  PendingWagonPlacement,
} from '../../../types';
import { RESOURCES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { addResources } from '../../../resources';
import { handleEndTurn } from '../../../actions/turn';
import { hasPlayerWon } from '../../../engine';
import {
  applyWagonPlacement,
  isLegalWagonPlacement,
  legalWagonPlacements,
  placementKey,
} from './trains';

// Merchant Trains voting round (2025 rulebook p. 13). At the end of a turn
// in which the active player built a building, starting with the active
// player and going clockwise, each player may lay any number of wool and/or
// wheat face up (1 card = 1 vote; later bidders see earlier bids). A player
// with the majority of all votes chooses where the wagon goes. Otherwise
// every bidder gives all of their votes to one location: (1) a location
// with the most votes gets the wagon; else (2) the player with the most
// votes chooses; else (3) the active player chooses, even with no bid. All
// bids go to the supply.
//
// "Majority" is read as an absolute majority (more than half of all votes):
// a plurality is what step 2 is for.

export function votesOf(bid: WagonVoteBid | undefined): number {
  return bid ? bid.sheep + bid.wheat : 0;
}

// Players who bid at least one card, in voting order.
export function voteBidders(vote: WagonVoteState): PlayerId[] {
  return vote.order.filter((pid) => votesOf(vote.bids[pid]) > 0);
}

// Whose turn it is in the voting round (bid or assign stage).
export function wagonVoteActor(vote: WagonVoteState): PlayerId | null {
  if (vote.stage === 'bid') return vote.order[vote.turn] ?? null;
  return voteBidders(vote)[vote.turn] ?? null;
}

// Open the voting round for the wagon the active player just earned.
export function openWagonVote(state: GameState, acquirerId: PlayerId): GameState {
  const start = state.playerOrder.indexOf(acquirerId);
  const order = state.playerOrder.map(
    (_, i) => state.playerOrder[(start + i) % state.playerOrder.length]!,
  );
  return {
    ...state,
    phase: 'wagonVoting',
    wagonVote: {
      acquirerId,
      order,
      stage: 'bid',
      turn: 0,
      bids: {},
      assignments: {},
    },
  };
}

// --- Bid stage --------------------------------------------------------------

export function handleSubmitWagonVote(
  state: GameState,
  action: SubmitWagonVoteAction,
): GameState {
  const vote = state.wagonVote;
  if (state.phase !== 'wagonVoting' || !vote) {
    throw new Error(`Cannot bid for a wagon in phase ${state.phase}`);
  }
  if (vote.stage !== 'bid') throw new Error('Bidding is over — assign your votes');
  if (wagonVoteActor(vote) !== action.playerId) {
    throw new Error('It is not your turn to bid');
  }
  for (const r of RESOURCES) {
    const n = action.cards[r] ?? 0;
    if (!Number.isInteger(n) || n < 0) throw new Error('Invalid bid');
    if (n > 0 && r !== 'sheep' && r !== 'wheat') {
      throw new Error('Wagon bids may only use wool and wheat');
    }
  }
  const bid: WagonVoteBid = {
    sheep: action.cards.sheep ?? 0,
    wheat: action.cards.wheat ?? 0,
  };
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) throw new Error('Unknown player');
  if (player.resources.sheep < bid.sheep || player.resources.wheat < bid.wheat) {
    throw new Error('You do not have those cards to bid');
  }
  // The cards are laid face up in front of the player: out of the hand now,
  // to the supply when the round ends.
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: {
      ...p.resources,
      sheep: p.resources.sheep - bid.sheep,
      wheat: p.resources.wheat - bid.wheat,
    },
  }));
  const nextVote: WagonVoteState = {
    ...vote,
    bids: { ...vote.bids, [action.playerId]: bid },
    turn: vote.turn + 1,
  };
  next = { ...next, wagonVote: nextVote };
  if (nextVote.turn < nextVote.order.length) return next;
  return resolveBids(next, nextVote);
}

function resolveBids(state: GameState, vote: WagonVoteState): GameState {
  const total = vote.order.reduce((n, pid) => n + votesOf(vote.bids[pid]), 0);
  if (total === 0) {
    return toPlacement(state, vote, { placerId: vote.acquirerId, reason: 'noVotes' });
  }
  const majority = vote.order.find((pid) => 2 * votesOf(vote.bids[pid]) > total);
  if (majority) {
    return toPlacement(state, vote, { placerId: majority, reason: 'majority' });
  }
  return { ...state, wagonVote: { ...vote, stage: 'assign', turn: 0 } };
}

// --- Assign stage -------------------------------------------------------------

export function handleAssignWagonVotes(
  state: GameState,
  action: AssignWagonVotesAction,
): GameState {
  const vote = state.wagonVote;
  if (state.phase !== 'wagonVoting' || !vote || vote.stage !== 'assign') {
    throw new Error('Votes are not being assigned now');
  }
  if (wagonVoteActor(vote) !== action.playerId) {
    throw new Error('It is not your turn to assign votes');
  }
  if (!isLegalWagonPlacement(state, action.location)) {
    throw new Error('A wagon cannot go there');
  }
  const nextVote: WagonVoteState = {
    ...vote,
    assignments: { ...vote.assignments, [action.playerId]: action.location },
    turn: vote.turn + 1,
  };
  const next: GameState = { ...state, wagonVote: nextVote };
  const bidders = voteBidders(nextVote);
  if (nextVote.turn < bidders.length) return next;

  // (1) A location with the most votes.
  const byLocation = new Map<string, { placement: WagonPlacement; votes: number }>();
  for (const pid of bidders) {
    const loc = nextVote.assignments[pid]!;
    const key = placementKey(loc);
    const cur = byLocation.get(key) ?? { placement: loc, votes: 0 };
    cur.votes += votesOf(nextVote.bids[pid]);
    byLocation.set(key, cur);
  }
  const topLocation = uniqueMax([...byLocation.values()], (x) => x.votes);
  if (topLocation) {
    return placeAndFinish(next, topLocation.placement, 'location', null);
  }
  // (2) The player with the most votes chooses; (3) else the active player.
  const topBidder = uniqueMax(bidders, (pid) => votesOf(nextVote.bids[pid]));
  if (topBidder) {
    return toPlacement(next, nextVote, { placerId: topBidder, reason: 'mostVotes' });
  }
  return toPlacement(next, nextVote, {
    placerId: nextVote.acquirerId,
    reason: 'activePlayer',
  });
}

function uniqueMax<T>(items: T[], score: (t: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  let tied = false;
  for (const it of items) {
    const s = score(it);
    if (s > bestScore) {
      best = it;
      bestScore = s;
      tied = false;
    } else if (s === bestScore) {
      tied = true;
    }
  }
  return tied ? null : best;
}

// --- Placement ------------------------------------------------------------------

function toPlacement(
  state: GameState,
  vote: WagonVoteState,
  pending: PendingWagonPlacement,
): GameState {
  return {
    ...state,
    phase: 'placeWagon',
    wagonVote: vote,
    pendingWagonPlacement: pending,
  };
}

export function handlePlaceWagon(
  state: GameState,
  action: PlaceWagonAction,
): GameState {
  if (state.phase !== 'placeWagon' || !state.pendingWagonPlacement) {
    throw new Error(`Cannot place a wagon in phase ${state.phase}`);
  }
  if (action.playerId !== state.pendingWagonPlacement.placerId) {
    throw new Error('You are not the one placing the wagon');
  }
  const options = legalWagonPlacements(state).filter((p) => p.edge === action.edge);
  const placement =
    action.train === undefined
      ? options[0]
      : options.find((p) => p.train === action.train);
  if (!placement) throw new Error('A wagon cannot go there');
  const reason = state.pendingWagonPlacement.reason ?? 'activePlayer';
  return placeAndFinish(
    state,
    placement,
    reason === 'majority' || reason === 'mostVotes' || reason === 'noVotes'
      ? reason
      : 'activePlayer',
    action.playerId,
  );
}

// Place the wagon, return every bid to the supply, record the result, then
// end the turn. The acquirer can win right here: the voting round is part
// of their turn ("12 or more VPs at any point during your turn").
export function placeAndFinish(
  state: GameState,
  placement: WagonPlacement,
  decidedBy: WagonVoteResult['decidedBy'],
  chooser: PlayerId | null,
): GameState {
  const vote = state.wagonVote;
  const acquirerId = vote?.acquirerId ?? state.playerOrder[state.currentPlayerIndex]!;
  let next = applyWagonPlacement(state, placement);
  if (vote) {
    let sheep = 0;
    let wheat = 0;
    for (const bid of Object.values(vote.bids)) {
      sheep += bid.sheep;
      wheat += bid.wheat;
    }
    next = { ...next, bank: addResources(next.bank, { sheep, wheat }) };
  }
  next = {
    ...next,
    phase: 'main',
    wagonVote: undefined,
    pendingWagonPlacement: undefined,
    builtThisTurn: false,
    lastWagonVote: {
      acquirerId,
      bids: vote?.bids ?? {},
      assignments: vote?.assignments ?? {},
      decidedBy,
      chooser,
      placement,
    },
  };
  if (hasPlayerWon(next, acquirerId)) {
    return { ...next, winner: acquirerId, phase: 'gameOver' };
  }
  return handleEndTurn(next, { type: 'endTurn', playerId: acquirerId });
}

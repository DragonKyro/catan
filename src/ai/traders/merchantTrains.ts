import type {
  Action,
  GameState,
  PlayerId,
  WagonPlacement,
} from '@/game/types';
import { calculateRouteLength } from '@/game/engine';
import {
  calculateLongestRoadHolder,
  calculateVictoryPoints,
} from '@/game/scoring/points';
import {
  applyWagonPlacement,
  legalWagonPlacements,
  placementFront,
  placementKey,
} from '@/game/modules/traders/merchantTrains/trains';
import { voteBidders, votesOf, wagonVoteActor } from '@/game/modules/traders/merchantTrains/voting';

// Merchant Trains AI. Every wagon location is judged by what it does to the
// table: VPs from buildings between two wagons, Longest Route swings (a
// wagon on a road edge counts as an extra road) and whether the train's new
// front lands on a building (the next wagon would put it between two). The
// AI bids when steering the wagon is worth a VP to it (or keeps one from a
// rival), assigns its votes to its best location, and places for itself
// when it's the chooser.

interface Impact {
  // Change in each player's VP (wagon VPs + Longest Route tile).
  vp: Map<PlayerId, number>;
  // Change in each player's route length.
  route: Map<PlayerId, number>;
  // Owner of the building the new front reaches, if any.
  frontOwner: PlayerId | null;
}

function vpWithRoute(
  state: GameState,
  pid: PlayerId,
  holder: PlayerId | null,
): number {
  const p = state.players.find((x) => x.id === pid)!;
  const base = calculateVictoryPoints(state, pid, false) - (p.hasLongestRoad ? 2 : 0);
  return base + (holder === pid ? 2 : 0);
}

function impactOf(state: GameState, placement: WagonPlacement): Impact {
  const after = applyWagonPlacement(state, placement);
  const lengthsAfter = new Map<PlayerId, number>();
  const route = new Map<PlayerId, number>();
  for (const p of state.players) {
    const len = calculateRouteLength(after, p.id);
    lengthsAfter.set(p.id, len);
    route.set(p.id, len - calculateRouteLength(state, p.id));
  }
  const holderBefore = state.noLongestRoad ? null : state.longestRoad?.holder ?? null;
  const holderAfter = state.noLongestRoad
    ? null
    : calculateLongestRoadHolder(after, lengthsAfter)?.holder ?? null;
  const vp = new Map<PlayerId, number>();
  for (const p of state.players) {
    vp.set(
      p.id,
      vpWithRoute(after, p.id, holderAfter) - vpWithRoute(state, p.id, holderBefore),
    );
  }
  const front = placementFront(state, placement);
  const frontOwner = front
    ? state.players.find((p) => p.settlements.includes(front) || p.cities.includes(front))?.id ?? null
    : null;
  return { vp, route, frontOwner };
}

// How good a placement is for `pid`: own gains minus the best rival's.
export function wagonPlacementScore(
  state: GameState,
  pid: PlayerId,
  placement: WagonPlacement,
): number {
  const imp = impactOf(state, placement);
  const own =
    imp.vp.get(pid)! +
    0.25 * Math.max(0, imp.route.get(pid)!) +
    (imp.frontOwner === pid ? 0.4 : 0);
  let rival = 0;
  for (const p of state.players) {
    if (p.id === pid) continue;
    const near =
      calculateVictoryPoints(state, p.id, false) + 2 >= state.settings.victoryPointsToWin;
    const gain = imp.vp.get(p.id)! + (imp.frontOwner === p.id ? 0.4 : 0);
    rival = Math.max(rival, gain * (near ? 1.3 : 1));
  }
  return own - 0.8 * rival;
}

function bestPlacementFor(
  state: GameState,
  pid: PlayerId,
  options: WagonPlacement[],
): { placement: WagonPlacement; score: number } | null {
  let best: { placement: WagonPlacement; score: number } | null = null;
  for (const p of options) {
    const score = wagonPlacementScore(state, pid, p);
    if (!best || score > best.score) best = { placement: p, score };
  }
  return best;
}

// Bid stage. The bid aims at an outright majority of the votes seen so far
// (later bidders can still outbid), spending wool before wheat, and only
// as much as steering the wagon is worth to us.
export function trySubmitWagonVote(state: GameState, playerId: PlayerId): Action | null {
  const vote = state.wagonVote;
  if (state.phase !== 'wagonVoting' || !vote || vote.stage !== 'bid') return null;
  if (wagonVoteActor(vote) !== playerId) return null;
  const pass: Action = { type: 'submitWagonVote', playerId, cards: {} };
  const options = legalWagonPlacements(state);
  const mine = bestPlacementFor(state, playerId, options);
  if (!mine) return pass;
  // Who decides if we stay out: the leading bidder so far, else the active
  // player (nobody bids → the active player chooses).
  let leader: PlayerId = vote.acquirerId;
  let leaderVotes = 0;
  let others = 0;
  for (const pid of vote.order) {
    const n = votesOf(vote.bids[pid]);
    others += n;
    if (n > leaderVotes) {
      leader = pid;
      leaderVotes = n;
    }
  }
  if (leader === playerId) return pass;
  const theirs = bestPlacementFor(state, leader, options)!;
  const stake = mine.score - wagonPlacementScore(state, playerId, theirs.placement);
  const iAmActive = playerId === vote.acquirerId;
  // The active player bids first, and nobody bidding means they choose
  // anyway, so they bid one card only to guard a valuable spot (a lone
  // 1-card rival then ties, and ties fall back to the active player).
  const need = iAmActive ? 1 : others + 1;
  if (stake < (iAmActive ? 1.2 : 0.9)) return pass;
  const budget = Math.min(3, Math.floor(stake * 2));
  const me = state.players.find((p) => p.id === playerId)!;
  if (need > budget || need > me.resources.sheep + me.resources.wheat) return pass;
  const sheep = Math.min(me.resources.sheep, need);
  const wheat = need - sheep;
  return { type: 'submitWagonVote', playerId, cards: { sheep, wheat } };
}

// Assign stage: back our best location, leaning toward one that already has
// votes so a single location can win outright.
export function tryAssignWagonVotes(state: GameState, playerId: PlayerId): Action | null {
  const vote = state.wagonVote;
  if (state.phase !== 'wagonVoting' || !vote || vote.stage !== 'assign') return null;
  if (wagonVoteActor(vote) !== playerId) return null;
  const options = legalWagonPlacements(state);
  if (options.length === 0) return null;
  const backed = new Set<string>();
  for (const pid of voteBidders(vote)) {
    const loc = vote.assignments[pid];
    if (loc) backed.add(placementKey(loc));
  }
  let best = options[0]!;
  let bestScore = -Infinity;
  for (const p of options) {
    const s = wagonPlacementScore(state, playerId, p) + (backed.has(placementKey(p)) ? 0.2 : 0);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return { type: 'assignWagonVotes', playerId, location: best };
}

// The chooser places the wagon where it's best for them.
export function tryPlaceWagon(state: GameState, playerId: PlayerId): Action | null {
  if (state.phase !== 'placeWagon' || !state.pendingWagonPlacement) return null;
  if (state.pendingWagonPlacement.placerId !== playerId) return null;
  const best = bestPlacementFor(state, playerId, legalWagonPlacements(state));
  if (!best) return null;
  return {
    type: 'placeWagon',
    playerId,
    edge: best.placement.edge,
    train: best.placement.train,
  };
}

// One AI answer for whichever Merchant Trains step is waiting on `playerId`.
export function chooseMerchantTrainsAction(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  if (state.phase === 'wagonVoting') {
    return state.wagonVote?.stage === 'assign'
      ? tryAssignWagonVotes(state, playerId)
      : trySubmitWagonVote(state, playerId);
  }
  if (state.phase === 'placeWagon') return tryPlaceWagon(state, playerId);
  return null;
}

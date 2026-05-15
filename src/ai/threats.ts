import type { GameState, PlayerId, Resource } from '@/game/types';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { calculateLongestRoad } from '@/game/scoring/longestRoad';

// How much of a near-win threat each opponent represents. The AI uses this
// to (a) avoid trading resources that would let a threat finish the game,
// (b) prefer trading with lower-ranked opponents, and (c) target the robber
// at hexes producing for threats.

export interface PlayerThreat {
  // Player's currently visible (non-hidden-VP-card) VP.
  visibleVp: number;
  // Visible VP + estimated hidden VP from dev cards still in their hand.
  // A human opponent would suspect a player who's bought a lot of cards
  // could be sitting on VP cards (~5/25 of the deck) — the AI mirrors
  // that wariness instead of pretending VP cards don't exist.
  perceivedVp: number;
  // True when perceived VP is within VP_WIN_THRESHOLD of the win — their
  // NEXT main turn could plausibly close out the game.
  closeToWin: boolean;
  // True when player is the field's leader by a meaningful margin OR
  // already close to winning. Used to refuse trades that hand the
  // would-be-winner resources, even before they're at 8+ VP. Without
  // this, the AI happily trades with a runaway leader until it's too
  // late to course-correct.
  isLeader: boolean;
  // True when player is poised to take Largest Army on their next play.
  closeToLargestArmy: boolean;
  // True when player is poised to take Longest Road on their next build.
  closeToLongestRoad: boolean;
  // Resources that would extend their lead — used to refuse trades that
  // hand them these. Always populated; empty for non-threats.
  dangerousResources: Set<Resource>;
}

// Within this many VP of the target, treat the opponent as a win-threat.
const VP_WIN_THRESHOLD = 2;
// Lead margin (over the second-place visible VP) that makes us treat
// someone as the leader-threat. Smaller than VP_WIN_THRESHOLD so we
// notice runaway leaders mid-game, not just on the brink of victory.
const LEAD_VP_MARGIN = 2;
// Hidden-VP estimate per dev card a player is sitting on (i.e. unplayed
// + bought-this-turn, excluding played knights). Base game has 5 VP cards
// in a 25-card deck → ~0.2 VP/card expected. Bumped slightly to err on
// the side of suspicion when an opponent has hoarded several cards.
const HIDDEN_VP_PER_DEV_CARD = 0.25;
// Number of knights at which an opponent is "close to" Largest Army even
// without already holding it.
const LA_NEAR_KNIGHTS = 2;
// Longest-road length at which an opponent is "close to" LR.
const LR_NEAR_LENGTH = 4;

export function assessThreats(state: GameState): Record<PlayerId, PlayerThreat> {
  const target = state.settings.victoryPointsToWin;
  const laHolder = state.largestArmy?.holder ?? null;
  const laSize = state.largestArmy?.size ?? 0;
  const lrHolder = state.longestRoad?.holder ?? null;
  const lrLength = state.longestRoad?.length ?? 0;

  // Compute every player's visible VP first so we can derive the leader
  // margin in a single pass.
  const visibleByPid: Record<PlayerId, number> = {};
  for (const p of state.players) {
    visibleByPid[p.id] = calculateVictoryPoints(state, p.id, false);
  }
  // Top two visible VPs across the table — used to spot the leader.
  let topVp = -Infinity;
  let secondVp = -Infinity;
  for (const v of Object.values(visibleByPid)) {
    if (v > topVp) {
      secondVp = topVp;
      topVp = v;
    } else if (v > secondVp) {
      secondVp = v;
    }
  }
  if (secondVp === -Infinity) secondVp = topVp;

  const out: Record<PlayerId, PlayerThreat> = {};
  for (const p of state.players) {
    const visibleVp = visibleByPid[p.id]!;
    // Hidden-VP estimate: cards a player has bought but not played
    // (excluding played knights, which we can see). VP cards are hidden
    // until used to declare a win, so the AI factors in the *expected*
    // hidden VP rather than ignoring them like a clueless opponent.
    const hiddenCardCount =
      p.devCards.unplayed.length + p.devCards.boughtThisTurn.length;
    const expectedHiddenVp = hiddenCardCount * HIDDEN_VP_PER_DEV_CARD;
    const perceivedVp = visibleVp + expectedHiddenVp;
    const closeToWin = perceivedVp >= target - VP_WIN_THRESHOLD;
    // Leader threat: visibly ahead of the rest of the field by
    // LEAD_VP_MARGIN. We compare to the SECOND-highest VP so the
    // current leader is flagged but the second-place player isn't
    // (no point treating yourself as a leader-threat).
    const isLeader =
      visibleVp >= topVp &&
      visibleVp >= secondVp + LEAD_VP_MARGIN;

    // LA threat: they hold it, OR they have enough knights to threaten taking
    // it next turn. If someone holds the bonus, they have to exceed that
    // count, so "near" means knights >= max(current holder count, threshold).
    const laFloor = laHolder ? laSize : LA_NEAR_KNIGHTS;
    const closeToLA =
      laHolder === p.id ||
      p.devCards.playedKnights >= laFloor;

    // LR threat: they hold it, or their current road length is within 1 of
    // claiming the bonus. We approximate via the engine-computed holder
    // length when they're the holder; otherwise we'd need to recompute, but
    // since the engine's recomputeDerived runs after every action, the
    // global longestRoad field reflects whichever player currently has the
    // longest run. For non-holders we fall back to road *count* (a proxy:
    // having lots of roads correlates with long runs).
    const closeToLR =
      lrHolder === p.id ||
      (lrHolder == null
        ? p.roads.length >= LR_NEAR_LENGTH
        : p.roads.length >= Math.max(LR_NEAR_LENGTH, lrLength - 1));

    const dangerousResources = new Set<Resource>();
    if (closeToWin) {
      // Any building resource is dangerous to give a win-threat.
      dangerousResources.add('ore');
      dangerousResources.add('wheat');
      dangerousResources.add('sheep');
      dangerousResources.add('wood');
      dangerousResources.add('brick');
    } else if (isLeader) {
      // Leader (but not yet on the brink): refuse VP-converting trades,
      // i.e. anything that lets them build a city or buy a dev card.
      // Wood/brick (road/settle ingredients) we still trade — denying
      // those entirely would leave the AI with no trade partners.
      dangerousResources.add('ore');
      dangerousResources.add('wheat');
    }
    if (closeToLargestArmyExceptHolder(p.id, laHolder, closeToLA)) {
      dangerousResources.add('sheep');
      dangerousResources.add('wheat');
      dangerousResources.add('ore');
    }
    if (closeToLongestRoadExceptHolder(p.id, lrHolder, closeToLR)) {
      dangerousResources.add('wood');
      dangerousResources.add('brick');
    }

    out[p.id] = {
      visibleVp,
      perceivedVp,
      closeToWin,
      isLeader,
      closeToLargestArmy: closeToLA,
      closeToLongestRoad: closeToLR,
      dangerousResources,
    };
  }
  return out;
}

// Helpers: when assessing "give them resources for X", we only flag the
// race if they don't already hold the bonus (no point denying resources
// for a bonus they already have).
function closeToLargestArmyExceptHolder(
  pid: PlayerId,
  holder: PlayerId | null,
  closeToLA: boolean,
): boolean {
  if (!closeToLA) return false;
  return holder !== pid;
}

function closeToLongestRoadExceptHolder(
  pid: PlayerId,
  holder: PlayerId | null,
  closeToLR: boolean,
): boolean {
  if (!closeToLR) return false;
  return holder !== pid;
}

// Is `them` a direct race rival of `me`? Two players are rivals when
// they're both meaningfully positioned in the same race:
//   - Largest Army: both have played 2+ knights (one bonus, two contenders).
//   - Longest Road: both have a contiguous chain ≥ 4 (one will claim it).
// Rivalries are *symmetric* and mean we should refuse to trade with them
// (helping a rival is doubly costly) and prefer them as steal targets.
const LA_RIVAL_KNIGHTS = 2;
const LR_RIVAL_LENGTH = 4;

export function isRival(
  state: GameState,
  meId: PlayerId,
  themId: PlayerId,
): boolean {
  if (meId === themId) return false;
  const me = state.players.find((p) => p.id === meId);
  const them = state.players.find((p) => p.id === themId);
  if (!me || !them) return false;
  // LA race: both have 2+ played knights.
  const laRivalry =
    me.devCards.playedKnights >= LA_RIVAL_KNIGHTS &&
    them.devCards.playedKnights >= LA_RIVAL_KNIGHTS;
  // LR race: both have contiguous chain ≥ 4. Computed fresh because we
  // need it per-player and the global longestRoad only tracks the holder.
  const meRoadLen = calculateLongestRoad(state, meId);
  const themRoadLen = calculateLongestRoad(state, themId);
  const lrRivalry = meRoadLen >= LR_RIVAL_LENGTH && themRoadLen >= LR_RIVAL_LENGTH;
  return laRivalry || lrRivalry;
}

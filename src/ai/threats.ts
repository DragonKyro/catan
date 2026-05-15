import type { GameState, PlayerId, Resource } from '@/game/types';
import { calculateVictoryPoints } from '@/game/scoring/points';

// How much of a near-win threat each opponent represents. The AI uses this
// to (a) avoid trading resources that would let a threat finish the game,
// (b) prefer trading with lower-ranked opponents, and (c) target the robber
// at hexes producing for threats.

export interface PlayerThreat {
  // Player's currently visible (non-hidden-VP-card) VP, used because that's
  // what other players can observe and react to. Hidden dev-card VP isn't
  // information the AI "should" have, but for an internal heuristic we lean
  // on visible VP only to mirror what a human opponent would react to.
  visibleVp: number;
  // True when player is within VP_WIN_THRESHOLD of the win — their NEXT main
  // turn could plausibly close out the game.
  closeToWin: boolean;
  // True when player is poised to take Largest Army on their next play.
  // ("Close" = either already holds the bonus, or has 2+ played knights and
  // is one knight away from passing the current holder.)
  closeToLargestArmy: boolean;
  // True when player is poised to take Longest Road on their next build.
  // ("Close" = either already holds, or longest contiguous road length is
  // within 1 of the threshold to claim the bonus.)
  closeToLongestRoad: boolean;
  // Resources that would extend their lead — used to refuse trades that
  // hand them these. Always populated; empty for non-threats.
  dangerousResources: Set<Resource>;
}

// Within this many VP of the target, treat the opponent as a win-threat.
const VP_WIN_THRESHOLD = 2;
// Number of knights at which an opponent is "close to" Largest Army even
// without already holding it (current LA requires 3, so 2 means one more).
const LA_NEAR_KNIGHTS = 2;
// Longest-road length at which an opponent is "close to" LR. Catan claims
// the bonus at length 5, so 4 means one more road segment.
const LR_NEAR_LENGTH = 4;

export function assessThreats(state: GameState): Record<PlayerId, PlayerThreat> {
  const target = state.settings.victoryPointsToWin;
  const laHolder = state.largestArmy?.holder ?? null;
  const laSize = state.largestArmy?.size ?? 0;
  const lrHolder = state.longestRoad?.holder ?? null;
  const lrLength = state.longestRoad?.length ?? 0;

  const out: Record<PlayerId, PlayerThreat> = {};
  for (const p of state.players) {
    // Visible VP only (no hidden VP cards). Mirrors what an external
    // observer can deduce, which is the right info to base trade decisions
    // on — using hidden info would be unfair and unrealistic.
    const visibleVp = calculateVictoryPoints(state, p.id, false);
    const closeToWin = visibleVp >= target - VP_WIN_THRESHOLD;

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
      // Cities (ore+wheat) and dev cards (sheep+wheat+ore) are the
      // fastest ways to convert resources to VP, so prioritize those.
      dangerousResources.add('ore');
      dangerousResources.add('wheat');
      dangerousResources.add('sheep');
      // Settlements need wood+brick+sheep+wheat. Don't give wood/brick
      // either if they could build a settlement.
      dangerousResources.add('wood');
      dangerousResources.add('brick');
    }
    if (closeToLargestArmyExceptHolder(p.id, laHolder, closeToLA)) {
      // Dev card ingredients.
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
      closeToWin,
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

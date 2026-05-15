import type {
  GameState,
  PlayerId,
  Action,
  Resource,
  VertexId,
  EdgeId,
} from '@/game/types';
import { RESOURCES, COSTS } from '@/game/types';
import { canPlaceSettlement, canConnectRoad } from '@/game/placement';
import { canAfford } from '@/game/resources';
import { getBankTradeRate } from '@/game/actions/trade';
import { vertexScore, reportNeeds, RESOURCE_WEIGHT } from './value';
import { tryProposeTrade, tryProposeFavorableTrade, shouldAcceptTrade } from './trade';
import { chooseDevCardPlay } from './devcard';
import { calculateLongestRoad } from '@/game/scoring/longestRoad';
import { chooseWinPlan } from './winPaths';

const ROAD_TARGET_THRESHOLD = 4.5; // min vertexScore to justify building a road for expansion
// Threshold dropped sharply when we're chasing Longest Road OR have nowhere
// else to score VP — late-game we need ANY road, not a perfect one.
const ROAD_TARGET_THRESHOLD_LR = 1.5;
const LR_CLAIM_LENGTH = 5;

export interface MainPhaseOptions {
  // Whether the AI may play a dev card this step. Off during SBP.
  allowDevCardPlay?: boolean;
  // Whether the AI may propose a player-to-player trade. Off during SBP.
  allowPlayerTrade?: boolean;
}

export function chooseMainPhaseAction(
  state: GameState,
  playerId: PlayerId,
  opts: MainPhaseOptions = {},
): Action | null {
  const allowDevCardPlay = opts.allowDevCardPlay ?? true;
  const allowPlayerTrade = opts.allowPlayerTrade ?? true;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  // Handle any pending trade involving us before doing anything else:
  // - If we proposed it, cancel (the driver's wait already gave humans time).
  // - If it's a counter to our trade (or any trade we're now the current
  //   player on), accept if beneficial, otherwise cancel.
  if (state.pendingTrade) {
    if (state.pendingTrade.proposerId === playerId) {
      return { type: 'cancelTrade', playerId };
    }
    if (shouldAcceptTrade(state, playerId)) {
      return { type: 'acceptTrade', playerId };
    }
    return { type: 'cancelTrade', playerId };
  }

  // 0) Play a dev card if it would clearly help (knight to clear robber etc.)
  if (allowDevCardPlay) {
    const cardPlay = chooseDevCardPlay(state, playerId);
    if (cardPlay) return cardPlay;
  }

  // 1) BUILD CITY
  if (canAfford(player.resources, COSTS.city) && player.cities.length < 4) {
    let bestVid: VertexId | null = null;
    let bestScore = -Infinity;
    for (const vid of player.settlements) {
      const s = vertexScore(state, vid, playerId);
      if (s > bestScore) {
        bestScore = s;
        bestVid = vid;
      }
    }
    if (bestVid) return { type: 'buildCity', playerId, vertex: bestVid };
  }

  // 2) BUILD SETTLEMENT
  if (
    canAfford(player.resources, COSTS.settlement) &&
    player.settlements.length < 5
  ) {
    let bestVid: VertexId | null = null;
    let bestScore = -Infinity;
    for (const vid of state.board.vertexIds) {
      if (!canPlaceSettlement(state, playerId, vid)) continue;
      const s = vertexScore(state, vid, playerId);
      if (s > bestScore) {
        bestScore = s;
        bestVid = vid;
      }
    }
    if (bestVid) return { type: 'buildSettlement', playerId, vertex: bestVid };
  }

  // 3) BUY DEV CARD — but only once we're not actively expanding.
  //    Watching AI games it became clear they were buying dev cards
  //    while sitting on settle-able vertices and unbuilt roads. That's
  //    bad strategy: dev cards are slow VP (no production), expansion
  //    compounds. Gates, in order:
  //      a) saveForCity: hand small AND city is the active goal — wait
  //         to convert wheat/ore into actual VP first.
  //      b) earlyGame: turn < 5 with fewer than 2 settlements placed
  //         (i.e. just past initial placement). Building > dev card.
  //      c) hasOpenSettleSpot: already-reachable open spot AND we have
  //         most of a settlement (≥3/4 of cost) — finish the settle.
  //      d) couldRoadToSettleSpot: no reachable spot, but a single
  //         road would unlock one AND we have wood+brick. Build that
  //         road first instead of spending sheep/wheat/ore on a card.
  if (
    canAfford(player.resources, COSTS.devCard) &&
    state.devCardDeck.length > 0
  ) {
    const needs = reportNeeds(state, playerId);
    let handSize = 0;
    for (const r of RESOURCES) handSize += player.resources[r];
    const saveForCity = needs.goal === 'city' && handSize <= 5;
    const placedSettlesAndCities = player.settlements.length + player.cities.length;
    const earlyGame = placedSettlesAndCities < 2;
    const settleCostHave =
      Math.min(1, player.resources.wood) +
      Math.min(1, player.resources.brick) +
      Math.min(1, player.resources.sheep) +
      Math.min(1, player.resources.wheat);
    const openSpots = countOpenSettlementSpots(state, playerId);
    const hasOpenSettleSpot = openSpots > 0 && settleCostHave >= 3;
    const couldRoadToSettleSpot =
      openSpots === 0 &&
      player.resources.wood >= 1 &&
      player.resources.brick >= 1 &&
      countOneRoadSettleSpots(state, playerId) > 0;
    if (
      !saveForCity &&
      !earlyGame &&
      !hasOpenSettleSpot &&
      !couldRoadToSettleSpot
    ) {
      return { type: 'buyDevCard', playerId };
    }
  }

  // 4) BUILD ROAD
  //    Two reasons to build:
  //      (a) Unlock a new high-value settlement spot we can't currently reach.
  //      (b) Pursue Longest Road (+2 VP). Reachable when:
  //          - no current LR holder AND our chain is within 1-2 of length 5
  //          - someone else holds, and our chain is within 1-2 of theirs
  //    When (b) applies we drop the "must unlock a great vertex" threshold
  //    sharply — any extension that grows our chain has direct VP value.
  if (
    canAfford(player.resources, COSTS.road) &&
    player.roads.length < 15
  ) {
    const openSpots = countOpenSettlementSpots(state, playerId);
    const myRoadLen = calculateLongestRoad(state, playerId);
    const lrHolder = state.longestRoad?.holder ?? null;
    const lrLength = state.longestRoad?.length ?? 0;
    // Length at which we'd CLAIM Longest Road: 5 if no one has it, else
    // current holder's length + 1.
    let lrClaimTarget = 0;
    if (lrHolder === null) lrClaimTarget = LR_CLAIM_LENGTH;
    else if (lrHolder !== playerId) lrClaimTarget = lrLength + 1;
    // Within 2 of claiming → pursue. Defending (already hold) doesn't fire
    // here because we'd need a separate "extend our lead" branch; that's a
    // smaller win and saved for future tuning.
    const pursuingLR = lrClaimTarget > 0 && myRoadLen + 2 >= lrClaimTarget;

    // Consult the win plan: if it says we need more settlements, we're
    // willing to accept a lower-quality unlock to keep progressing
    // (avoids the "stuck at 9 VP, can't reach any new vertex" failure mode).
    const winPlan = chooseWinPlan(state, playerId);
    const planNeedsSettlements = winPlan.gap.newSettlementsNeeded > 0;

    // Threshold tiers:
    //   - LR pursuit: very low (any extension scores ~2 VP value)
    //   - Plan wants more settlements: stricter than before to stop
    //     "useless roads toward each other" — was 2.5, now 3.5. A
    //     2.5-pip endpoint is barely worth the road; 3.5 weeds out the
    //     marginal extensions while still letting good plans through.
    //   - Otherwise: original strict threshold
    let threshold = ROAD_TARGET_THRESHOLD;
    if (pursuingLR) threshold = ROAD_TARGET_THRESHOLD_LR;
    else if (planNeedsSettlements) threshold = 3.5;

    if (openSpots === 0 || pursuingLR) {
      let bestEid: EdgeId | null = null;
      let bestVertexScore = -Infinity;
      for (const eid of state.board.edgeIds) {
        if (!canConnectRoad(state, playerId, eid)) continue;
        const edge = state.board.edges[eid]!;
        let endpointBest = -Infinity;
        let endpointBestVid: VertexId | null = null;
        for (const v of edge.vertices) {
          let blocked = false;
          const vertex = state.board.vertices[v]!;
          for (const p of state.players) {
            if (p.settlements.includes(v) || p.cities.includes(v)) {
              blocked = true;
              break;
            }
            for (const n of vertex.neighborVertices) {
              if (p.settlements.includes(n) || p.cities.includes(n)) {
                blocked = true;
                break;
              }
            }
            if (blocked) break;
          }
          if (blocked) continue;
          const s = vertexScore(state, v, playerId);
          if (s > endpointBest) {
            endpointBest = s;
            endpointBestVid = v;
          }
        }
        // Contested-endpoint penalty: if an enemy road already touches
        // the new endpoint, the spot is contested — they can settle it
        // (cutting us off) before we can. Skip these unless we're LR-
        // pursuing (where the road has direct VP value regardless).
        let contestedPenalty = 0;
        if (!pursuingLR && endpointBestVid !== null) {
          const ev = state.board.vertices[endpointBestVid]!;
          let enemyRoadsAtEndpoint = 0;
          for (const neid of ev.edges) {
            if (neid === eid) continue;
            for (const p of state.players) {
              if (p.id === playerId) continue;
              if (p.roads.includes(neid)) enemyRoadsAtEndpoint++;
            }
          }
          if (enemyRoadsAtEndpoint > 0) contestedPenalty = 2 * enemyRoadsAtEndpoint;
        }
        // LR-pursuit bias: any road extension is worth ~LR's 2 VP, so
        // floor the score at a moderate value when LR is the target.
        const finalScore = pursuingLR
          ? Math.max(endpointBest, ROAD_TARGET_THRESHOLD_LR + 0.5)
          : endpointBest - contestedPenalty;
        if (finalScore > bestVertexScore) {
          bestVertexScore = finalScore;
          bestEid = eid;
        }
      }
      if (bestEid && bestVertexScore >= threshold) {
        return { type: 'buildRoad', playerId, edge: bestEid };
      }
    }
  }

  // 5a) FAVORABLE PLAYER TRADE — only fires when a clearly mutually-good
  //     2:1 swap exists with a non-threat opponent. Preferred over bank
  //     trade because it's higher value (2:1 player vs 4:1/3:1 bank) and
  //     reduces "AI just bank-trades constantly" feel.
  if (allowPlayerTrade) {
    const favorable = tryProposeFavorableTrade(state, playerId);
    if (favorable) return favorable;
  }

  // 5b) BANK TRADE to enable an unlock
  const tradeAction = tryBankTrade(state, playerId);
  if (tradeAction) return tradeAction;

  // 6) PROPOSE TRADE to other players — broader search (1:1 included).
  if (allowPlayerTrade) {
    const proposal = tryProposeTrade(state, playerId);
    if (proposal) return proposal;
  }

  // 7) End turn
  return null;
}

// Counts vertices reachable through this player's existing road network
// where they could legally place a settlement *right now*. Used to gate
// further road-building — if any spot is already available we shouldn't
// keep spending wood/brick on roads.
function countOpenSettlementSpots(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  const reachable = new Set<VertexId>();
  for (const eid of player.roads) {
    const edge = state.board.edges[eid];
    if (!edge) continue;
    for (const v of edge.vertices) reachable.add(v);
  }
  let count = 0;
  for (const v of reachable) {
    if (canPlaceSettlement(state, playerId, v)) count++;
  }
  return count;
}

// Vertices one road-extension away from our current network where a
// settlement could legally be placed. Used to know "should I save sheep/
// wheat/ore to push for a settle, instead of spending them on a dev card?"
function countOneRoadSettleSpots(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  let count = 0;
  const seen = new Set<VertexId>();
  for (const eid of state.board.edgeIds) {
    if (!canConnectRoad(state, playerId, eid)) continue;
    const edge = state.board.edges[eid]!;
    for (const v of edge.vertices) {
      if (seen.has(v)) continue;
      seen.add(v);
      if (canPlaceSettlement(state, playerId, v)) count++;
    }
  }
  return count;
}

function tryBankTrade(state: GameState, playerId: PlayerId): Action | null {
  const player = state.players.find((p) => p.id === playerId)!;
  const needs = reportNeeds(state, playerId);
  let handSize = 0;
  for (const r of RESOURCES) handSize += player.resources[r];

  // Bank-trade trigger rules. The OLD rule (handSize >= 5) caused
  // back-and-forth churn: AI with 4 brick would trade for wood, then trade
  // back to brick the next turn. Now:
  //  1) Goal-driven: we have a concrete build goal AND a specific shortfall.
  //  2) Discard-imminent: handSize >= 8 (next 7 would force a discard).
  // The "general balance" trigger is gone — every trade must clearly help.
  const wantingForGoal = needs.goal !== 'none';
  const discardImminent = handSize >= 8;
  if (!wantingForGoal && !discardImminent) return null;

  // Pick the resource we want most. Goal mode targets the needed resource;
  // discard mode targets a resource we have *very few* of (diversifying,
  // not re-shuffling). Skip resources the bank can't supply.
  let wantRes: Resource | null = null;
  let wantScore = -Infinity;
  for (const r of RESOURCES) {
    if (state.bank[r] <= 0) continue;
    if (wantingForGoal) {
      // Only consider resources that are actually short for our goal.
      const shortfall = needs.byResource[r] ?? 0;
      if (shortfall <= 0) continue;
      const score = shortfall * 1.5;
      if (score > wantScore) {
        wantScore = score;
        wantRes = r;
      }
    } else {
      // Discard-imminent fallback: receive a resource we have <= 1 of.
      // This way we genuinely diversify rather than swap back the same
      // way we swapped last time.
      if (player.resources[r] > 1) continue;
      const score = RESOURCE_WEIGHT[r] * (1 / (1 + player.resources[r]));
      if (score > wantScore) {
        wantScore = score;
        wantRes = r;
      }
    }
  }
  if (!wantRes) return null;

  // Find the resource we have the most "spare" of (above the goal need) and
  // can afford at least one bank conversion of. Never give up a resource
  // we have a shortfall for in our active goal.
  let bestGive: Resource | null = null;
  let bestSpare = -Infinity;
  let bestRate = 4;
  for (const r of RESOURCES) {
    if (r === wantRes) continue;
    // Don't burn a resource we need for our current goal — that would
    // undo progress.
    if ((needs.byResource[r] ?? 0) > 0) continue;
    const rate = getBankTradeRate(state, playerId, r);
    const need = needs.byResource[r] ?? 0;
    const spare = player.resources[r] - need;
    if (spare < rate) continue;
    // Score: more spare beats less; lower rate (ports) is a tie-breaker so a
    // 2:1 trade is preferred over an equivalent 4:1.
    const score = spare * 10 - rate;
    if (score > bestSpare * 10 - bestRate) {
      bestSpare = spare;
      bestRate = rate;
      bestGive = r;
    }
  }
  if (!bestGive) return null;
  // Avoid pure value-loss trades when we're not pressured: don't give an
  // 8-pip wheat for sheep just because we technically can.
  if (!discardImminent) {
    const delta = RESOURCE_WEIGHT[wantRes] - RESOURCE_WEIGHT[bestGive] * bestRate;
    if (delta + (needs.byResource[wantRes] ?? 0) * 0.7 < -1.5) return null;
  }
  return { type: 'bankTrade', playerId, give: bestGive, receive: wantRes };
}

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
import { calculateVictoryPoints } from '@/game/scoring/points';
import { chooseWinPlan } from './winPaths';
import { tryBuildShip } from './seafarers/ships';
import { tryBuildBridge } from './traders/bridges';
import { tryFishSpend, tryPassBoot } from './traders/fish';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import { tryAttackPirateFleet } from './seafarers/pirateFleet';
import { tryBuildWonder } from './seafarers/wonders';
import { SEAFARERS_EXPANSION_ID } from '@/game/modules/seafarers/constants';

const ROAD_TARGET_THRESHOLD = 4.5; // min vertexScore to justify building a road for expansion
// Threshold dropped sharply when we're chasing Longest Road OR have nowhere
// else to score VP — late-game we need ANY road, not a perfect one.
const ROAD_TARGET_THRESHOLD_LR = 1.5;
const LR_CLAIM_LENGTH = 5;

export interface MainPhaseOptions {
  // Whether the AI may play a dev card this step. Defaults to true. Both
  // Player 1 and Player 2 may play one dev card per paired turn.
  allowDevCardPlay?: boolean;
  // Whether the AI may propose a player-to-player trade. Defaults to true.
  // Turned off when the AI is acting as paired-rule Player 2.
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

  // 0.5) Pirate Islands: attack the fleet whenever we have an adjacent ship
  //      and haven't attacked this turn. Costs nothing and is +2 VP on the
  //      killing blow, so it always precedes resource-spending steps.
  if (state.settings.expansions.includes(SEAFARERS_EXPANSION_ID)) {
    const attack = tryAttackPirateFleet(state, playerId);
    if (attack) return attack;
  }

  // 0.75) Wonders of Catan: completing a wonder is an instant win, so if
  //       this build would push a wonder to its max level, do it before
  //       anything else. The normal-level pass runs further down in the
  //       priority tree.
  if (state.settings.expansions.includes(SEAFARERS_EXPANSION_ID)) {
    const win = tryBuildWonder(state, playerId, { instantWinOnly: true });
    if (win) return win;
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

  // 2.5) BUILD SHIP (Seafarers only). Ships sit between settlement and road
  //      in priority: like roads they extend the network, but the chip-VP
  //      payoff at outer-island chip vertices is direct VP and ships cost
  //      wood+sheep — different resources from roads, so the two compete
  //      for hand budget less than they look like they would. The
  //      heuristic gates on actual progress (no loops, no opp-blocked
  //      endpoints) and a threshold so we don't spam idle ships.
  if (state.settings.expansions.includes(SEAFARERS_EXPANSION_ID)) {
    const shipAction = tryBuildShip(state, playerId);
    if (shipAction) return shipAction;
  }

  // 2.6) BUILD BRIDGE (Traders & Barbarians / Rivers of Catan). Bridges
  //      sit between settlement and road for the same reason ships do:
  //      they extend the network across river edges that roads can't
  //      occupy, and they pay +3 gold on build which feeds Wealthiest
  //      Catanian / spending. Same cost as a road but with a higher
  //      payoff, so the threshold is a notch lower than a road's.
  if (state.settings.expansions.includes(TRADERS_EXPANSION_ID)) {
    const bridgeAction = tryBuildBridge(state, playerId);
    if (bridgeAction) return bridgeAction;
    // 2.7) FISH SPEND. Drive off the robber if it's on us; take a needed
    //      resource if we have one in reach. Pass the boot if we hold it
    //      and someone qualifies. Both are pre-build because they shift
    //      whether the rest of the priority tree can act (e.g. spending
    //      4 fish to take wheat may unlock a settlement on this very turn).
    const fish = tryFishSpend(state, playerId);
    if (fish) return fish;
    const boot = tryPassBoot(state, playerId);
    if (boot) return boot;
  }

  // 3) BUILD ROAD
  //    Roads come BEFORE dev cards. Resource-efficiency principle: if we
  //    have road materials AND the road would extend our settle-network,
  //    that's a path toward direct VP (settle → 1 VP + production). A
  //    dev card is expected ~0.2 VP (5 VP cards / 25-card deck) and
  //    consumes scarcer resources (sheep+wheat+ore). Always cheaper to
  //    spend idle wood+brick on roads than to fish for VP cards.
  //
  //    Quality threshold + station-skip + contested-endpoint filters
  //    below ensure we only build roads that actually contribute — if
  //    nothing meets the bar, we fall through to dev card / trade.
  if (
    canAfford(player.resources, COSTS.road) &&
    player.roads.length < 15
  ) {
    const openSpots = countOpenSettlementSpots(state, playerId);
    const myRoadLen = calculateLongestRoad(state, playerId);
    const lrHolder = state.longestRoad?.holder ?? null;
    const lrLength = state.longestRoad?.length ?? 0;
    let lrClaimTarget = 0;
    if (lrHolder === null) lrClaimTarget = LR_CLAIM_LENGTH;
    else if (lrHolder !== playerId) lrClaimTarget = lrLength + 1;
    const pursuingLR = lrClaimTarget > 0 && myRoadLen + 2 >= lrClaimTarget;
    // Station roads (toward an unsettle-able vertex) are only allowed
    // when LR claim is imminent — within 1 of the target length. At 2+
    // away, a station road doesn't reliably extend our chain to claim,
    // so it's likely a useless build. (Earlier rule allowed stations
    // throughout LR pursuit; that produced the dead-end roads we kept
    // seeing in screenshots.)
    const stationAllowed = lrClaimTarget > 0 && myRoadLen + 1 >= lrClaimTarget;

    // Consult the win plan: if it says we need more settlements, we're
    // willing to accept a lower-quality unlock.
    const winPlan = chooseWinPlan(state, playerId);
    const planNeedsSettlements = winPlan.gap.newSettlementsNeeded > 0;

    // Catch-up boost: if we're significantly behind the leader, we can't
    // afford to be picky. Drop the road threshold an extra notch so we
    // grab mid-tier expansion opportunities instead of stalling at 3 VP.
    const myVp = calculateVictoryPoints(state, playerId, false);
    let leaderVp = 0;
    for (const op of state.players) {
      if (op.id === playerId) continue;
      const v = calculateVictoryPoints(state, op.id, false);
      if (v > leaderVp) leaderVp = v;
    }
    const fallingBehind = leaderVp - myVp >= 3;

    // Hand-burn signal: discard at 8, force-burn threshold at 6 so the
    // AI spends idle wood+brick on a road instead of fishing for dev
    // cards / risking a 7. Requires actual road materials (>=1 wood,
    // >=1 brick) AND a fat hand — otherwise we'd lower the bar even
    // when we couldn't follow through.
    let handSize = 0;
    for (const r of RESOURCES) handSize += player.resources[r];
    const burnHand = handSize >= 6 && player.resources.wood >= 1 && player.resources.brick >= 1;

    // Threshold tiers:
    //   - LR pursuit: very low (any extension is worth ~2 VP)
    //   - Plan wants settlements: 3.5 (weed out marginal extensions)
    //   - Otherwise: original strict 4.5
    let threshold = ROAD_TARGET_THRESHOLD;
    if (pursuingLR) threshold = ROAD_TARGET_THRESHOLD_LR;
    else if (planNeedsSettlements) threshold = 3.5;
    if (fallingBehind) threshold = Math.max(2.0, threshold - 1.0);
    if (burnHand) threshold = Math.max(1.5, threshold - 1.5);
    // `openSpots` no longer gates whether we try at all — we always
    // evaluate candidates and let the quality threshold filter. That
    // way idle wood/brick gets spent on the best available road if
    // one is worth building.
    void openSpots;

    let bestEid: EdgeId | null = null;
    let bestScore = -Infinity;

    for (const eid of state.board.edgeIds) {
      if (!canConnectRoad(state, playerId, eid)) continue;
      const edge = state.board.edges[eid]!;
      // Identify the NEW endpoint — the one not already in our network.
      // If BOTH endpoints are in our network the road just closes a
      // loop (no expansion value, ~0 LR value). Skip.
      let newVid: VertexId | null = null;
      for (const v of edge.vertices) {
        if (!isOurVertex(state, playerId, v, eid)) {
          newVid = v;
          break;
        }
      }
      if (newVid === null) continue;
      // If the new endpoint is already settled (by us or anyone), this
      // road plugs into a dead-end: no settle target, and an opponent's
      // settle on it also BREAKS any longest-road chain we'd hope to
      // extend through it. Pure waste.
      const newVertex = state.board.vertices[newVid]!;
      const settledHere = state.players.some(
        (p) => p.settlements.includes(newVid!) || p.cities.includes(newVid!),
      );
      if (settledHere) continue;
      // Settlement-eligibility at the new endpoint. If we can't settle
      // here (adjacent to someone else's settle), the road is a way-
      // station — only useful if we're imminently claiming LR. Otherwise
      // it's the "roads in all directions" failure mode. `stationAllowed`
      // requires us to be within 1 of LR claim length, NOT just within
      // 2 (which had been letting station roads through too early).
      let blockedAdjacent = false;
      for (const n of newVertex.neighborVertices) {
        for (const p of state.players) {
          if (p.settlements.includes(n) || p.cities.includes(n)) {
            blockedAdjacent = true;
            break;
          }
        }
        if (blockedAdjacent) break;
      }
      if (blockedAdjacent && !stationAllowed) continue;

      // Count enemy roads on this vertex's OTHER edges. Heavy enemy
      // presence here means (a) opponents are racing for the same
      // settle spot, and (b) extending further would only deepen the
      // contested area. Hard skip when 2+ enemy roads (unless we're
      // pursuing LR — there the road itself, not the future settle,
      // is the reward).
      let enemyRoadsAtNew = 0;
      for (const ne of newVertex.edges) {
        if (ne === eid) continue;
        for (const p of state.players) {
          if (p.id === playerId) continue;
          if (p.roads.includes(ne)) enemyRoadsAtNew++;
        }
      }
      if (!pursuingLR && enemyRoadsAtNew >= 2) continue;

      // Dead-end check: if every OTHER edge of newVid leads to an
      // already-settled vertex, then even with another road we can't
      // unlock anything. That makes this road a true dead-end. (We
      // still allow it during LR pursuit since chain length itself is
      // valuable.)
      if (!pursuingLR) {
        let hasFutureExit = false;
        for (const ne of newVertex.edges) {
          if (ne === eid) continue;
          const nextEdge = state.board.edges[ne];
          if (!nextEdge) continue;
          for (const nv of nextEdge.vertices) {
            if (nv === newVid) continue;
            const farSettled = state.players.some(
              (p) => p.settlements.includes(nv) || p.cities.includes(nv),
            );
            if (!farSettled) {
              hasFutureExit = true;
              break;
            }
          }
          if (hasFutureExit) break;
        }
        if (!hasFutureExit) continue;
      }

      const base = vertexScore(state, newVid, playerId);
      const contestedPenalty = pursuingLR ? 0 : 2 * enemyRoadsAtNew;
      const finalScore = pursuingLR
        ? Math.max(base - (blockedAdjacent ? 2.5 : 0), ROAD_TARGET_THRESHOLD_LR + 0.5)
        : base - contestedPenalty;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestEid = eid;
      }
    }
    if (bestEid && bestScore >= threshold) {
      return { type: 'buildRoad', playerId, edge: bestEid };
    }
  }

  // 3.5) BUILD WONDER (normal level). Each level is a guaranteed +1 VP
  //      and locks the wonder to us so opponents can't race the prereq.
  //      Lower than direct expansion (city / settle / road→settle) because
  //      wonders don't add production, but higher than dev cards because
  //      they're deterministic VP rather than ~0.2 expected VP per draw.
  if (state.settings.expansions.includes(SEAFARERS_EXPANSION_ID)) {
    const w = tryBuildWonder(state, playerId);
    if (w) return w;
  }

  // 4) BUY DEV CARD — fallback when no quality road was buildable AND
  //    we're not actively expanding via settle/city. Dev cards are
  //    slow VP (no production); we only reach them when the direct-VP
  //    paths (city / settle / road→settle) have been exhausted this
  //    turn. Still gate against the "1 card from a city" trap: buying
  //    a dev card now would spend wheat+ore we need for that city.
  if (
    canAfford(player.resources, COSTS.devCard) &&
    state.devCardDeck.length > 0
  ) {
    const needs = reportNeeds(state, playerId);
    let handSize = 0;
    for (const r of RESOURCES) handSize += player.resources[r];
    const cityShortfall =
      (needs.byResource.wheat ?? 0) + (needs.byResource.ore ?? 0);
    const saveForCity =
      needs.goal === 'city' &&
      player.settlements.length > 0 &&
      cityShortfall <= 2 &&
      handSize <= 8;
    const placedSettlesAndCities = player.settlements.length + player.cities.length;
    const earlyGame = placedSettlesAndCities < 2;
    if (!saveForCity && !earlyGame) {
      return { type: 'buyDevCard', playerId };
    }
  }

  // 5) PLAYER TRADES BEFORE BANK. The bank is always 4:1 (or 3:1 / 2:1 by
  //    port — still worse than most player trades). Trading with players
  //    is strictly higher trade-efficiency, so try player trades first
  //    and only fall back to the bank when no player trade was findable.
  //    5a: favorable (2:1) — try first, mutually-good swap with non-threats.
  //    5b: broader (1:1, 2:1, creative multi-resource) — wider net.
  if (allowPlayerTrade) {
    const favorable = tryProposeFavorableTrade(state, playerId);
    if (favorable) return favorable;
    const proposal = tryProposeTrade(state, playerId);
    if (proposal) return proposal;
  }

  // 5c) BANK TRADE — last resort. tradesProposedThisTurn caps player
  //     trades at 2 per turn, so we still reach here once we've exhausted
  //     our player-trade budget.
  const tradeAction = tryBankTrade(state, playerId);
  if (tradeAction) return tradeAction;

  // 6) End turn
  return null;
}

// Is `v` already part of `playerId`'s road network? True if they have a
// settlement / city on it, or one of their roads touches it (other than
// the candidate edge `excludeEid`, which we're about to consider).
function isOurVertex(
  state: GameState,
  playerId: PlayerId,
  v: VertexId,
  excludeEid: EdgeId,
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  if (player.settlements.includes(v) || player.cities.includes(v)) return true;
  const vertex = state.board.vertices[v];
  if (!vertex) return false;
  for (const e of vertex.edges) {
    if (e === excludeEid) continue;
    if (player.roads.includes(e)) return true;
  }
  return false;
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

function tryBankTrade(state: GameState, playerId: PlayerId): Action | null {
  const player = state.players.find((p) => p.id === playerId)!;
  const needs = reportNeeds(state, playerId);
  let handSize = 0;
  for (const r of RESOURCES) handSize += player.resources[r];
  // Catch-up signal: trailing players need to take worse trades to
  // accumulate buildable resources, otherwise the value-loss check
  // below would lock them out of bank trading entirely.
  const myVp = calculateVictoryPoints(state, playerId, false);
  let leaderVp = 0;
  for (const op of state.players) {
    if (op.id === playerId) continue;
    const v = calculateVictoryPoints(state, op.id, false);
    if (v > leaderVp) leaderVp = v;
  }
  const fallingBehind = leaderVp - myVp >= 3;

  // Bank-trade trigger rules. The OLD rule (handSize >= 5) caused
  // back-and-forth churn: AI with 4 brick would trade for wood, then trade
  // back to brick the next turn. Now:
  //  1) Goal-driven: we have a concrete build goal AND a specific shortfall.
  //  2) Discard-imminent: handSize >= 7 (at 8 we're forced to discard;
  //     starting the spend-down at 7 gives a one-turn buffer).
  const wantingForGoal = needs.goal !== 'none';
  const discardImminent = handSize >= 7;
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
  // 8-pip wheat for sheep just because we technically can. Trailing
  // players bypass this guard — the cost of stalling at 3 VP is far
  // worse than the cost of one bad bank conversion.
  if (!discardImminent && !fallingBehind) {
    const delta = RESOURCE_WEIGHT[wantRes] - RESOURCE_WEIGHT[bestGive] * bestRate;
    if (delta + (needs.byResource[wantRes] ?? 0) * 0.7 < -1.5) return null;
  }
  return { type: 'bankTrade', playerId, give: bestGive, receive: wantRes };
}

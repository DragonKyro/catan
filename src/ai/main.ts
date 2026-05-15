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
import { tryProposeTrade, shouldAcceptTrade } from './trade';
import { chooseDevCardPlay } from './devcard';

const ROAD_TARGET_THRESHOLD = 4.5; // min vertexScore to justify building a road for expansion

export function chooseMainPhaseAction(
  state: GameState,
  playerId: PlayerId,
): Action | null {
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
  const cardPlay = chooseDevCardPlay(state, playerId);
  if (cardPlay) return cardPlay;

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

  // 3) BUY DEV CARD when not strapped for resources
  if (
    canAfford(player.resources, COSTS.devCard) &&
    state.devCardDeck.length > 0
  ) {
    const needs = reportNeeds(state, playerId);
    let handSize = 0;
    for (const r of RESOURCES) handSize += player.resources[r];
    // Only skip when we're truly conserving for a city and our hand is
    // small enough that the next 7 wouldn't punish us anyway. Otherwise
    // dev cards turn idle resources into hidden VP and knight pressure —
    // strictly better than hoarding.
    const saveForCity = needs.goal === 'city' && handSize <= 5;
    if (!saveForCity) {
      return { type: 'buyDevCard', playerId };
    }
  }

  // 4) BUILD ROAD (only if it opens a high-value settlement spot AND we
  // don't already have a placement option through our existing roads)
  if (
    canAfford(player.resources, COSTS.road) &&
    player.roads.length < 15
  ) {
    // If we already have an open vertex reachable through our current roads
    // where we could put a settlement, don't burn wood/brick on more roads —
    // wait for sheep+wheat instead. Roads without an unlock don't score VP.
    const openSpots = countOpenSettlementSpots(state, playerId);
    if (openSpots === 0) {
      let bestEid: EdgeId | null = null;
      let bestVertexScore = -Infinity;
      for (const eid of state.board.edgeIds) {
        if (!canConnectRoad(state, playerId, eid)) continue;
        const edge = state.board.edges[eid]!;
        let endpointBest = -Infinity;
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
          if (s > endpointBest) endpointBest = s;
        }
        if (endpointBest > bestVertexScore) {
          bestVertexScore = endpointBest;
          bestEid = eid;
        }
      }
      if (bestEid && bestVertexScore >= ROAD_TARGET_THRESHOLD) {
        return { type: 'buildRoad', playerId, edge: bestEid };
      }
    }
  }

  // 5) BANK TRADE to enable an unlock
  const tradeAction = tryBankTrade(state, playerId);
  if (tradeAction) return tradeAction;

  // 6) PROPOSE TRADE to other players
  const proposal = tryProposeTrade(state, playerId);
  if (proposal) return proposal;

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

function tryBankTrade(state: GameState, playerId: PlayerId): Action | null {
  const player = state.players.find((p) => p.id === playerId)!;
  const needs = reportNeeds(state, playerId);
  let handSize = 0;
  for (const r of RESOURCES) handSize += player.resources[r];

  // Two triggers for trading at the bank/port:
  // 1) We have a concrete build goal and are short on a specific resource.
  // 2) Our hand is getting big — convert excess to anything more useful
  //    before a 7 rolls and we lose half. Hoarding is always bad.
  const wantingForGoal = needs.goal !== 'none';
  const wantingForHandSize = handSize >= 5;
  if (!wantingForGoal && !wantingForHandSize) return null;

  // Pick the resource we'd most like to receive. Prefer concrete goal needs;
  // otherwise pick the highest-weighted resource we currently have least of.
  let wantRes: Resource | null = null;
  let wantScore = -Infinity;
  for (const r of RESOURCES) {
    let score = (needs.byResource[r] ?? 0) * 1.5; // shortfall weight
    if (wantingForHandSize && !wantingForGoal) {
      // No goal — favor scarcity in our hand plus inherent resource value.
      score += RESOURCE_WEIGHT[r] * (1 / (1 + player.resources[r]));
    }
    if (score > wantScore) {
      wantScore = score;
      wantRes = r;
    }
  }
  if (!wantRes) return null;

  // Find the resource we have the most "spare" of (above the goal need) and
  // can afford at least one bank conversion of.
  let bestGive: Resource | null = null;
  let bestSpare = -Infinity;
  let bestRate = 4;
  for (const r of RESOURCES) {
    if (r === wantRes) continue;
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
  if (!wantingForHandSize) {
    const delta = RESOURCE_WEIGHT[wantRes] - RESOURCE_WEIGHT[bestGive] * bestRate;
    if (delta + (needs.byResource[wantRes] ?? 0) * 0.7 < -1.5) return null;
  }
  return { type: 'bankTrade', playerId, give: bestGive, receive: wantRes };
}

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
    // Don't buy if we're close to a city (save those ore/wheat)
    const needs = reportNeeds(state, playerId);
    if (needs.goal !== 'city') {
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
  if (needs.goal === 'none') return null;

  // Find a resource we need most
  let wantRes: Resource | null = null;
  let wantAmount = 0;
  for (const r of RESOURCES) {
    if (needs.byResource[r] > wantAmount && player.resources[r] === 0) {
      wantAmount = needs.byResource[r];
      wantRes = r;
    }
  }
  if (!wantRes) return null;

  // Find a resource we have enough of to trade away at our best rate
  for (const r of RESOURCES) {
    if (r === wantRes) continue;
    const rate = getBankTradeRate(state, playerId, r);
    const have = player.resources[r];
    const minHave = needs.byResource[r] + rate;
    if (have < minHave) continue;
    // Only trade if it leaves us at least as well off (sheep → wheat is fine, wheat → sheep usually not)
    const delta = RESOURCE_WEIGHT[wantRes] - RESOURCE_WEIGHT[r] * rate;
    // Very lenient — needs override weight bias
    if (delta + needs.byResource[wantRes] * 0.5 >= -1) {
      return { type: 'bankTrade', playerId, give: r, receive: wantRes };
    }
  }
  return null;
}

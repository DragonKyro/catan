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
import { tryProposeTrade } from './trade';
import { chooseDevCardPlay } from './devcard';

const ROAD_TARGET_THRESHOLD = 4.5; // min vertexScore to justify building a road for expansion

export function chooseMainPhaseAction(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  // If we have a pending trade we proposed, wait (we'll cancel via the timer).
  // The driver loop will eventually call this again after acceptance or after
  // we cancel. We avoid getting stuck by cancelling on the next call.
  if (state.pendingTrade?.proposerId === playerId) {
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

  // 4) BUILD ROAD (only if it opens a high-value settlement spot)
  if (
    canAfford(player.resources, COSTS.road) &&
    player.roads.length < 15
  ) {
    let bestEid: EdgeId | null = null;
    let bestVertexScore = -Infinity;
    for (const eid of state.board.edgeIds) {
      if (!canConnectRoad(state, playerId, eid)) continue;
      const edge = state.board.edges[eid]!;
      // Best follow-up: would either endpoint then be a legal settlement spot?
      let endpointBest = -Infinity;
      for (const v of edge.vertices) {
        // Check distance rule + own vertex
        // After placing the road, the only constraint relaxed is connectivity.
        // We approximate: vertex is currently legal-by-distance, just lacking connection.
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

  // 5) BANK TRADE to enable an unlock
  const tradeAction = tryBankTrade(state, playerId);
  if (tradeAction) return tradeAction;

  // 6) PROPOSE TRADE to other players
  const proposal = tryProposeTrade(state, playerId);
  if (proposal) return proposal;

  // 7) End turn
  return null;
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

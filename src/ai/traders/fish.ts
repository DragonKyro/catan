import type { Action, EdgeId, GameState, PlayerId, Resource, VertexId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import {
  FISH_COST_BUILD_ROAD,
  FISH_COST_BUY_DEV_CARD,
  FISH_COST_REMOVE_ROBBER,
  FISH_COST_STEAL,
  FISH_COST_TAKE_FROM_BANK,
  FISH_TOKEN_CAP,
} from '@/game/modules/traders/constants';
import { fishTotal, pickFishTokens } from '@/game/modules/traders/actions/spendFish';
import { canConnectRoad } from '@/game/placement';
import { hexPips } from '@/game/board/hexNumbers';
import { totalResources } from '@/game/resources';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { reportNeeds, vertexScore } from '../value';

type FishToken = 'one' | 'two' | 'three';

// Heuristic fish play (Fishing on Catan). Fish arrive only at production
// and the hand is capped at 7 tokens, so fish sitting in a full hand are
// wasted catches: the AI spends steadily, best effect first, and spends
// more freely as the hand fills up.
//   - 2: drive the robber off a hex that feeds us;
//   - 7: a free development card (the best value per fish);
//   - 4: the card that finishes a city / settlement / dev card now;
//   - 5: a free road toward a good settlement spot;
//   - 3: steal from the leader when the hand is getting full.
export function tryFishSpend(state: GameState, playerId: PlayerId): Action | null {
  if (state.phase !== 'main') return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const hand = (player.fishTokens ?? []) as FishToken[];
  if (hand.length === 0) return null;
  const total = fishTotal(hand);
  const crowded = hand.length >= FISH_TOKEN_CAP - 2;
  const spend = (cost: number, effect: Extract<Action, { type: 'spendFish' }>['effect']): Action | null => {
    const tokens = pickFishTokens(hand, cost);
    return tokens ? { type: 'spendFish', playerId, tokens, effect } : null;
  };

  // 1) Robber on one of our producing hexes.
  if (state.robberActive !== false && robberHurts(state, playerId) >= 3) {
    const a = spend(FISH_COST_REMOVE_ROBBER, { kind: 'removeRobber' });
    if (a) return a;
  }

  // 2) Free development card.
  if (total >= FISH_COST_BUY_DEV_CARD && state.devCardDeck.length > 0) {
    const a = spend(FISH_COST_BUY_DEV_CARD, { kind: 'buyDevCard' });
    if (a) return a;
  }

  // 3) The one card that completes a build this turn.
  const needs = reportNeeds(state, playerId);
  const shortfall = RESOURCES.reduce((s, r) => s + (needs.byResource[r] ?? 0), 0);
  if (needs.goal !== 'none' && total >= FISH_COST_TAKE_FROM_BANK && (shortfall <= 1 || crowded)) {
    let want: Resource | null = null;
    for (const r of RESOURCES) {
      if ((needs.byResource[r] ?? 0) > 0 && state.bank[r] > 0) {
        if (!want || needs.byResource[r] > needs.byResource[want]) want = r;
      }
    }
    if (want) {
      const a = spend(FISH_COST_TAKE_FROM_BANK, { kind: 'takeFromBank', resource: want });
      if (a) return a;
    }
  }

  // 4) Free road toward a settlement spot.
  if (total >= FISH_COST_BUILD_ROAD && player.roads.length < 15) {
    const edge = bestRoadEdge(state, playerId);
    if (edge && (edge.score >= 4 || crowded)) {
      const a = spend(FISH_COST_BUILD_ROAD, { kind: 'buildRoad', edge: edge.edge });
      if (a) return a;
    }
  }

  // 5) Steal when the hand is filling up (or we're well stocked), or when 3
  //    fish is all we have and a leader is sitting on a big hand.
  if (total >= FISH_COST_STEAL) {
    const target = stealTarget(state, playerId);
    const myVp = calculateVictoryPoints(state, playerId, false);
    const juicy =
      target !== null &&
      total < FISH_COST_TAKE_FROM_BANK &&
      calculateVictoryPoints(state, target, false) >= myVp &&
      totalResources(state.players.find((p) => p.id === target)!.resources) >= 5;
    if (target && (crowded || total >= 9 || juicy)) {
      const a = spend(FISH_COST_STEAL, { kind: 'steal', target });
      if (a) return a;
    }
  }

  // 6) Hand full: take any useful card rather than let catches go to waste.
  if (hand.length >= FISH_TOKEN_CAP && total >= FISH_COST_TAKE_FROM_BANK) {
    const r = scarcestForUs(state, playerId);
    if (r) return spend(FISH_COST_TAKE_FROM_BANK, { kind: 'takeFromBank', resource: r });
  }
  return null;
}

// 'fishSwap' phase: swap a one-fish token for a fresh draw (a draw averages
// ~1.9 fish), keep a hand of twos and threes.
export function chooseFishSwap(state: GameState, playerId: PlayerId): Action {
  const hand = state.players.find((p) => p.id === playerId)?.fishTokens ?? [];
  return { type: 'swapFish', playerId, token: hand.includes('one') ? 'one' : null };
}

// Pass the old boot to the qualifying opponent with the most public VP (the
// likeliest winner, so the +1 VP tax hurts them most).
export function tryPassBoot(state: GameState, playerId: PlayerId): Action | null {
  if (state.oldBootHolder !== playerId) return null;
  if (state.phase !== 'main') return null;
  const vp = calculateVictoryPoints(state, playerId, false);
  let best: { id: PlayerId; vp: number } | null = null;
  for (const p of state.players) {
    if (p.id === playerId) continue;
    const theirVp = calculateVictoryPoints(state, p.id, false);
    if (theirVp < vp) continue;
    if (!best || theirVp > best.vp) best = { id: p.id, vp: theirVp };
  }
  return best ? { type: 'passOldBoot', playerId, to: best.id } : null;
}

// Pips of ours the robber is sitting on (settlement 1x, city 2x).
function robberHurts(state: GameState, playerId: PlayerId): number {
  const hex = state.board.hexes[state.board.robberHex];
  if (!hex) return 0;
  const player = state.players.find((p) => p.id === playerId)!;
  let hurt = 0;
  for (const v of hex.corners) {
    if (player.settlements.includes(v)) hurt += hexPips(hex);
    else if (player.cities.includes(v)) hurt += 2 * hexPips(hex);
  }
  return hurt;
}

// The road edge (from our network) whose new end scores best as a future
// settlement spot.
function bestRoadEdge(state: GameState, playerId: PlayerId): { edge: EdgeId; score: number } | null {
  const player = state.players.find((p) => p.id === playerId)!;
  const ours = new Set<VertexId>([...player.settlements, ...player.cities]);
  for (const e of player.roads) for (const v of state.board.edges[e]!.vertices) ours.add(v);
  let best: { edge: EdgeId; score: number } | null = null;
  for (const eid of state.board.edgeIds) {
    if (!canConnectRoad(state, playerId, eid)) continue;
    const far = state.board.edges[eid]!.vertices.find((v) => !ours.has(v));
    if (!far) continue;
    const occupied = state.players.some((p) => p.settlements.includes(far) || p.cities.includes(far));
    if (occupied) continue;
    const score = vertexScore(state, far, playerId);
    if (!best || score > best.score) best = { edge: eid, score };
  }
  return best;
}

// The opponent to rob: most public VP among those holding cards, then the
// biggest hand.
function stealTarget(state: GameState, playerId: PlayerId): PlayerId | null {
  let best: { id: PlayerId; key: number } | null = null;
  for (const p of state.players) {
    if (p.id === playerId) continue;
    const cards = totalResources(p.resources);
    if (cards === 0) continue;
    const key = calculateVictoryPoints(state, p.id, false) * 10 + cards;
    if (!best || key > best.key) best = { id: p.id, key };
  }
  return best?.id ?? null;
}

function scarcestForUs(state: GameState, playerId: PlayerId): Resource | null {
  const player = state.players.find((p) => p.id === playerId)!;
  let best: Resource | null = null;
  for (const r of RESOURCES) {
    if (state.bank[r] <= 0) continue;
    if (!best || player.resources[r] < player.resources[best]) best = r;
  }
  return best;
}

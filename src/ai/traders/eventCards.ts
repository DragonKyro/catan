import type { Action, EdgeId, GameState, PlayerId, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { canAfford, totalResources } from '@/game/resources';
import { canPlaceSettlement } from '@/game/placement';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { chooseGoldResourcePicks } from '@/ai/seafarers/gold';
import { reportNeeds, RESOURCE_WEIGHT } from '@/ai/value';
import { assessThreats } from '@/ai/threats';
import {
  REPAIR_ROAD_COST,
  damagedRoadsOf,
} from '@/game/modules/traders/variants/eventCards/events';

// Catan Event Cards AI: an answer for every event choice, plus repairing
// Earthquake damage in the Action phase.

// The resource we'd least miss: plenty of it, little need for it.
function cheapestCard(state: GameState, playerId: PlayerId): Resource | null {
  const me = state.players.find((p) => p.id === playerId)!;
  const needs = reportNeeds(state, playerId);
  let best: Resource | null = null;
  let bestScore = -Infinity;
  for (const r of RESOURCES) {
    if (me.resources[r] < 1) continue;
    const score = me.resources[r] - needs.byResource[r] * 3 - RESOURCE_WEIGHT[r];
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

// Rob the most dangerous opponent with cards; the biggest hand breaks ties.
function stealTarget(state: GameState, playerId: PlayerId): PlayerId | null {
  const threats = assessThreats(state);
  let best: PlayerId | null = null;
  let bestScore = -Infinity;
  for (const p of state.players) {
    if (p.id === playerId) continue;
    const hand = totalResources(p.resources);
    if (hand === 0) continue;
    const score =
      hand + (threats[p.id]?.closeToWin ? 50 : 0) + calculateVictoryPoints(state, p.id, false) * 2;
    if (score > bestScore) {
      best = p.id;
      bestScore = score;
    }
  }
  return best;
}

// Earthquake: damage the road whose ends matter least to us — ends where
// we could settle cost the most (a damaged road blocks both ends).
function roadToDamage(state: GameState, playerId: PlayerId): EdgeId | null {
  const me = state.players.find((p) => p.id === playerId)!;
  const damaged = new Set(state.damagedRoads ?? []);
  let best: EdgeId | null = null;
  let bestCost = Infinity;
  for (const e of me.roads) {
    if (damaged.has(e)) continue;
    const ends = state.board.edges[e]?.vertices ?? [];
    const cost = ends.filter((v) => canPlaceSettlement(state, playerId, v)).length;
    if (cost < bestCost) {
      best = e;
      bestCost = cost;
    }
  }
  return best;
}

export function chooseEventAnswer(state: GameState, playerId: PlayerId): Action | null {
  const choice = state.eventCards?.pending?.choices[0];
  if (state.phase !== 'eventResolution' || !choice || choice.playerId !== playerId) return null;
  switch (choice.kind) {
    case 'takeResource': {
      const [r] = chooseGoldResourcePicks(state, playerId, 1);
      const pick = r && state.bank[r] > 0 ? r : RESOURCES.find((x) => state.bank[x] > 0)!;
      return { type: 'resolveEvent', playerId, resource: pick };
    }
    case 'giveResource': {
      const recipients = choice.recipients ?? [];
      // Helpful Neighbor: help whoever is furthest behind.
      const to =
        recipients.length === 1
          ? recipients[0]!
          : [...recipients].sort(
              (a, b) =>
                calculateVictoryPoints(state, a, false) - calculateVictoryPoints(state, b, false),
            )[0]!;
      return { type: 'resolveEvent', playerId, resource: cheapestCard(state, playerId), target: to };
    }
    case 'steal':
      return { type: 'resolveEvent', playerId, target: stealTarget(state, playerId) };
    case 'damageRoad':
      return { type: 'resolveEvent', playerId, edge: roadToDamage(state, playerId) };
  }
}

// Repair a damaged road when we can pay for it. Damaged roads block all our
// road building and the settlement spots at their ends.
export function tryRepairRoad(state: GameState, playerId: PlayerId): Action | null {
  const damaged = damagedRoadsOf(state, playerId);
  if (damaged.length === 0) return null;
  const me = state.players.find((p) => p.id === playerId)!;
  if (!canAfford(me.resources, REPAIR_ROAD_COST)) return null;
  return { type: 'repairRoad', playerId, edge: damaged[0]! };
}

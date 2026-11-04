import type {
  Action,
  GameState,
  KnightRecord,
  KnightStrength,
  PlayerId,
  VertexId,
} from '@/game/types';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canPlaceSettlement } from '@/game/placement';
import { calculateRouteLength } from '@/game/engine';
import {
  playerKnights,
  supplyAvailable,
  vertexAdjacentToRobber,
} from '@/game/modules/citiesAndKnights/knights/state';
import { reachableEmptyVertices } from '@/game/modules/citiesAndKnights/knights/graph';
import {
  canChaseRobberFrom,
  canPromoteKnightAt,
  knightCanAct,
  legalDisplaceTargets,
  legalKnightMoves,
  recruitSpots,
  treasonPlaceableStrengths,
  treasonPlacementSpots,
} from '@/game/modules/citiesAndKnights/knights/legal';
import { applyAction } from '@/game/engine';
import { vertexScore } from '../value';
import {
  firstLegal,
  hexPips,
  isLegal,
  playerById,
  publicVp,
  touchesHex,
} from './common';
import {
  barbarianOutlook,
  cityPending,
  defenderVpStrength,
  defenseTarget,
  safeActiveStrength,
  type BarbarianOutlook,
} from './barbarians';
import { ckReportNeeds } from './value';

// Knights for the Cities & Knights AI: barbarian defence, robber chasing,
// recruiting / promoting, displacement and the forced follow-ups.

// ---------------------------------------------------------------------------
// Placement scoring
// ---------------------------------------------------------------------------

// Where a knight of ours is most useful. Knights block opposing roads and
// settlement sites (rulebook p.9) and chase the robber off adjacent hexes —
// but they also block OUR settlement sites, so stay off good spots we could
// build on.
export function knightSpotScore(state: GameState, playerId: PlayerId, vertex: VertexId): number {
  const v = state.board.vertices[vertex];
  if (!v) return -Infinity;
  let score = 0;
  // Our own future settlement site: a knight here would block it.
  if (canPlaceSettlement(state, playerId, vertex)) {
    score -= 2 + Math.max(0, vertexScore(state, vertex, playerId)) * 0.6;
  }
  for (const opp of state.players) {
    if (opp.id === playerId) continue;
    // Blocks an opponent's settlement site.
    if (canPlaceSettlement(state, opp.id, vertex)) {
      score += 1 + Math.max(0, vertexScore(state, vertex, opp.id)) * 0.35;
    }
    // Blocks an opponent's road from running past this corner.
    for (const eid of v.edges) {
      if (opp.roads.includes(eid)) score += 0.8;
    }
  }
  // Robber cover: hexes we produce from that this knight can chase from.
  for (const hexId of v.hexes) {
    if (touchesHex(state, playerId, hexId)) score += hexPips(state, hexId) * 0.15;
  }
  return score;
}

function bestKnightSpot(
  state: GameState,
  playerId: PlayerId,
  candidates: Iterable<VertexId>,
): VertexId | null {
  let best: VertexId | null = null;
  let bestScore = -Infinity;
  for (const vid of candidates) {
    const s = knightSpotScore(state, playerId, vid);
    if (s > bestScore) {
      bestScore = s;
      best = vid;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function mine(state: GameState, playerId: PlayerId): Array<{ vertex: VertexId; knight: KnightRecord }> {
  return playerKnights(state, playerId);
}

export function tryRecruit(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (!canAfford(p.resources, COSTS.knight)) return null;
  if (supplyAvailable(state, playerId, 1) <= 0) return null;
  const spot = bestKnightSpot(state, playerId, recruitSpots(state, playerId));
  if (!spot) return null;
  return firstLegal(state, [{ type: 'recruitKnight', playerId, vertex: spot }]);
}

export function tryActivate(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (!canAfford(p.resources, COSTS.activateKnight)) return null;
  // Strongest inactive knight first: the most defence per wheat.
  const inactive = mine(state, playerId)
    .filter((k) => !k.knight.active)
    .sort((a, b) => b.knight.strength - a.knight.strength);
  return firstLegal(
    state,
    inactive.map((k) => ({ type: 'activateKnight' as const, playerId, vertex: k.vertex })),
  );
}

// Promote one knight. `activeFirst` = prefer a standing knight (its extra
// strength counts against the barbarians straight away).
export function tryPromote(
  state: GameState,
  playerId: PlayerId,
  activeFirst = true,
): Action | null {
  const p = playerById(state, playerId);
  if (!canAfford(p.resources, COSTS.promoteKnight)) return null;
  const options = mine(state, playerId)
    .filter((k) => canPromoteKnightAt(state, playerId, k.vertex))
    .sort((a, b) => {
      if (activeFirst && a.knight.active !== b.knight.active) return a.knight.active ? -1 : 1;
      return b.knight.strength - a.knight.strength;
    });
  return firstLegal(
    state,
    options.map((k) => ({ type: 'promoteKnight' as const, playerId, vertex: k.vertex })),
  );
}

// Barbarians are close and a city of ours is on the line: stand knights up,
// strengthen standing ones, or recruit (recruit + activate in one turn is
// allowed). Also goes for the Defender of Catan VP when it's cheap.
export function tryBarbarianDefense(state: GameState, playerId: PlayerId): Action | null {
  const pending = cityPending(state, playerId) ? 1 : 0;
  const o = barbarianOutlook(state, playerId, pending);
  if (!o.near && !o.prepare) return null;
  const p = playerById(state, playerId);
  const target = defenseTarget(o, p.cities.length + pending);
  if (o.myActive < target) {
    if (o.near) {
      // A new knight only defends once stood up: recruit when there's also
      // the wheat to activate it.
      const canStandUp = p.resources.wheat >= 1 && (p.resources.sheep >= 1 && p.resources.ore >= 1);
      const a =
        tryActivate(state, playerId) ??
        tryPromoteActive(state, playerId) ??
        (canStandUp ? tryRecruit(state, playerId) : null);
      if (a) return a;
    } else {
      // Likely within two rounds: a standing knight stays up until the
      // attack, so stand one up now with wheat the next city doesn't need.
      const cityWheat = pending ? (state.medicineActive ? 1 : 2) : 0;
      if (p.resources.wheat > cityWheat) {
        const a = tryActivate(state, playerId);
        if (a) return a;
      }
      if (o.myTotal < target) {
        const r = tryRecruit(state, playerId);
        if (r) return r;
      }
    }
  }
  // Defender of Catan VP (top defender when the island holds). Normally only
  // by standing up knights we already have; within 2 VP of the win it's
  // worth promoting / recruiting for.
  const vpTarget = defenderVpStrength(o);
  if (!o.near || o.myActive >= vpTarget) return null;
  const closeToWin = publicVp(state, playerId) >= state.settings.victoryPointsToWin - 2;
  const reach = o.myActive + o.myInactive + (closeToWin ? 2 : 0);
  if (reach < vpTarget) return null;
  if (o.totalDefense + (reach - o.myActive) < o.barbarianStrength) return null;
  if (o.myInactive > 0) return tryActivate(state, playerId);
  if (!closeToWin) return null;
  return tryPromoteActive(state, playerId) ?? tryRecruit(state, playerId);
}

function tryPromoteActive(state: GameState, playerId: PlayerId): Action | null {
  if (!mine(state, playerId).some((k) => k.knight.active && canPromoteKnightAt(state, playerId, k.vertex))) {
    return null;
  }
  return tryPromote(state, playerId, true);
}

// Robber on a hex we produce from: chase it with an adjacent standing knight.
// When the barbarians are close we only spend a knight we can stand back up.
export function tryChaseRobber(state: GameState, playerId: PlayerId): Action | null {
  if (!state.robberActive) return null;
  const robberHex = state.board.robberHex;
  if (!touchesHex(state, playerId, robberHex)) return null;
  if (hexPips(state, robberHex) === 0) return null;
  const o = barbarianOutlook(state, playerId);
  const p = playerById(state, playerId);
  if (o.near && o.myActive <= safeActiveStrength(o) && p.resources.wheat < 1) return null;
  const chasers = mine(state, playerId)
    .filter((k) => canChaseRobberFrom(state, k.vertex))
    .sort((a, b) => a.knight.strength - b.knight.strength);
  return firstLegal(
    state,
    chasers.map((k) => ({ type: 'chaseRobber' as const, playerId, vertex: k.vertex })),
  );
}

// No knight next to the robber that's on our hex: walk a standing knight
// next to it (it lies down; stand it up again for a chase next turn).
export function tryMoveTowardRobber(state: GameState, playerId: PlayerId): Action | null {
  if (!state.robberActive) return null;
  const robberHex = state.board.robberHex;
  if (!touchesHex(state, playerId, robberHex) || hexPips(state, robberHex) < 3) return null;
  const knights = mine(state, playerId);
  if (knights.some((k) => vertexAdjacentToRobber(state, k.vertex))) return null;
  const o = barbarianOutlook(state, playerId);
  if (o.near) return null; // don't lay a defender down right before an attack
  for (const k of knights) {
    if (!knightCanAct(state, k.vertex)) continue;
    const dests = legalKnightMoves(state, k.vertex).filter((v) => vertexAdjacentToRobber(state, v));
    const to = bestKnightSpot(state, playerId, dests);
    if (!to) continue;
    const a = firstLegal(state, [{ type: 'moveKnight', playerId, from: k.vertex, to }]);
    if (a) return a;
  }
  return null;
}

// Peacetime knights: about one point of knight strength per city (more
// when the attack is coming and we'd be the weakest), recruiting first and
// promoting once three knights are out. Saves ore for a city that's close
// unless the barbarians are about to arrive.
export function tryKnightUpkeep(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (p.cities.length === 0 && !cityPending(state, playerId)) return null;
  const o = barbarianOutlook(state, playerId);
  // A city with no knight at all is the first thing the barbarians take.
  if (o.myTotal === 0) {
    const r = tryRecruit(state, playerId);
    if (r) return r;
  }
  const needs = ckReportNeeds(state, playerId);
  if (!o.prepare && needs.goal === 'city' && (needs.byResource.ore > 0 || p.resources.ore < 4)) {
    return null;
  }
  const cities = Math.max(1, p.cities.length);
  const want = Math.min(Math.max(cities, o.prepare ? defenseTarget(o, cities) : 0), 6);
  if (o.myTotal >= want) return null;
  if (mine(state, playerId).length < 3) {
    const r = tryRecruit(state, playerId);
    if (r) return r;
  }
  return tryPromote(state, playerId, true);
}

// Spare sheep + ore and nothing better: a stronger knight wins displacement
// fights and attacks.
export function trySparePromotion(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (p.resources.sheep < 2 || p.resources.ore < 2) return null;
  const needs = ckReportNeeds(state, playerId);
  if (needs.goal === 'city') return null;
  return tryPromote(state, playerId, true);
}

// Displace an opposing knight when it pays: the victim has nowhere to go
// (the knight goes back to their supply), or our knight breaking their road
// costs the Longest Road holder / leader length.
export function tryDisplace(state: GameState, playerId: PlayerId): Action | null {
  const o = barbarianOutlook(state, playerId);
  // Displacing lays our knight down: not right before an attack unless we
  // can stand it back up.
  const p = playerById(state, playerId);
  if (o.near && p.resources.wheat < 1) return null;
  const myVp = publicVp(state, playerId);
  let best: Action | null = null;
  let bestGain = 1.5;
  for (const k of mine(state, playerId)) {
    for (const to of legalDisplaceTargets(state, k.vertex)) {
      const victim = state.knights?.[to];
      if (!victim) continue;
      const action: Action = { type: 'displaceKnight', playerId, from: k.vertex, to };
      let after: GameState;
      try {
        after = applyAction(state, action);
      } catch {
        continue;
      }
      let gain = 0;
      // Knight sent back to supply = strength off the board.
      const removed = after.phase !== 'displacedKnightMove';
      if (removed) gain += 1 + victim.strength;
      const before = calculateRouteLength(state, victim.playerId);
      const lost = before - calculateRouteLength(after, victim.playerId);
      if (lost > 0) {
        const holder = state.longestRoad?.holder === victim.playerId;
        const lostLr = holder && after.longestRoad?.holder !== victim.playerId;
        gain += lost * 0.4 + (lostLr ? 3 : 0);
      }
      if (publicVp(state, victim.playerId) > myVp) gain += 0.5;
      if (gain > bestGain) {
        bestGain = gain;
        best = action;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Forced follow-ups
// ---------------------------------------------------------------------------

// Our knight was displaced: pick where it goes.
export function chooseDisplacedKnightMove(state: GameState, playerId: PlayerId): Action | null {
  const pending = state.pendingKnightMove;
  if (!pending || pending.playerId !== playerId) return null;
  const dests = reachableEmptyVertices(state, playerId, pending.sourceVertex);
  const ranked = [...dests].sort(
    (a, b) => knightSpotScore(state, playerId, b) - knightSpotScore(state, playerId, a),
  );
  return firstLegal(
    state,
    ranked.map((to) => ({ type: 'displacedKnightMove' as const, playerId, to })),
  );
}

// Treason victim: give up our weakest knight, inactive before active.
export function chooseTreasonRemoval(state: GameState, playerId: PlayerId): Action | null {
  const ranked = mine(state, playerId).sort((a, b) => {
    if (a.knight.strength !== b.knight.strength) return a.knight.strength - b.knight.strength;
    if (a.knight.active !== b.knight.active) return a.knight.active ? 1 : -1;
    return knightSpotScore(state, playerId, a.vertex) - knightSpotScore(state, playerId, b.vertex);
  });
  return firstLegal(
    state,
    ranked.map((k) => ({ type: 'treasonRemoveKnight' as const, playerId, vertex: k.vertex })),
  );
}

// Treason attacker: place the strongest knight we may (≤ the removed one),
// or decline when we can't place one.
export function chooseTreasonPlacement(state: GameState, playerId: PlayerId): Action | null {
  const skip: Action = { type: 'treasonPlaceKnight', playerId };
  const removed = state.pendingTreason?.removedStrength;
  if (!removed) return firstLegal(state, [skip]);
  const spots = treasonPlacementSpots(state, playerId).sort(
    (a, b) => knightSpotScore(state, playerId, b) - knightSpotScore(state, playerId, a),
  );
  const strengths = treasonPlaceableStrengths(state).sort((a, b) => b - a);
  for (const strength of strengths) {
    for (const vertex of spots) {
      const a: Action = { type: 'treasonPlaceKnight', playerId, vertex, strength };
      if (isLegal(state, a)) return a;
    }
  }
  return firstLegal(state, [skip]);
}

// Barbarians won and we pick the pillaged city: our least productive one,
// a walled city last (the wall would come down with it).
export function choosePillagedCity(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  const ranked = [...p.cities].sort((a, b) => {
    const wa = state.cityWalls?.[a] ? 1 : 0;
    const wb = state.cityWalls?.[b] ? 1 : 0;
    if (wa !== wb) return wa - wb;
    return vertexScore(state, a, playerId) - vertexScore(state, b, playerId);
  });
  return firstLegal(
    state,
    ranked.map((vertex) => ({ type: 'choosePillagedCity' as const, playerId, vertex })),
  );
}

// Can we place a knight at all (Treason payoff)?
export function canPlaceAnyKnight(state: GameState, playerId: PlayerId): boolean {
  const anySupply = ([1, 2, 3] as KnightStrength[]).some(
    (s) => supplyAvailable(state, playerId, s) > 0,
  );
  return anySupply && recruitSpots(state, playerId).length > 0;
}

export type { BarbarianOutlook };

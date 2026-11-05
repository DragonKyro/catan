import type {
  Commodity,
  CommodityBank,
  GameState,
  ImprovementTrack,
  PlayerId,
  Resource,
  ResourceBank,
  VertexId,
} from '@/game/types';
import { COMMODITIES, COSTS, IMPROVEMENT_TRACKS, RESOURCES, TRACK_COMMODITY } from '@/game/types';
import { canPlaceSettlement } from '@/game/placement';
import { MAX_IMPROVEMENT_LEVEL } from '@/game/modules/citiesAndKnights/constants';
import {
  commodityOfTerrain,
  commodityPips,
  commoditiesOf,
  hexPips,
  isCitiesAndKnights,
  playerById,
} from './common';
import { barbarianOutlook, cityPending, defenseTarget } from './barbarians';

// Card weights in C&K. Resources keep the base weights (ore / wheat are
// scarce: cities, knights and activation all eat them); a commodity is a
// step up an improvement track, worth a little more than a resource.
const RESOURCE_WEIGHT_CK: Record<Resource, number> = {
  ore: 1.35,
  wheat: 1.3,
  brick: 1.0,
  wood: 1.0,
  sheep: 1.0,
};
const COMMODITY_WEIGHT = 1.25;

// ---------------------------------------------------------------------------
// Board scoring
// ---------------------------------------------------------------------------

// Is the setup placement in progress a city? Rulebook: round 1 places a
// settlement, round 2 a CITY.
function placingSetupCity(state: GameState): boolean {
  return state.phase === 'setupRound2' && state.setupState?.step === 'settlement';
}

// Extra vertexScore for Cities & Knights. A city on forest / pasture /
// mountains yields 1 resource + 1 commodity (paper / cloth / coin), so the
// setup city wants commodity hexes; any settlement spot is a future city.
// 0 outside C&K.
export function ckVertexBonus(state: GameState, vertexId: VertexId, _playerId: PlayerId): number {
  if (!isCitiesAndKnights(state)) return 0;
  const v = state.board.vertices[vertexId];
  if (!v) return 0;
  const asCity = placingSetupCity(state);
  let bonus = 0;
  const commoditiesHere = new Set<Commodity>();
  for (const hexId of v.hexes) {
    const pips = hexPips(state, hexId);
    if (pips === 0) continue;
    const terrain = state.board.hexes[hexId]!.terrain;
    const c = commodityOfTerrain(terrain);
    if (c) {
      commoditiesHere.add(c);
      bonus += pips * (asCity ? COMMODITY_WEIGHT * 0.8 : 0.25);
    } else if (asCity && (terrain === 'wheat' || terrain === 'brick')) {
      // A city doubles wheat / brick instead.
      bonus += pips * RESOURCE_WEIGHT_CK[terrain] * 0.55;
    }
  }
  if (asCity) bonus += commoditiesHere.size * 0.6;
  return bonus;
}

// ---------------------------------------------------------------------------
// Needs (drives trades / discards)
// ---------------------------------------------------------------------------

export type CKGoal = 'city' | 'settlement' | 'knight' | 'road' | 'none';

export interface CKNeedReport {
  byResource: Record<Resource, number>;
  goal: CKGoal;
}

function shortfall(have: ResourceBank, cost: Partial<ResourceBank>): Record<Resource, number> {
  const out: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  for (const r of RESOURCES) out[r] = Math.max(0, (cost[r] ?? 0) - have[r]);
  return out;
}

function sum(rec: Record<Resource, number>): number {
  let t = 0;
  for (const r of RESOURCES) t += rec[r];
  return t;
}

// Does the player need more knight strength? True when the barbarians are
// close and we'd lose a city, or when our knights are thin for our cities.
export function wantsKnightStrength(state: GameState, playerId: PlayerId): boolean {
  const p = playerById(state, playerId);
  if (p.cities.length === 0) return false;
  const o = barbarianOutlook(state, playerId);
  if ((o.near || o.prepare) && o.myTotal < defenseTarget(o, p.cities.length)) return true;
  return o.myTotal < Math.min(p.cities.length, 3);
}

function hasOpenSettlementSpot(state: GameState, playerId: PlayerId): boolean {
  const p = playerById(state, playerId);
  if (p.settlements.length >= 5) return false;
  const seen = new Set<VertexId>();
  for (const eid of p.roads) {
    const e = state.board.edges[eid];
    if (!e) continue;
    for (const v of e.vertices) {
      if (seen.has(v)) continue;
      seen.add(v);
      if (canPlaceSettlement(state, playerId, v)) return true;
    }
  }
  return false;
}

// C&K replacement for reportNeeds: no development cards; knights (sheep +
// ore, wheat to activate) take their place. Same shape as the base report.
export function ckReportNeeds(state: GameState, playerId: PlayerId): CKNeedReport {
  const p = playerById(state, playerId);
  const r = p.resources;
  const zero = (): Record<Resource, number> => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });

  const knightCost: Partial<ResourceBank> = { sheep: 1, ore: 1, wheat: 1 };
  const pending = cityPending(state, playerId) ? 1 : 0;
  const o = barbarianOutlook(state, playerId, pending);
  const target = defenseTarget(o, p.cities.length + pending);
  const urgentKnight = (o.near || o.prepare) && o.pillageable > 0 && o.myActive < target;

  // Defence first when a city is on the line: an inactive knight only needs
  // wheat; otherwise recruit + activate.
  if (urgentKnight) {
    const cost = o.myInactive > 0 ? { wheat: 1 } : knightCost;
    const s = shortfall(r, cost);
    if (sum(s) <= 2) return { goal: 'knight', byResource: s };
  }

  if (p.settlements.length > 0 && p.cities.length < 4) {
    const cost = state.medicineActive ? COSTS.cityMedicine : COSTS.city;
    const s = shortfall(r, cost);
    if (sum(s) <= 3) return { goal: 'city', byResource: s };
  }

  if (hasOpenSettlementSpot(state, playerId)) {
    const s = shortfall(r, COSTS.settlement);
    if (sum(s) <= 2) return { goal: 'settlement', byResource: s };
  }

  if (wantsKnightStrength(state, playerId)) {
    const s = shortfall(r, { sheep: 1, ore: 1 });
    if (sum(s) <= 1) return { goal: 'knight', byResource: s };
  }

  {
    const s = shortfall(r, COSTS.settlement);
    if (sum(s) <= 2) return { goal: 'settlement', byResource: s };
  }

  {
    const s = shortfall(r, COSTS.road);
    if (sum(s) <= 1) return { goal: 'road', byResource: s };
  }

  return { goal: 'none', byResource: zero() };
}

// ---------------------------------------------------------------------------
// Improvement focus
// ---------------------------------------------------------------------------

// How much we'd like to push each improvement track. Driven by the
// commodity we hold and produce; level 3 unlocks the track's ability, level
// 4/5 the metropolis (2 VP) unless someone already owns it for good.
export function trackPriority(state: GameState, playerId: PlayerId): Record<ImprovementTrack, number> {
  const p = playerById(state, playerId);
  const have = commoditiesOf(p);
  const pips = commodityPips(state, playerId);
  const out = {} as Record<ImprovementTrack, number>;
  for (const track of IMPROVEMENT_TRACKS) {
    const c = TRACK_COMMODITY[track];
    const level = p.improvements?.[track] ?? 0;
    if (level >= MAX_IMPROVEMENT_LEVEL) {
      out[track] = -100;
      continue;
    }
    let score = have[c] * 1.0 + pips[c] * 0.5;
    if (level < 3) score += 1.0;
    const metro = state.metropolises?.[track] ?? null;
    if (level + 1 >= 4) {
      if (!metro) score += 2.0;
      else if (metro.playerId === playerId) score += level + 1 === 5 ? 1.5 : 0;
      else if (!metro.permanent && level + 1 === 5) score += 2.5; // take it back for good
      else score -= 1.5;
    }
    out[track] = score;
  }
  return out;
}

// The track we're saving commodities for.
export function focusTrack(state: GameState, playerId: PlayerId): ImprovementTrack {
  const pri = trackPriority(state, playerId);
  let best: ImprovementTrack = 'science';
  let bestScore = -Infinity;
  for (const t of IMPROVEMENT_TRACKS) {
    if (pri[t] > bestScore) {
      bestScore = pri[t];
      best = t;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Card keep-values (discard / Wedding / Guild Dues / Commercial Harbor)
// ---------------------------------------------------------------------------

export type CardKind = Resource | Commodity;

export function isCommodity(k: CardKind): k is Commodity {
  return (COMMODITIES as readonly string[]).includes(k);
}

// The cards each plan wants, with how much the plan matters. A unit within
// a plan's cost is worth extra to keep.
function plans(state: GameState, playerId: PlayerId): Array<{ w: number; cost: Partial<Record<CardKind, number>> }> {
  const p = playerById(state, playerId);
  const out: Array<{ w: number; cost: Partial<Record<CardKind, number>> }> = [];
  if (p.settlements.length > 0 && p.cities.length < 4) out.push({ w: 1.4, cost: { wheat: 2, ore: 3 } });
  out.push({ w: 0.8, cost: { wood: 1, brick: 1, sheep: 1, wheat: 1 } });
  if (p.cities.length > 0) {
    out.push({ w: 0.8, cost: { sheep: 1, ore: 1, wheat: 1 } });
    const track = focusTrack(state, playerId);
    const level = p.improvements?.[track] ?? 0;
    if (level < MAX_IMPROVEMENT_LEVEL) {
      out.push({ w: 1.5, cost: { [TRACK_COMMODITY[track]]: level + 1 } });
    }
    for (const t of IMPROVEMENT_TRACKS) {
      if (t === track) continue;
      const lv = p.improvements?.[t] ?? 0;
      if (lv < MAX_IMPROVEMENT_LEVEL) out.push({ w: 0.6, cost: { [TRACK_COMMODITY[t]]: lv + 1 } });
    }
  }
  return out;
}

// Value of holding the `n`-th card (1-based) of `kind`. Decreasing in n,
// so "discard the lowest-valued units" always takes the top units of a
// stack first.
export function unitValue(
  state: GameState,
  playerId: PlayerId,
  kind: CardKind,
  n: number,
  planList = plans(state, playerId),
): number {
  let v = isCommodity(kind) ? COMMODITY_WEIGHT : RESOURCE_WEIGHT_CK[kind];
  for (const plan of planList) {
    const need = plan.cost[kind] ?? 0;
    if (n <= need) v += plan.w;
  }
  v -= 0.22 * (n - 1);
  return v;
}

export interface CardSelection {
  resources: Partial<ResourceBank>;
  commodities: Partial<CommodityBank>;
}

// Pick `count` cards to give away (discard, Wedding, …): the lowest-valued
// units of the hand.
export function cheapestCards(state: GameState, playerId: PlayerId, count: number): CardSelection {
  const p = playerById(state, playerId);
  const have: Record<CardKind, number> = {
    ...p.resources,
    ...commoditiesOf(p),
  };
  const planList = plans(state, playerId);
  const out: CardSelection = { resources: {}, commodities: {} };
  let left = count;
  while (left > 0) {
    let pick: CardKind | null = null;
    let low = Infinity;
    for (const k of [...RESOURCES, ...COMMODITIES] as CardKind[]) {
      if (have[k] <= 0) continue;
      const v = unitValue(state, playerId, k, have[k], planList);
      if (v < low) {
        low = v;
        pick = k;
      }
    }
    if (!pick) break;
    have[pick]--;
    if (isCommodity(pick)) out.commodities[pick] = (out.commodities[pick] ?? 0) + 1;
    else out.resources[pick] = (out.resources[pick] ?? 0) + 1;
    left--;
  }
  return out;
}

// Pick `count` cards to take from someone else's hand (Guild Dues): the
// ones worth most to us.
export function bestCardsFrom(
  state: GameState,
  playerId: PlayerId,
  pool: Record<CardKind, number>,
  count: number,
): CardSelection {
  const p = playerById(state, playerId);
  const mine: Record<CardKind, number> = { ...p.resources, ...commoditiesOf(p) };
  const avail = { ...pool };
  const planList = plans(state, playerId);
  const out: CardSelection = { resources: {}, commodities: {} };
  for (let i = 0; i < count; i++) {
    let pick: CardKind | null = null;
    let high = -Infinity;
    for (const k of [...RESOURCES, ...COMMODITIES] as CardKind[]) {
      if ((avail[k] ?? 0) <= 0) continue;
      const v = unitValue(state, playerId, k, mine[k] + 1, planList);
      if (v > high) {
        high = v;
        pick = k;
      }
    }
    if (!pick) break;
    avail[pick]--;
    mine[pick]++;
    if (isCommodity(pick)) out.commodities[pick] = (out.commodities[pick] ?? 0) + 1;
    else out.resources[pick] = (out.resources[pick] ?? 0) + 1;
  }
  return out;
}

// Resource we'd most like one more of (Aqueduct pick).
export function mostWantedResource(state: GameState, playerId: PlayerId): Resource | null {
  const p = playerById(state, playerId);
  const planList = plans(state, playerId);
  let best: Resource | null = null;
  let high = -Infinity;
  for (const r of RESOURCES) {
    if (state.bank[r] <= 0) continue;
    const v = unitValue(state, playerId, r, p.resources[r] + 1, planList);
    if (v > high) {
      high = v;
      best = r;
    }
  }
  return best;
}
